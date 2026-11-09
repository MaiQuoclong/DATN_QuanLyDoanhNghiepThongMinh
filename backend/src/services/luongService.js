const LoiUngDung = require('../utils/LoiUngDung');
const { chayTransaction } = require('../config/ketNoiCsdl');
const luongRepository = require('../repositories/luongRepository');
const chamCongRepository = require('../repositories/chamCongRepository');
const nhatKyRepository = require('../repositories/nhatKyRepository');
const { khoangNgayCuaThang, thangHienTai } = require('../utils/ngayThang');
const {
  demNgayCongChuan, tinhNgayCong, tinhChiTietPhieu, tinhThueChoPhieu, lapPhieu, tinhPhuCap, tinhBaoHiem,
} = require('../utils/tinhLuong');

// Quyền theo docs/phan-quyen.md mục 7
const xemToanBo = (vaiTro) => vaiTro.includes('HR') || vaiTro.includes('giamDoc');
const maThang = (thang, nam) => `${nam}-${String(thang).padStart(2, '0')}`;
const SO_TIEN_TOI_DA = 9999999999999.99; // DECIMAL(15,2)

function canHoSo(nguoiDung) {
  if (!nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Tài khoản chưa có hồ sơ nhân viên nên không thể thao tác bảng lương');
}

function themChiTiet(phieu, ngayCongChuan) {
  return { ...phieu, ...tinhChiTietPhieu(phieu, ngayCongChuan) };
}

function themChiTietBang(bang) {
  return { ...bang, thangNam: maThang(bang.thang, bang.nam), ngayCongChuan: demNgayCongChuan(maThang(bang.thang, bang.nam)) };
}

// ===================== Sinh phiếu từ dữ liệu chấm công / nghỉ phép / hợp đồng =====================

// Tạo toàn bộ phiếu của bảng trong cùng transaction rồi cập nhật tổng chi phí lương (= tổng thu nhập trước khấu trừ)
async function sinhPhieu(bangId, thang, ketNoi) {
  const { tuNgay, denNgay } = khoangNgayCuaThang(thang);
  const ngayCongChuan = demNgayCongChuan(thang);
  const [cacNhanVien, chamCong, donNghi, thuongPhat] = await Promise.all([
    luongRepository.layNhanVienTinhLuong(tuNgay, denNgay, ketNoi),
    luongRepository.layChamCongTrongThang(tuNgay, denNgay, ketNoi),
    luongRepository.layDonNghiDaDuyetTrongThang(tuNgay, denNgay, ketNoi),
    luongRepository.layThuongPhatTrongThang(tuNgay, denNgay, ketNoi),
  ]);
  if (!cacNhanVien.length) throw new LoiUngDung(409, `Tháng ${thang} không có nhân viên nào có hợp đồng hiệu lực để tính lương`);

  let tong = 0;
  const biCat = [];
  for (const nv of cacNhanVien) {
    const banGhi = chamCong.filter((c) => c.nhanVienId === nv.nhanVienId);
    const soNgayCongThucTe = tinhNgayCong(
      thang,
      new Set(banGhi.map((c) => c.ngayChamCong)),
      donNghi.filter((d) => d.nhanVienId === nv.nhanVienId)
    );
    const phieu = lapPhieu({
      luongCoBan: nv.luongCoBan,
      mucPhuCap: nv.mucPhuCap,
      soNgayCongThucTe,
      tongGioLamThem: banGhi.reduce((s, c) => s + Number(c.soGioLamThemOT), 0),
      thuongPhat: thuongPhat.get(nv.nhanVienId) ?? 0,
    }, ngayCongChuan);
    if (phieu.phatBiCat) biCat.push(`${nv.maNhanVien} ${phieu.phatBiCat}`);
    await luongRepository.themPhieu(bangId, nv.nhanVienId, phieu, ketNoi);
    tong += tinhChiTietPhieu(phieu, ngayCongChuan).tongThuNhap;
  }
  await luongRepository.capNhatTongChiPhi(bangId, tong, ketNoi);
  // Mô tả cho nhật ký: số phiếu + phần phạt bị bỏ để thực lĩnh không âm
  return `${cacNhanVien.length} phiếu${biCat.length ? `; phạt vượt thu nhập bị bỏ: ${biCat.join(', ')}` : ''}`;
}

async function capNhatLaiTong(bang, ketNoi) {
  const ngayCongChuan = demNgayCongChuan(maThang(bang.thang, bang.nam));
  const cacPhieu = await luongRepository.layTatCaPhieuCuaBang(bang.id, ketNoi);
  const tong = cacPhieu.reduce((s, p) => s + tinhChiTietPhieu(p, ngayCongChuan).tongThuNhap, 0);
  await luongRepository.capNhatTongChiPhi(bang.id, tong, ketNoi);
}

async function chanThangChuaChot(thang, ketNoi) {
  if (!(await chamCongRepository.layThongTinChot(thang, ketNoi))) {
    throw new LoiUngDung(409, `Tháng ${thang} chưa chốt công, chưa thể lập bảng lương`);
  }
}

async function khoaBangTonTai(id, ketNoi) {
  const bang = await luongRepository.khoaBang(id, ketNoi);
  if (!bang) throw new LoiUngDung(404, 'Không tìm thấy bảng lương');
  return bang;
}

function chanKhacTrangThai(bang, trangThai, thongBao) {
  if (bang.trangThai !== trangThai) throw new LoiUngDung(409, thongBao);
}

// Người lập ≠ người duyệt: chặn cả người lập bảng lẫn người đã tính lại / sửa phiếu / gửi duyệt bảng (tài khoản vừa HR vừa giamDoc)
async function chanNguoiLapDuyet(nguoiDung, bang, ketNoi, hanhDong) {
  if (bang.nguoiLapId === nguoiDung.nhanVienId
    || (await luongRepository.daThamGiaLapBang(nguoiDung.nguoiDungId, bang.maBangLuong, bang.ngayTao, ketNoi))) {
    throw new LoiUngDung(403, `Người lập hoặc đã chỉnh sửa bảng lương không được tự ${hanhDong}`);
  }
}

// ===================== Bảng lương =====================

async function layDanhSachBang({ nam, trangThai }) {
  return (await luongRepository.layDanhSachBang({ nam, trangThai })).map(themChiTietBang);
}

async function layChiTietBang(id, boLoc) {
  const bang = await luongRepository.layBangTheoId(id);
  if (!bang) throw new LoiUngDung(404, 'Không tìm thấy bảng lương');
  const chiTiet = themChiTietBang(bang);
  const { items, tongSo } = await luongRepository.layPhieuTheoBang(id, boLoc);
  return {
    bangLuong: chiTiet,
    items: items.map((p) => themChiTiet(p, chiTiet.ngayCongChuan)),
    phanTrang: { trang: boLoc.trang, kichThuoc: boLoc.kichThuoc, tongSo },
  };
}

// HR lập bảng BAN_NHAP cho tháng đã chốt công và đã kết thúc; mỗi tháng một bảng (UNIQUE thang, nam)
async function lapBang(nguoiDung, thang, diaChiIP) {
  canHoSo(nguoiDung);
  if (thang >= thangHienTai()) throw new LoiUngDung(409, 'Chỉ lập bảng lương cho tháng đã kết thúc');
  const [nam, soThang] = thang.split('-').map(Number);
  const maBangLuong = `BL${nam}-${String(soThang).padStart(2, '0')}`;
  const id = await chayTransaction(async (ketNoi) => {
    await chanThangChuaChot(thang, ketNoi);
    let bangId;
    try {
      bangId = await luongRepository.themBang({ maBangLuong, thang: soThang, nam, nguoiLapId: nguoiDung.nhanVienId }, ketNoi);
    } catch (loi) {
      if (loi.code === 'ER_DUP_ENTRY') throw new LoiUngDung(409, `Tháng ${thang} đã có bảng lương`);
      throw loi;
    }
    const soPhieu = await sinhPhieu(bangId, thang, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'LAP_BANG_LUONG', diaChiIP ?? null, `${maBangLuong}: ${soPhieu}`.slice(0, 1000), ketNoi);
    return bangId;
  });
  return themChiTietBang(await luongRepository.layBangTheoId(id));
}

// Tính lại toàn bộ phiếu từ dữ liệu gốc (bỏ các chỉnh sửa tay), chỉ khi còn nháp
async function tinhLaiBang(nguoiDung, id, diaChiIP) {
  canHoSo(nguoiDung);
  await chayTransaction(async (ketNoi) => {
    const bang = await khoaBangTonTai(id, ketNoi);
    chanKhacTrangThai(bang, 'BAN_NHAP', 'Chỉ tính lại được bảng lương đang ở bản nháp');
    await chanThangChuaChot(maThang(bang.thang, bang.nam), ketNoi);
    await luongRepository.xoaPhieuTheoBang(id, ketNoi);
    const soPhieu = await sinhPhieu(id, maThang(bang.thang, bang.nam), ketNoi);
    await nhatKyRepository.themNhatKy(
      nguoiDung.nguoiDungId, 'TINH_LAI_BANG_LUONG', diaChiIP ?? null, `${bang.maBangLuong}: ${soPhieu}`.slice(0, 1000), ketNoi
    );
  });
  return themChiTietBang(await luongRepository.layBangTheoId(id));
}

// Tính lại phiếu của bảng nháp trong transaction của nơi gọi (bảng đã được khóa FOR UPDATE).
// Dùng khi ban hành quyết định khen thưởng/kỷ luật vào tháng đang có bảng nháp, để khoản tiền không bị sót.
async function tinhLaiBangNhapTrongGiaoDich(bang, ketNoi) {
  await luongRepository.xoaPhieuTheoBang(bang.id, ketNoi);
  return sinhPhieu(bang.id, maThang(bang.thang, bang.nam), ketNoi);
}

async function xoaBang(nguoiDung, id, diaChiIP) {
  await chayTransaction(async (ketNoi) => {
    const bang = await khoaBangTonTai(id, ketNoi);
    chanKhacTrangThai(bang, 'BAN_NHAP', 'Chỉ xóa được bảng lương đang ở bản nháp');
    await luongRepository.xoaBang(id, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'XOA_BANG_LUONG', diaChiIP ?? null, maThang(bang.thang, bang.nam), ketNoi);
  });
}

async function guiDuyet(nguoiDung, id, diaChiIP) {
  await chayTransaction(async (ketNoi) => {
    const bang = await khoaBangTonTai(id, ketNoi);
    chanKhacTrangThai(bang, 'BAN_NHAP', 'Chỉ gửi duyệt được bảng lương đang ở bản nháp');
    await luongRepository.capNhatTrangThaiBang(id, 'CHO_DUYET', null, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'GUI_DUYET_BANG_LUONG', diaChiIP ?? null, bang.maBangLuong, ketNoi);
  });
  return themChiTietBang(await luongRepository.layBangTheoId(id));
}

// giamDoc duyệt (người lập ≠ người duyệt) -> DA_DUYET, phiếu công bố cho nhân viên
async function duyetBang(nguoiDung, id, diaChiIP) {
  canHoSo(nguoiDung);
  await chayTransaction(async (ketNoi) => {
    const bang = await khoaBangTonTai(id, ketNoi);
    chanKhacTrangThai(bang, 'CHO_DUYET', 'Chỉ duyệt được bảng lương đang chờ duyệt');
    await chanNguoiLapDuyet(nguoiDung, bang, ketNoi, 'duyệt');
    await luongRepository.capNhatTrangThaiBang(id, 'DA_DUYET', nguoiDung.nhanVienId, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'DUYET_BANG_LUONG', diaChiIP ?? null, maThang(bang.thang, bang.nam), ketNoi);
  });
  return themChiTietBang(await luongRepository.layBangTheoId(id));
}

// Trả lại về BAN_NHAP để HR sửa; lý do lưu trong nhật ký (schema không có cột lý do)
async function traLaiBang(nguoiDung, id, lyDo, diaChiIP) {
  canHoSo(nguoiDung);
  await chayTransaction(async (ketNoi) => {
    const bang = await khoaBangTonTai(id, ketNoi);
    chanKhacTrangThai(bang, 'CHO_DUYET', 'Chỉ trả lại được bảng lương đang chờ duyệt');
    await chanNguoiLapDuyet(nguoiDung, bang, ketNoi, 'trả lại');
    await luongRepository.capNhatTrangThaiBang(id, 'BAN_NHAP', null, ketNoi);
    await nhatKyRepository.themNhatKy(
      nguoiDung.nguoiDungId, 'TRA_LAI_BANG_LUONG', diaChiIP ?? null, `${maThang(bang.thang, bang.nam)}: ${lyDo.trim()}`.slice(0, 1000), ketNoi
    );
  });
  return themChiTietBang(await luongRepository.layBangTheoId(id));
}

// ===================== Phiếu lương =====================

// Kiểm tra theo dạng chuỗi để không lệch do số thực (0.29 * 100 = 28.999...)
function laySoTien(giaTri, nhan, choPhepAm = false) {
  const chuoi = typeof giaTri === 'number' || typeof giaTri === 'string' ? String(giaTri).trim() : '';
  const so = /^-?\d{1,13}(\.\d{1,2})?$/.test(chuoi) ? Number(chuoi) : NaN;
  if (!Number.isFinite(so) || Math.abs(so) > SO_TIEN_TOI_DA) {
    throw new LoiUngDung(400, `${nhan} phải là số tiền hợp lệ, tối đa 2 chữ số thập phân`);
  }
  if (!choPhepAm && so < 0) throw new LoiUngDung(400, `${nhan} không được âm`);
  return so;
}

// HR sửa phiếu khi bảng còn nháp, không sửa phiếu của chính mình; thuế TNCN tự tính lại
async function suaPhieu(nguoiDung, id, body, diaChiIP) {
  canHoSo(nguoiDung);
  const moi = {};
  if (body.soNgayCongThucTe !== undefined) {
    const so = laySoTien(body.soNgayCongThucTe, 'Số ngày công');
    if (so * 2 !== Math.round(so * 2)) throw new LoiUngDung(400, 'Số ngày công phải theo bước 0.5 ngày');
    moi.soNgayCongThucTe = so;
  }
  if (body.luongLamThemOT !== undefined) moi.luongLamThemOT = laySoTien(body.luongLamThemOT, 'Lương làm thêm');
  if (body.thuongKPI !== undefined) moi.thuongKPI = laySoTien(body.thuongKPI, 'Thưởng/phạt', true);
  if (body.tongPhuCap !== undefined) moi.tongPhuCap = laySoTien(body.tongPhuCap, 'Phụ cấp');
  if (!Object.keys(moi).length) throw new LoiUngDung(400, 'Không có thông tin nào thay đổi');

  const banDau = await luongRepository.layPhieuTheoId(id);
  if (!banDau) throw new LoiUngDung(404, 'Không tìm thấy phiếu lương');
  if (banDau.nhanVienId === nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Bạn không được tự sửa phiếu lương của chính mình');

  await chayTransaction(async (ketNoi) => {
    // Khóa bảng trước phiếu (cùng thứ tự với tính lại / gửi duyệt) để không sửa được khi bảng vừa chuyển trạng thái
    const bang = await khoaBangTonTai(banDau.bangTongHopLuongId, ketNoi);
    chanKhacTrangThai(bang, 'BAN_NHAP', 'Chỉ sửa được phiếu khi bảng lương đang ở bản nháp');
    const phieu = await luongRepository.layPhieuTheoId(id, ketNoi, true);
    if (!phieu) throw new LoiUngDung(404, 'Không tìm thấy phiếu lương');
    const ngayCongChuan = demNgayCongChuan(maThang(bang.thang, bang.nam));
    if (moi.soNgayCongThucTe !== undefined && moi.soNgayCongThucTe > ngayCongChuan) {
      throw new LoiUngDung(400, `Số ngày công không được vượt quá số ngày công chuẩn (${ngayCongChuan})`);
    }
    const thayDoi = Object.keys(moi).filter((c) => moi[c] !== phieu[c]);
    if (!thayDoi.length) throw new LoiUngDung(400, 'Không có thông tin nào thay đổi');
    // Đổi ngày công mà không tự nhập phụ cấp -> chia lại phụ cấp hợp đồng theo ngày công mới
    if (moi.soNgayCongThucTe !== undefined && moi.tongPhuCap === undefined) {
      const { tuNgay, denNgay } = khoangNgayCuaThang(maThang(bang.thang, bang.nam));
      const [hopDong] = await luongRepository.layNhanVienTinhLuong(tuNgay, denNgay, ketNoi, phieu.nhanVienId);
      if (hopDong) {
        moi.tongPhuCap = tinhPhuCap(hopDong.mucPhuCap, moi.soNgayCongThucTe, ngayCongChuan);
        if (moi.tongPhuCap !== phieu.tongPhuCap) thayDoi.push('tongPhuCap');
      }
    }
    // Đổi ngày công -> tính lại bảo hiểm theo cùng quy tắc khi lập bảng
    if (moi.soNgayCongThucTe !== undefined) {
      moi.khauTruBaoHiem = tinhBaoHiem(phieu.luongCoBan, moi.soNgayCongThucTe, ngayCongChuan);
      if (moi.khauTruBaoHiem !== phieu.khauTruBaoHiem) thayDoi.push('khauTruBaoHiem');
    }
    const sauSua = { ...phieu, ...moi };
    sauSua.khauTruThueTNCN = tinhThueChoPhieu(sauSua, ngayCongChuan);
    if (tinhChiTietPhieu(sauSua, ngayCongChuan).thucLinh < 0) {
      throw new LoiUngDung(400, 'Các khoản khấu trừ vượt quá thu nhập: thực lĩnh không được âm');
    }
    await luongRepository.capNhatPhieu(id, { ...moi, khauTruThueTNCN: sauSua.khauTruThueTNCN }, ketNoi);
    await capNhatLaiTong(bang, ketNoi);
    await nhatKyRepository.themNhatKy(
      nguoiDung.nguoiDungId, 'SUA_PHIEU_LUONG', diaChiIP ?? null,
      `${phieu.maBangLuong} ${phieu.maNhanVien}: ${thayDoi.map((c) => `${c} ${phieu[c]} -> ${moi[c]}`).join(', ')}`, ketNoi
    );
  });
  return layPhieu(nguoiDung, id);
}

// Xem phiếu: của mình (chỉ khi bảng đã duyệt); HR, giamDoc xem mọi phiếu
async function layPhieu(nguoiDung, id) {
  const phieu = await luongRepository.layPhieuTheoId(id);
  const laCuaMinh = phieu && phieu.nhanVienId === nguoiDung.nhanVienId;
  if (!phieu || (!xemToanBo(nguoiDung.vaiTro) && !(laCuaMinh && phieu.trangThaiBangLuong === 'DA_DUYET'))) {
    throw new LoiUngDung(404, 'Không tìm thấy phiếu lương');
  }
  return themChiTiet(phieu, demNgayCongChuan(maThang(phieu.thang, phieu.nam)));
}

async function layPhieuCuaToi(nguoiDung, nam) {
  if (!nguoiDung.nhanVienId) return [];
  const cacPhieu = await luongRepository.layPhieuDaDuyetCuaNhanVien(nguoiDung.nhanVienId, nam);
  return cacPhieu.map((p) => themChiTiet(p, demNgayCongChuan(maThang(p.thang, p.nam))));
}

// ===================== Báo cáo & xuất Excel =====================

// Quỹ lương năm theo tháng và theo phòng ban (chỉ bảng đã duyệt)
async function layBaoCaoQuyLuong(nam) {
  const cacPhieu = await luongRepository.layPhieuDaDuyetTheoNam(nam);
  const theoThang = new Map();
  const theoPhongBan = new Map();
  const cong = (bang, khoa, macDinh, p) => {
    const muc = bang.get(khoa) ?? { ...macDinh, soNhanVien: 0, tongThuNhap: 0, tongBaoHiem: 0, tongThue: 0, tongThucLinh: 0 };
    muc.soNhanVien += 1;
    muc.tongThuNhap += p.tongThuNhap;
    muc.tongBaoHiem += p.khauTruBaoHiem;
    muc.tongThue += p.khauTruThueTNCN;
    muc.tongThucLinh += p.thucLinh;
    bang.set(khoa, muc);
  };
  for (const goc of cacPhieu) {
    const p = themChiTiet(goc, demNgayCongChuan(maThang(goc.thang, goc.nam)));
    cong(theoThang, p.thang, { thang: p.thang }, p);
    cong(theoPhongBan, p.phongBanId, { phongBanId: p.phongBanId, tenPhongBan: p.tenPhongBan }, p);
  }
  const danhSachThang = [...theoThang.values()].sort((a, b) => a.thang - b.thang);
  return {
    nam,
    tongNam: danhSachThang.reduce((s, t) => s + t.tongThuNhap, 0),
    theoThang: danhSachThang,
    // Phòng ban hiện tại của nhân viên (schema không lưu lịch sử điều chuyển); số nhân viên = số phiếu trong năm
    theoPhongBan: [...theoPhongBan.values()].sort((a, b) => b.tongThuNhap - a.tongThuNhap),
  };
}

// CSV UTF-8 có BOM để Excel mở đúng tiếng Việt; ô chữ bắt đầu bằng = + - @ | % được thêm ' để chặn chèn công thức
function oCsv(giaTri) {
  let s = String(giaTri ?? '');
  if (/^[=+\-@|%\t\r]/.test(s) && typeof giaTri !== 'number') s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function xuatExcel(id) {
  const bang = await luongRepository.layBangTheoId(id);
  if (!bang) throw new LoiUngDung(404, 'Không tìm thấy bảng lương');
  const { ngayCongChuan, thangNam } = themChiTietBang(bang);
  const { items } = await luongRepository.layPhieuTheoBang(id);
  const tieuDe = ['Mã NV', 'Họ và tên', 'Phòng ban', 'Chức danh', 'Ngày công chuẩn', 'Ngày công thực tế', 'Lương cơ bản',
    'Lương theo công', 'Lương làm thêm', 'Thưởng/Phạt', 'Phụ cấp', 'Tổng thu nhập', 'Bảo hiểm', 'Thuế TNCN', 'Thực lĩnh'];
  const dong = items.map((goc) => {
    const p = themChiTiet(goc, ngayCongChuan);
    return [p.maNhanVien, p.hoVaTen, p.tenPhongBan, p.tenChucDanh, ngayCongChuan, p.soNgayCongThucTe, p.luongCoBan,
      p.luongTheoCong, p.luongLamThemOT, p.thuongKPI, p.tongPhuCap, p.tongThuNhap, p.khauTruBaoHiem, p.khauTruThueTNCN, p.thucLinh];
  });
  const noiDung = [tieuDe, ...dong].map((d) => d.map(oCsv).join(',')).join('\r\n');
  return { tenFile: `${bang.maBangLuong}_${thangNam}.csv`, noiDung: `﻿${noiDung}\r\n` };
}

module.exports = {
  layDanhSachBang,
  layChiTietBang,
  lapBang,
  tinhLaiBang,
  tinhLaiBangNhapTrongGiaoDich,
  xoaBang,
  guiDuyet,
  duyetBang,
  traLaiBang,
  suaPhieu,
  layPhieu,
  layPhieuCuaToi,
  layBaoCaoQuyLuong,
  xuatExcel,
};
