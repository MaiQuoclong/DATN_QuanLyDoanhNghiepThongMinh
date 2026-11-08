const LoiUngDung = require('../utils/LoiUngDung');
const { chayTransaction } = require('../config/ketNoiCsdl');
const { THAM_SO_NGHI_PHEP } = require('../config/thamSoNghiepVu');
const nghiPhepRepository = require('../repositories/nghiPhepRepository');
const chamCongRepository = require('../repositories/chamCongRepository');
const nhanVienRepository = require('../repositories/nhanVienRepository');
const phongBanRepository = require('../repositories/phongBanRepository');
const nhatKyRepository = require('../repositories/nhatKyRepository');
const { congNgay, tinhSoNgayNghi, layCacThang } = require('../utils/tinhNgayNghi');
const { laNgayHopLe } = require('../middlewares/kiemTraDuLieu');
const { ngayHomNay, khoangNgayCuaThang } = require('../utils/ngayThang');
const { TRANG_THAI_LOAI_NGHI_PHEP } = require('../utils/trangThai');

const TRANG_THAI_KHONG_NGHI_PHEP = ['TAM_NGHI', 'DA_NGHI_VIEC'];
const SO_NGAY_TOI_DA_CUA_O = 99.5; // giới hạn nghiệp vụ cho quỹ/số ngày tối đa (cột DECIMAL(4,1) chứa tới 999.9), bước 0.5 ngày

const namHienTai = () => Number(ngayHomNay().slice(0, 4));


function xemToanCongTy(vaiTro) {
  return vaiTro.includes('HR') || vaiTro.includes('giamDoc');
}

async function layPhamVi(nguoiDung, ketNoi) {
  if (xemToanCongTy(nguoiDung.vaiTro)) return null;
  return phongBanRepository.layPhongBanQuanLy(nguoiDung.nhanVienId ?? 0, ketNoi);
}

// Chuỗi không bắt buộc: null/rỗng -> null; không phải chuỗi -> 400 (tránh TypeError 500 khi gọi trim)
function layChuoiTuyChon(giaTri, nhan) {
  if (giaTri === undefined || giaTri === null) return null;
  if (typeof giaTri !== 'string') throw new LoiUngDung(400, `${nhan} phải là chuỗi ký tự`);
  return giaTri.trim() || null;
}

function canHoSo(nguoiDung) {
  if (!nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Tài khoản chưa có hồ sơ nhân viên nên không thể dùng chức năng nghỉ phép');
}

// Khóa dòng nhân viên trước mọi bảng nghiệp vụ (quy ước thứ tự khóa ở chamCongRepository)
async function khoaNhanVienTonTai(nhanVienId, ketNoi) {
  await nhanVienRepository.khoaNhanVien(nhanVienId, ketNoi);
  const hoSo = await nhanVienRepository.layTheoId(nhanVienId, ketNoi);
  if (!hoSo) throw new LoiUngDung(404, 'Không tìm thấy hồ sơ nhân viên');
  return hoSo;
}

// Số ngày dạng DECIMAL(4,1) theo bước 0.5 (quỹ phép, số ngày tối đa của loại nghỉ)
function laySoNgay(giaTri, nhan) {
  const so = typeof giaTri === 'string' && giaTri.trim() !== '' ? Number(giaTri) : giaTri;
  if (typeof so !== 'number' || !Number.isFinite(so) || so < 0 || so > SO_NGAY_TOI_DA_CUA_O || (so * 2) % 1 !== 0) {
    throw new LoiUngDung(400, `${nhan} phải là số từ 0 đến ${SO_NGAY_TOI_DA_CUA_O}, bước 0.5 ngày`);
  }
  return so;
}

function layLogic(giaTri, nhan) {
  if (typeof giaTri !== 'boolean') throw new LoiUngDung(400, `${nhan} phải là true hoặc false`);
  return giaTri;
}

function layNam(giaTri, macDinh = namHienTai()) {
  if (giaTri === undefined || giaTri === '') return macDinh;
  if (!/^\d{4}$/.test(String(giaTri))) throw new LoiUngDung(400, 'Năm phải có dạng YYYY');
  return Number(giaTri);
}

// ===================== Chuỗi duyệt (docs/phan-quyen.md quy tắc 5) =====================

// Người duyệt dự kiến của đơn:
// 1. Đơn dài hơn N ngày (THAM_SO_NGHI_PHEP.soNgayChuyenGiamDoc) -> giamDoc.
// 2. Trưởng bộ phận phòng của người gửi; nếu phòng không có trưởng, người gửi chính là trưởng, hoặc trưởng
//    đang tạm nghỉ/đã nghỉ việc, trưởng không có vai trò quanLy (không duyệt được) hoặc phòng đã ngừng hoạt động
//    -> đi lên phòng ban cha (lặp lại).
// 3. Hết cây (phòng gốc) -> giamDoc (cấp cao nhất; giamDoc duyệt được mọi đơn trừ đơn của mình).
function xacDinhNguoiDuyet({ nhanVienId, phongBanId, soNgayNghi }, cayPhongBan) {
  if (soNgayNghi > THAM_SO_NGHI_PHEP.soNgayChuyenGiamDoc) return { loai: 'GIAM_DOC', lyDo: 'DON_DAI_NGAY' };
  const theoId = new Map(cayPhongBan.map((pb) => [pb.id, pb]));
  const daDi = new Set();
  let phong = theoId.get(phongBanId);
  while (phong && !daDi.has(phong.id)) {
    daDi.add(phong.id);
    const truongDuyetDuoc = phong.truongBoPhanId && phong.truongBoPhanId !== nhanVienId && phong.truongCoQuanLy
      && phong.trangThai === 'DANG_HOAT_DONG' && !TRANG_THAI_KHONG_NGHI_PHEP.includes(phong.trangThaiTruong);
    if (truongDuyetDuoc) {
      return {
        loai: 'TRUONG_BO_PHAN', nhanVienId: phong.truongBoPhanId, maNhanVien: phong.maTruong, hoVaTen: phong.tenTruong, phongBanId: phong.id,
      };
    }
    phong = theoId.get(phong.phongBanChaId);
  }
  return { loai: 'GIAM_DOC', lyDo: 'CAP_CAO_NHAT' };
}

// nguoiDung.tuDuyetDuoc: giamDoc khi công ty không còn giamDoc nào khác đang hoạt động (xem kemQuyenTuDuyet)
function duocDuyetDon(nguoiDung, don, nguoiDuyet) {
  if (don.trangThai !== 'CHO_DUYET' || !nguoiDung.nhanVienId) return false;
  if (don.nhanVienId === nguoiDung.nhanVienId) return Boolean(nguoiDung.tuDuyetDuoc);
  if (nguoiDung.vaiTro.includes('giamDoc')) return true;
  return nguoiDung.vaiTro.includes('quanLy') && nguoiDuyet.loai === 'TRUONG_BO_PHAN' && nguoiDuyet.nhanVienId === nguoiDung.nhanVienId;
}

function themThongTinDuyet(nguoiDung, don, cayPhongBan) {
  if (don.trangThai !== 'CHO_DUYET') return { ...don, nguoiDuyetDuKien: null, duocDuyet: false };
  const nguoiDuyet = xacDinhNguoiDuyet(don, cayPhongBan);
  return { ...don, nguoiDuyetDuKien: nguoiDuyet, duocDuyet: duocDuyetDon(nguoiDung, don, nguoiDuyet) };
}

function moTaNguoiDuyet(nguoiDuyet) {
  return nguoiDuyet.loai === 'GIAM_DOC' ? 'Ban Giám đốc' : `${nguoiDuyet.hoVaTen} (${nguoiDuyet.maNhanVien})`;
}

function kiemTraQuyenTrenDon(nguoiDung, don, cayPhongBan) {
  if (!nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Tài khoản chưa có hồ sơ nhân viên nên không thể duyệt');
  if (don.nhanVienId === nguoiDung.nhanVienId && !nguoiDung.tuDuyetDuoc) {
    throw new LoiUngDung(403, 'Bạn không được tự duyệt đơn nghỉ phép của chính mình');
  }
  const nguoiDuyet = xacDinhNguoiDuyet(don, cayPhongBan);
  if (!duocDuyetDon(nguoiDung, { ...don, trangThai: 'CHO_DUYET' }, nguoiDuyet)) {
    throw new LoiUngDung(403, `Đơn này thuộc quyền duyệt của ${moTaNguoiDuyet(nguoiDuyet)}`);
  }
}

// Đơn của giamDoc đi lên cấp cao nhất là giamDoc khác; nếu không còn giamDoc nào khác đang hoạt động thì không ai
// duyệt được (đơn kẹt CHO_DUYET và chặn chốt công) -> cho chính giamDoc đó tự duyệt, có ghi nhật ký.
async function kemQuyenTuDuyet(nguoiDung, ketNoi) {
  if (!nguoiDung.vaiTro.includes('giamDoc') || !nguoiDung.nhanVienId) return { ...nguoiDung, tuDuyetDuoc: false };
  const soKhac = await nghiPhepRepository.demGiamDocHoatDongKhac(nguoiDung.nhanVienId, ketNoi);
  return { ...nguoiDung, tuDuyetDuoc: soKhac === 0 };
}

// ===================== Loại nghỉ phép (HR) =====================

function layDanhSachLoai(boLoc) {
  return nghiPhepRepository.layDanhSachLoai(boLoc);
}

async function themLoai(nguoiDung, body, diaChiIP) {
  const maLoai = body.maLoai.trim().toUpperCase();
  if (!/^[A-Z0-9_]{2,30}$/.test(maLoai)) throw new LoiUngDung(400, 'Mã loại chỉ gồm chữ in hoa, số, dấu gạch dưới (2-30 ký tự)');
  const loai = {
    maLoai,
    tenLoai: body.tenLoai.trim(),
    soNgayToiDa: body.soNgayToiDa === undefined || body.soNgayToiDa === '' || body.soNgayToiDa === null ? null : laySoNgay(body.soNgayToiDa, 'Số ngày tối đa'),
    coLuong: body.coLuong === undefined ? true : layLogic(body.coLuong, 'Có lương'),
    truVaoQuyPhepNam: body.truVaoQuyPhepNam === undefined ? true : layLogic(body.truVaoQuyPhepNam, 'Trừ vào quỹ phép năm'),
    moTa: layChuoiTuyChon(body.moTa, 'Mô tả'),
  };
  if (loai.soNgayToiDa === 0) throw new LoiUngDung(400, 'Số ngày tối đa phải lớn hơn 0 (để trống nếu không giới hạn)');
  const id = await chayTransaction(async (ketNoi) => {
    try {
      const idMoi = await nghiPhepRepository.themLoai(loai, ketNoi);
      await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'THEM_LOAI_NGHI_PHEP', diaChiIP ?? null, maLoai, ketNoi);
      return idMoi;
    } catch (loi) {
      if (loi.code === 'ER_DUP_ENTRY') throw new LoiUngDung(409, `Mã loại nghỉ phép ${maLoai} đã tồn tại`);
      throw loi;
    }
  });
  return nghiPhepRepository.layLoaiTheoId(id);
}

// Sửa loại: đổi cờ coLuong / truVaoQuyPhepNam khi đã có đơn sẽ làm sai quỹ phép và lương đã tính -> 409
async function suaLoai(nguoiDung, id, body, diaChiIP) {
  await chayTransaction(async (ketNoi) => {
    const loai = await nghiPhepRepository.layLoaiTheoId(id, ketNoi, 'FOR UPDATE');
    if (!loai) throw new LoiUngDung(404, 'Không tìm thấy loại nghỉ phép');
    const moi = {};
    if (body.tenLoai !== undefined) {
      if (typeof body.tenLoai !== 'string' || body.tenLoai.trim().length < 2) throw new LoiUngDung(400, 'Tên loại nghỉ phép phải có ít nhất 2 ký tự');
      moi.tenLoai = body.tenLoai.trim();
    }
    if (body.soNgayToiDa !== undefined) {
      moi.soNgayToiDa = body.soNgayToiDa === '' || body.soNgayToiDa === null ? null : laySoNgay(body.soNgayToiDa, 'Số ngày tối đa');
      if (moi.soNgayToiDa === 0) throw new LoiUngDung(400, 'Số ngày tối đa phải lớn hơn 0 (để trống nếu không giới hạn)');
    }
    if (body.coLuong !== undefined) moi.coLuong = layLogic(body.coLuong, 'Có lương');
    if (body.truVaoQuyPhepNam !== undefined) moi.truVaoQuyPhepNam = layLogic(body.truVaoQuyPhepNam, 'Trừ vào quỹ phép năm');
    if (body.moTa !== undefined) moi.moTa = layChuoiTuyChon(body.moTa, 'Mô tả');
    if (body.trangThai !== undefined) {
      if (!TRANG_THAI_LOAI_NGHI_PHEP.includes(body.trangThai)) throw new LoiUngDung(400, 'Trạng thái loại nghỉ phép không hợp lệ');
      moi.trangThai = body.trangThai;
    }

    const thayDoi = Object.keys(moi).filter((cot) => moi[cot] !== loai[cot]);
    if (!thayDoi.length) throw new LoiUngDung(400, 'Không có thông tin nào thay đổi');
    if (thayDoi.some((cot) => ['coLuong', 'truVaoQuyPhepNam'].includes(cot)) && (await nghiPhepRepository.demDonTheoLoai(id, ketNoi)) > 0) {
      throw new LoiUngDung(409, 'Loại nghỉ phép đã có đơn, không thể đổi chế độ hưởng lương hoặc trừ quỹ phép');
    }
    await nghiPhepRepository.capNhatLoai(id, Object.fromEntries(thayDoi.map((cot) => [cot, moi[cot]])), ketNoi);
    await nhatKyRepository.themNhatKy(
      nguoiDung.nguoiDungId, 'SUA_LOAI_NGHI_PHEP', diaChiIP ?? null, `${loai.maLoai}: ${thayDoi.join(', ')}`, ketNoi
    );
  });
  return nghiPhepRepository.layLoaiTheoId(id);
}

// ===================== Quỹ phép năm =====================

function themSoNgayConLai(dong) {
  if (dong.tongSoNgayPhep === null || dong.tongSoNgayPhep === undefined) return { ...dong, soNgayConLai: null };
  return { ...dong, soNgayConLai: dong.tongSoNgayPhep - dong.soNgayDaNghi - dong.soNgayChoDuyet };
}

async function layQuyCuaToi(nguoiDung, namTruyVan) {
  canHoSo(nguoiDung);
  const nam = layNam(namTruyVan);
  const quy = await nghiPhepRepository.layQuy(nguoiDung.nhanVienId, nam);
  const soNgayChoDuyet = await nghiPhepRepository.demNgayChoDuyetTrongNam(nguoiDung.nhanVienId, nam, null);
  if (!quy) return { nam, quy: null, soNgayChoDuyet, soNgayConLai: null };
  return { nam, quy, soNgayChoDuyet, soNgayConLai: quy.tongSoNgayPhep - quy.soNgayDaNghi - soNgayChoDuyet };
}

async function layDanhSachQuy(nguoiDung, { nam, phongBanId, tuKhoa, trang, kichThuoc }) {
  const namLoc = layNam(nam);
  const { items, tongSo } = await nghiPhepRepository.layDanhSachQuy({
    nam: namLoc, phamViPhongBanIds: await layPhamVi(nguoiDung), phongBanId, tuKhoa,
    viTri: (trang - 1) * kichThuoc, soLuong: kichThuoc,
  });
  return { nam: namLoc, items: items.map(themSoNgayConLai), phanTrang: { trang, kichThuoc, tongSo } };
}

// HR cấp quỹ phép năm cho mọi nhân viên chưa có quỹ (năm trước, năm nay hoặc năm sau)
async function capQuyNam(nguoiDung, body, diaChiIP) {
  const nam = layNam(body.nam);
  const hienTai = namHienTai();
  if (nam < hienTai - 1 || nam > hienTai + 1) throw new LoiUngDung(400, `Chỉ cấp quỹ phép cho năm ${hienTai - 1} đến ${hienTai + 1}`);
  const tongSoNgayPhep = body.tongSoNgayPhep === undefined || body.tongSoNgayPhep === ''
    ? THAM_SO_NGHI_PHEP.soNgayPhepNamMacDinh
    : laySoNgay(body.tongSoNgayPhep, 'Số ngày phép');
  // INSERT ... SELECT khóa chia sẻ nhiều dòng nhanvien, có thể deadlock với tạo đơn -> thử lại
  const soNhanVien = await chayVoiThuLai(() => chayTransaction(async (ketNoi) => {
    const soLuong = await nghiPhepRepository.capQuyHangLoat(nam, tongSoNgayPhep, ketNoi);
    if (soLuong > 0) {
      await nhatKyRepository.themNhatKy(
        nguoiDung.nguoiDungId, 'CAP_QUY_PHEP_NAM', diaChiIP ?? null, `Năm ${nam}: ${soLuong} nhân viên x ${tongSoNgayPhep} ngày`, ketNoi
      );
    }
    return soLuong;
  }));
  return { nam, tongSoNgayPhep, soNhanVien };
}

// HR sửa tổng số ngày phép của một người (trừ quỹ của mình); không được thấp hơn số đã nghỉ + đang chờ duyệt
async function suaQuy(nguoiDung, id, body, diaChiIP) {
  const tongMoi = laySoNgay(body.tongSoNgayPhep, 'Tổng số ngày phép');
  const lyDo = layChuoiTuyChon(body.lyDo, 'Lý do');
  const quyBanDau = await nghiPhepRepository.layQuyTheoId(id);
  if (!quyBanDau) throw new LoiUngDung(404, 'Không tìm thấy quỹ phép');
  if (quyBanDau.nhanVienId === nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Bạn không được tự sửa quỹ phép của chính mình');
  await chayTransaction(async (ketNoi) => {
    const hoSo = await khoaNhanVienTonTai(quyBanDau.nhanVienId, ketNoi);
    if (hoSo.trangThaiLamViec === 'DA_NGHI_VIEC') throw new LoiUngDung(409, 'Nhân viên đã nghỉ việc, không thể sửa quỹ phép');
    const quy = await nghiPhepRepository.layQuyTheoId(id, ketNoi, true);
    if (!quy) throw new LoiUngDung(404, 'Không tìm thấy quỹ phép');
    if (tongMoi === quy.tongSoNgayPhep) throw new LoiUngDung(400, 'Không có thông tin nào thay đổi');
    const choDuyet = await nghiPhepRepository.demNgayChoDuyetTrongNam(quy.nhanVienId, quy.namHieuLuc, null, ketNoi);
    if (tongMoi < quy.soNgayDaNghi + choDuyet) {
      throw new LoiUngDung(409, `Tổng số ngày phép không được nhỏ hơn số ngày đã nghỉ và đang chờ duyệt (${quy.soNgayDaNghi + choDuyet})`);
    }
    await nghiPhepRepository.capNhatTongQuy(id, tongMoi, ketNoi);
    await nhatKyRepository.themNhatKy(
      nguoiDung.nguoiDungId, 'SUA_QUY_PHEP', diaChiIP ?? null,
      `${hoSo.maNhanVien} năm ${quy.namHieuLuc}: ${quy.tongSoNgayPhep} -> ${tongMoi}${lyDo ? ` (${lyDo})` : ''}`, ketNoi
    );
  });
  return nghiPhepRepository.layQuyTheoId(id);
}

// ===================== Đơn nghỉ phép =====================

async function chanThangDaChot(tuNgay, denNgay, ketNoi) {
  for (const thang of layCacThang(tuNgay, denNgay)) {
    if (await chamCongRepository.layThongTinChot(thang, ketNoi)) {
      throw new LoiUngDung(409, `Công tháng ${thang} đã chốt, không thể tạo hoặc duyệt đơn nghỉ trong tháng này`);
    }
  }
}

// Mã DNPyyyy-xxxx: năm chưa có đơn thì FOR UPDATE chỉ đặt gap lock, hai người tạo cùng lúc có thể trùng mã
// hoặc chờ vòng nhau -> chạy lại transaction (tối đa 3 lần)
const SO_LAN_THU = 3;
async function chayVoiThuLai(congViec) {
  for (let lan = 1; ; lan += 1) {
    try {
      return await congViec();
    } catch (loi) {
      if (!['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK'].includes(loi.code) || lan >= SO_LAN_THU) throw loi;
    }
  }
}

// Tạo đơn CHO_DUYET cho chính mình. phuongThucTao: FORM_GIAO_DIEN (web) | AI_CHAT (Function Calling dùng lại hàm này)
function kiemTraDuLieuDon(body) {
  if (!body || typeof body !== 'object') throw new LoiUngDung(400, 'Dữ liệu đơn nghỉ phép không hợp lệ');
  if (!/^[1-9]\d{0,9}$/.test(String(body.loaiNghiPhepId ?? ''))) throw new LoiUngDung(400, 'Loại nghỉ phép phải là số nguyên dương');
  for (const [truong, nhan] of [['ngayBatDau', 'Ngày bắt đầu'], ['ngayKetThuc', 'Ngày kết thúc']]) {
    if (typeof body[truong] !== 'string' || !laNgayHopLe(body[truong])) throw new LoiUngDung(400, `${nhan} phải là ngày hợp lệ dạng YYYY-MM-DD`);
  }
  const lyDo = typeof body.lyDo === 'string' ? body.lyDo.trim() : '';
  if (lyDo.length < 5 || lyDo.length > 1000) throw new LoiUngDung(400, 'Lý do phải từ 5 đến 1000 ký tự');
  return lyDo;
}

async function taoDon(nguoiDung, body, phuongThucTao = 'FORM_GIAO_DIEN') {
  const lyDo = kiemTraDuLieuDon(body);
  const { ngayBatDau, ngayKetThuc } = body;
  const loaiNghiPhepId = Number(body.loaiNghiPhepId);
  const nuaNgay = body.nuaNgay === undefined ? false : layLogic(body.nuaNgay, 'Nghỉ nửa ngày');
  if (ngayKetThuc < ngayBatDau) throw new LoiUngDung(400, 'Ngày kết thúc không được trước ngày bắt đầu');
  if (ngayBatDau.slice(0, 4) !== ngayKetThuc.slice(0, 4)) {
    throw new LoiUngDung(400, 'Đơn nghỉ không được kéo dài sang năm khác, hãy tách thành hai đơn');
  }
  if (nuaNgay && ngayBatDau !== ngayKetThuc) throw new LoiUngDung(400, 'Chỉ nghỉ nửa ngày khi ngày bắt đầu trùng ngày kết thúc');
  if (ngayBatDau > congNgay(ngayHomNay(), THAM_SO_NGHI_PHEP.soNgayDatTruocToiDa)) {
    throw new LoiUngDung(400, `Chỉ được tạo đơn bắt đầu trong vòng ${THAM_SO_NGHI_PHEP.soNgayDatTruocToiDa} ngày tới`);
  }
  const soNgayNghi = tinhSoNgayNghi(ngayBatDau, ngayKetThuc, nuaNgay);
  if (soNgayNghi === 0) throw new LoiUngDung(400, 'Khoảng ngày chỉ gồm thứ 7, Chủ nhật nên không cần xin nghỉ');
  canHoSo(nguoiDung);

  const id = await chayVoiThuLai(() => chayTransaction(async (ketNoi) => {
    const hoSo = await khoaNhanVienTonTai(nguoiDung.nhanVienId, ketNoi);
    if (TRANG_THAI_KHONG_NGHI_PHEP.includes(hoSo.trangThaiLamViec)) {
      throw new LoiUngDung(409, 'Nhân viên đang tạm nghỉ hoặc đã nghỉ việc nên không thể tạo đơn nghỉ phép');
    }
    if (ngayBatDau < hoSo.ngayVaoLam) throw new LoiUngDung(400, 'Ngày bắt đầu nghỉ không được trước ngày vào làm');
    const loai = await nghiPhepRepository.layLoaiTheoId(loaiNghiPhepId, ketNoi, 'LOCK IN SHARE MODE');
    if (!loai) throw new LoiUngDung(400, 'Loại nghỉ phép không tồn tại');
    if (loai.trangThai !== 'DANG_AP_DUNG') throw new LoiUngDung(409, `Loại "${loai.tenLoai}" đã ngừng áp dụng`);
    if (loai.soNgayToiDa !== null && soNgayNghi > loai.soNgayToiDa) {
      throw new LoiUngDung(400, `Loại "${loai.tenLoai}" chỉ được nghỉ tối đa ${loai.soNgayToiDa} ngày mỗi đơn`);
    }
    await chanThangDaChot(ngayBatDau, ngayKetThuc, ketNoi);
    const chongLan = await nghiPhepRepository.timDonChongLan(hoSo.id, ngayBatDau, ngayKetThuc, ketNoi);
    if (chongLan) throw new LoiUngDung(409, `Khoảng ngày nghỉ trùng với đơn ${chongLan.maDon} đang chờ duyệt hoặc đã duyệt`);

    const nam = Number(ngayBatDau.slice(0, 4));
    const soMa = (await nghiPhepRepository.laySoMaLonNhat(nam, ketNoi)) + 1;
    if (loai.truVaoQuyPhepNam) {
      // Quỹ còn lại = tổng - đã nghỉ - các đơn đang chờ duyệt (giữ chỗ để không xin vượt quỹ bằng nhiều đơn)
      const quy = await nghiPhepRepository.layQuy(hoSo.id, nam, ketNoi, true);
      if (!quy) throw new LoiUngDung(409, `Bạn chưa được cấp quỹ phép năm ${nam}, liên hệ phòng Nhân sự`);
      const choDuyet = await nghiPhepRepository.demNgayChoDuyetTrongNam(hoSo.id, nam, null, ketNoi);
      const conLai = quy.tongSoNgayPhep - quy.soNgayDaNghi - choDuyet;
      if (soNgayNghi > conLai) {
        throw new LoiUngDung(409, `Quỹ phép năm ${nam} chỉ còn ${conLai} ngày (đã trừ ${choDuyet} ngày đang chờ duyệt)`);
      }
    }
    return nghiPhepRepository.themDon({
      maDon: `DNP${nam}-${String(soMa).padStart(4, '0')}`,
      nhanVienId: hoSo.id, loaiNghiPhepId, ngayBatDau, ngayKetThuc, soNgayNghi, lyDo, phuongThucTao,
    }, ketNoi);
  }));
  const cay = await phongBanRepository.layCayPhongBan();
  return themThongTinDuyet(await kemQuyenTuDuyet(nguoiDung), await nghiPhepRepository.layDonTheoId(id), cay);
}

// Người gửi tự hủy đơn khi còn chờ duyệt (đơn chưa trừ quỹ nên không cần hoàn)
async function huyDon(nguoiDung, id, diaChiIP) {
  canHoSo(nguoiDung);
  await chayTransaction(async (ketNoi) => {
    await khoaNhanVienTonTai(nguoiDung.nhanVienId, ketNoi);
    const don = await nghiPhepRepository.khoaDon(id, ketNoi);
    if (!don || don.nhanVienId !== nguoiDung.nhanVienId) throw new LoiUngDung(404, 'Không tìm thấy đơn nghỉ phép của bạn');
    if (don.trangThai !== 'CHO_DUYET') throw new LoiUngDung(409, 'Chỉ hủy được đơn đang chờ duyệt');
    await nghiPhepRepository.capNhatTrangThaiDon(id, { trangThai: 'DA_HUY' }, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'HUY_DON_NGHI_PHEP', diaChiIP ?? null, `Đơn #${id}`, ketNoi);
  });
  return { ...(await nghiPhepRepository.layDonTheoId(id)), nguoiDuyetDuKien: null, duocDuyet: false };
}

function layBoLocKhoang({ thang, trang, kichThuoc, ...boLoc }) {
  const khoang = thang ? khoangNgayCuaThang(thang) : {};
  return { ...boLoc, tuNgay: khoang.tuNgay, denNgay: khoang.denNgay, viTri: (trang - 1) * kichThuoc, soLuong: kichThuoc };
}

async function layDonCuaToi(nguoiDung, boLoc) {
  canHoSo(nguoiDung);
  const { items, tongSo } = await nghiPhepRepository.layDanhSachDon(layBoLocKhoang({ ...boLoc, nhanVienId: nguoiDung.nhanVienId }));
  const cay = await phongBanRepository.layCayPhongBan();
  const nguoiXem = await kemQuyenTuDuyet(nguoiDung);
  return { items: items.map((d) => themThongTinDuyet(nguoiXem, d, cay)), phanTrang: { trang: boLoc.trang, kichThuoc: boLoc.kichThuoc, tongSo } };
}

// HR, giamDoc toàn công ty; quanLy phòng mình phụ trách. Mỗi dòng có duocDuyet theo chuỗi duyệt
async function layDanhSachDon(nguoiDung, boLoc) {
  const phamViPhongBanIds = await layPhamVi(nguoiDung);
  const { items, tongSo } = await nghiPhepRepository.layDanhSachDon(layBoLocKhoang({ ...boLoc, phamViPhongBanIds }));
  const cay = await phongBanRepository.layCayPhongBan();
  const nguoiXem = await kemQuyenTuDuyet(nguoiDung);
  return { items: items.map((d) => themThongTinDuyet(nguoiXem, d, cay)), phanTrang: { trang: boLoc.trang, kichThuoc: boLoc.kichThuoc, tongSo } };
}

// Lịch nghỉ tháng: đơn đã duyệt + chờ duyệt có ngày nghỉ trong tháng
const SO_DON_TOI_DA_LICH = 1000;
async function layLichNghi(nguoiDung, { thang, phongBanId }) {
  const { tuNgay, denNgay } = khoangNgayCuaThang(thang);
  const { items, tongSo } = await nghiPhepRepository.layDanhSachDon({
    phamViPhongBanIds: await layPhamVi(nguoiDung), phongBanId, cacTrangThai: ['CHO_DUYET', 'DA_DUYET'],
    tuNgay, denNgay, viTri: 0, soLuong: SO_DON_TOI_DA_LICH,
  });
  const cay = await phongBanRepository.layCayPhongBan();
  const nguoiXem = await kemQuyenTuDuyet(nguoiDung);
  return { thang, tuNgay, denNgay, items: items.map((d) => themThongTinDuyet(nguoiXem, d, cay)), biCat: tongSo > items.length };
}

async function kiemTraTruocKhiDuyet(nguoiDung, id) {
  const don = await nghiPhepRepository.layDonTheoId(id);
  if (!don) throw new LoiUngDung(404, 'Không tìm thấy đơn nghỉ phép');
  const phamVi = await layPhamVi(nguoiDung);
  if (phamVi && !phamVi.includes(don.phongBanId)) throw new LoiUngDung(404, 'Không tìm thấy đơn nghỉ phép');
  kiemTraQuyenTrenDon(nguoiDung, don, await phongBanRepository.layCayPhongBan());
  return don;
}

// Trong transaction: kiểm tra lại chuỗi duyệt trên hồ sơ đã khóa (người gửi có thể vừa bị điều chuyển,
// trưởng bộ phận có thể vừa thay đổi) rồi mới khóa đơn
async function khoaDonChoDuyet(nguoiDungGoc, don, ketNoi) {
  const hoSo = await khoaNhanVienTonTai(don.nhanVienId, ketNoi);
  const nguoiDung = await kemQuyenTuDuyet(nguoiDungGoc, ketNoi);
  kiemTraQuyenTrenDon(nguoiDung, { ...don, phongBanId: hoSo.phongBanId }, await phongBanRepository.layCayPhongBan(ketNoi));
  const donKhoa = await nghiPhepRepository.khoaDon(don.id, ketNoi);
  if (!donKhoa) throw new LoiUngDung(404, 'Không tìm thấy đơn nghỉ phép');
  if (donKhoa.trangThai !== 'CHO_DUYET') throw new LoiUngDung(409, 'Đơn này đã được xử lý hoặc đã bị hủy');
  return { hoSo, donKhoa };
}

async function traVeSauXuLy(nguoiDung, id) {
  return themThongTinDuyet(nguoiDung, await nghiPhepRepository.layDonTheoId(id), await phongBanRepository.layCayPhongBan());
}

// Duyệt (transaction): đơn DA_DUYET + cộng quyngayphep.soNgayDaNghi nếu loại trừ quỹ phép năm
async function duyetDon(nguoiDungGoc, id, diaChiIP) {
  const nguoiDung = await kemQuyenTuDuyet(nguoiDungGoc);
  const don = await kiemTraTruocKhiDuyet(nguoiDung, id);
  await chayTransaction(async (ketNoi) => {
    const { hoSo, donKhoa } = await khoaDonChoDuyet(nguoiDung, don, ketNoi);
    if (hoSo.trangThaiLamViec === 'DA_NGHI_VIEC') throw new LoiUngDung(409, 'Nhân viên đã nghỉ việc, chỉ có thể từ chối đơn');
    await chanThangDaChot(donKhoa.ngayBatDau, donKhoa.ngayKetThuc, ketNoi);
    const loai = await nghiPhepRepository.layLoaiTheoId(donKhoa.loaiNghiPhepId, ketNoi);
    if (loai.truVaoQuyPhepNam) {
      const nam = Number(donKhoa.ngayBatDau.slice(0, 4));
      const quy = await nghiPhepRepository.layQuy(hoSo.id, nam, ketNoi, true);
      if (!quy) throw new LoiUngDung(409, `Nhân viên chưa được cấp quỹ phép năm ${nam}`);
      const conLai = quy.tongSoNgayPhep - quy.soNgayDaNghi;
      if (donKhoa.soNgayNghi > conLai) throw new LoiUngDung(409, `Quỹ phép năm ${nam} của nhân viên chỉ còn ${conLai} ngày`);
      await nghiPhepRepository.congNgayDaNghi(quy.id, donKhoa.soNgayNghi, ketNoi);
    }
    await nghiPhepRepository.capNhatTrangThaiDon(id, { trangThai: 'DA_DUYET', nguoiDuyetId: nguoiDung.nhanVienId }, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'DUYET_DON_NGHI_PHEP', diaChiIP ?? null,
      `${don.maDon} của ${hoSo.maNhanVien}${hoSo.id === nguoiDung.nhanVienId ? ' (tự duyệt: không còn giám đốc khác)' : ''}`, ketNoi);
  });
  return traVeSauXuLy(nguoiDung, id);
}

async function tuChoiDon(nguoiDungGoc, id, { lyDoTuChoi }, diaChiIP) {
  const nguoiDung = await kemQuyenTuDuyet(nguoiDungGoc);
  const don = await kiemTraTruocKhiDuyet(nguoiDung, id);
  await chayTransaction(async (ketNoi) => {
    const { hoSo } = await khoaDonChoDuyet(nguoiDung, don, ketNoi);
    await nghiPhepRepository.capNhatTrangThaiDon(id, {
      trangThai: 'TU_CHOI', nguoiDuyetId: nguoiDung.nhanVienId, lyDoTuChoi: lyDoTuChoi.trim(),
    }, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'TU_CHOI_DON_NGHI_PHEP', diaChiIP ?? null, `${don.maDon} của ${hoSo.maNhanVien}`, ketNoi);
  });
  return traVeSauXuLy(nguoiDung, id);
}

module.exports = {
  xacDinhNguoiDuyet,
  layDanhSachLoai,
  themLoai,
  suaLoai,
  layQuyCuaToi,
  layDanhSachQuy,
  capQuyNam,
  suaQuy,
  taoDon,
  huyDon,
  layDonCuaToi,
  layDanhSachDon,
  layLichNghi,
  duyetDon,
  tuChoiDon,
};
