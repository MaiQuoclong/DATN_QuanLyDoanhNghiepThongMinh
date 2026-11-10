const LoiUngDung = require('../utils/LoiUngDung');
const { chayTransaction } = require('../config/ketNoiCsdl');
const nhanVienRepository = require('../repositories/nhanVienRepository');
const nguoiDungRepository = require('../repositories/nguoiDungRepository');
const phongBanRepository = require('../repositories/phongBanRepository');
const hopDongRepository = require('../repositories/hopDongRepository');
const { themNhatKy, layHanhDongGanNhat } = require('../repositories/nhatKyRepository');
const { taoMatKhauTam, bamMatKhau } = require('../utils/matKhauTam');
const { TRANG_THAI_LAM_VIEC } = require('../utils/trangThai');

const TUOI_LAO_DONG_TOI_THIEU = 15; // Bộ luật Lao động 2019: người lao động từ đủ 15 tuổi
const TUOI_TOI_DA = 80; // chặn ngày sinh nhập nhầm (vd. 1800-01-01)
const SO_NGAY_VAO_LAM_TRUOC_TOI_DA = 180; // ngày vào làm không quá nửa năm sau hôm nay
// Máy trạng thái lao động: chính thức không quay về thử việc (kể cả đi vòng qua TAM_NGHI);
// nghỉ việc chỉ quay lại khi tái tuyển
const CHUYEN_TRANG_THAI_HOP_LE = {
  THU_VIEC: ['CHINH_THUC', 'TAM_NGHI', 'DA_NGHI_VIEC'],
  CHINH_THUC: ['TAM_NGHI', 'DA_NGHI_VIEC'],
  TAM_NGHI: ['CHINH_THUC', 'DA_NGHI_VIEC'],
  DA_NGHI_VIEC: ['THU_VIEC', 'CHINH_THUC'],
};
// Tài khoản cấp cao: HR không được khóa qua nghiệp vụ nghỉ việc (docs/phan-quyen.md mục 1, quy tắc 9)
const VAI_TRO_CAP_CAO = ['Admin', 'giamDoc', 'HR'];
// Nhật ký khóa/mở tài khoản ghi theo người bị tác động (giống RESET_MAT_KHAU_TAM) để biết lần khóa gần nhất do đâu
const HANH_DONG_KHOA_MO = ['KHOA_TAI_KHOAN', 'MO_KHOA_TAI_KHOAN', 'KHOA_TAI_KHOAN_NGHI_VIEC', 'MO_KHOA_TAI_KHOAN_NGHI_VIEC'];
const COT_NGAN_HANG = ['soTaiKhoanNganHang', 'tenNganHang'];
const COT_TAI_KHOAN = ['nguoiDungId', 'tenDangNhap', 'email', 'trangThaiTaiKhoan'];
const COT_KHONG_DUOC_RONG = ['hoVaTen', 'gioiTinh', 'ngaySinh', 'ngayVaoLam'];
const COT_HO_SO_HR = ['hoVaTen', 'gioiTinh', 'ngaySinh', 'soDienThoai', 'diaChi', 'soTaiKhoanNganHang', 'tenNganHang', 'ngayVaoLam'];
const COT_HO_SO_CA_NHAN = ['soDienThoai', 'diaChi', 'soTaiKhoanNganHang', 'tenNganHang'];

function xemToanCongTy(vaiTro) {
  return vaiTro.includes('HR') || vaiTro.includes('giamDoc');
}

// quanLy chỉ xem hồ sơ cơ bản: ẩn ngân hàng (quy tắc 6) và thông tin tài khoản
function locHoSo(hoSo, xemDayDu) {
  if (xemDayDu) return hoSo;
  const ketQua = { ...hoSo };
  [...COT_NGAN_HANG, ...COT_TAI_KHOAN].forEach((cot) => delete ketQua[cot]);
  return ketQua;
}

// Chuỗi rỗng = xóa giá trị (null); chỉ giữ các trường có gửi lên
function chonTruong(body, danhSachCot) {
  const truong = {};
  for (const cot of danhSachCot) {
    if (body[cot] === undefined) continue;
    const giaTri = typeof body[cot] === 'string' ? body[cot].trim() : body[cot];
    if (giaTri === '' || giaTri === null) {
      if (COT_KHONG_DUOC_RONG.includes(cot)) throw new LoiUngDung(400, `Trường ${cot} không được để trống`);
      truong[cot] = null;
    } else {
      truong[cot] = giaTri;
    }
  }
  return truong;
}

function congNam(ngay, soNam) {
  return `${Number(ngay.slice(0, 4)) + soNam}${ngay.slice(4)}`;
}

function ngayHomNayCong(soNgay) {
  const ngay = new Date();
  ngay.setDate(ngay.getDate() + soNgay);
  return ngay.toLocaleDateString('sv-SE'); // YYYY-MM-DD theo giờ máy chủ
}

function kiemTraNgayHoSo(ngaySinh, ngayVaoLam) {
  if (congNam(ngaySinh, TUOI_LAO_DONG_TOI_THIEU) > ngayVaoLam) {
    throw new LoiUngDung(400, `Nhân viên phải đủ ${TUOI_LAO_DONG_TOI_THIEU} tuổi tại ngày vào làm`);
  }
  if (congNam(ngaySinh, TUOI_TOI_DA) < ngayVaoLam) {
    throw new LoiUngDung(400, 'Ngày sinh không hợp lệ');
  }
  if (ngayVaoLam > ngayHomNayCong(SO_NGAY_VAO_LAM_TRUOC_TOI_DA)) {
    throw new LoiUngDung(400, `Ngày vào làm không được sau hôm nay quá ${SO_NGAY_VAO_LAM_TRUOC_TOI_DA} ngày`);
  }
}

// Nhật ký thay đổi: dữ liệu cá nhân nhạy cảm che bớt (số tài khoản, SĐT giữ 4 số cuối; địa chỉ, ngân hàng chỉ ghi tên cột)
const COT_CHE_SO = ['soTaiKhoanNganHang', 'soDienThoai'];
const COT_CHI_GHI_TEN = ['diaChi', 'tenNganHang'];
const KHONG_DOI = 'không có trường nào thay đổi';
function moTaThayDoi(hoSoCu, truong) {
  const che = (giaTri) => (giaTri ? `****${String(giaTri).slice(-4)}` : 'trống');
  // Bỏ trường gửi lên nhưng giữ nguyên giá trị cũ để nhật ký không ghi sai "đã thay đổi"
  const cotDoi = Object.keys(truong).filter((cot) => String(hoSoCu[cot] ?? '') !== String(truong[cot] ?? ''));
  if (cotDoi.length === 0) return KHONG_DOI;
  return cotDoi
    .map((cot) => {
      if (COT_CHE_SO.includes(cot)) return `${cot}: ${che(hoSoCu[cot])} -> ${che(truong[cot])}`;
      if (COT_CHI_GHI_TEN.includes(cot)) return `${cot}: đã thay đổi`;
      return `${cot}: ${hoSoCu[cot] ?? 'trống'} -> ${truong[cot] ?? 'trống'}`;
    })
    .join('; ');
}

// Vị trí phải đang áp dụng, phòng ban/chức danh đang hoạt động và còn định biên
// Khóa phòng ban của vị trí trước (thứ tự phongban -> chucdanhphongban); luồng đã khóa sẵn thì khóa lại không tốn thêm
async function kiemTraViTriTrong(chucDanhPhongBanId, boQuaNhanVienId, ketNoi) {
  await phongBanRepository.khoaCacPhongBan([await phongBanRepository.layPhongBanCuaViTri(chucDanhPhongBanId)], ketNoi);
  const viTri = await phongBanRepository.khoaViTri(chucDanhPhongBanId, ketNoi);
  if (!viTri) throw new LoiUngDung(404, 'Không tìm thấy vị trí (chức danh trong phòng ban)');
  if (viTri.trangThai !== 'DANG_AP_DUNG' || viTri.trangThaiPhongBan !== 'DANG_HOAT_DONG' || viTri.trangThaiChucDanh !== 'DANG_HOAT_DONG') {
    throw new LoiUngDung(409, 'Vị trí, phòng ban hoặc chức danh đã ngừng hoạt động');
  }
  const daCo = await nhanVienRepository.demTheoViTri(chucDanhPhongBanId, boQuaNhanVienId, ketNoi);
  if (daCo >= viTri.dinhBien) {
    throw new LoiUngDung(409, `Vị trí ${viTri.tenChucDanh} - ${viTri.tenPhongBan} đã đủ định biên (${viTri.dinhBien} người)`);
  }
  return viTri;
}

async function layHoSoHoacLoi(id, ketNoi) {
  const hoSo = await nhanVienRepository.layTheoId(id, ketNoi);
  if (!hoSo) throw new LoiUngDung(404, 'Không tìm thấy nhân viên');
  return hoSo;
}

// Khóa dòng nhân viên (câu đọc có khóa đầu tiên của transaction) rồi mới đọc hồ sơ mới nhất
async function khoaVaLayHoSo(id, ketNoi) {
  if (!(await nhanVienRepository.khoaNhanVien(id, ketNoi))) throw new LoiUngDung(404, 'Không tìm thấy nhân viên');
  return layHoSoHoacLoi(id, ketNoi);
}

// Luồng có thể chạm phongban (kiểm tra trưởng bộ phận, khóa vị trí): khóa phongban trước rồi mới nhanvien,
// cùng thứ tự với ngừng phòng ban / bổ nhiệm (phongBanRepository.khoaCacPhongBan) để tránh deadlock.
// Trưởng bộ phận luôn thuộc chính phòng đó nên chỉ cần khóa phòng hiện tại (+ phòng đích khi điều chuyển).
// Đọc trước bằng pool (ngoài transaction) để khoaNhanVien vẫn là câu đọc đầu tiên, không chốt ảnh chụp cũ.
// Vị trí (cũ + đích) cũng khóa trước nhanvien, theo id tăng dần.
async function khoaPhongBanRoiHoSo(id, viTriDich, ketNoi) {
  const truoc = await nhanVienRepository.layTheoId(id);
  if (!truoc) throw new LoiUngDung(404, 'Không tìm thấy nhân viên');
  // Kèm các phòng đang làm trưởng (phòng ngừa dữ liệu cũ có trưởng không thuộc phòng)
  const phongLamTruong = await phongBanRepository.layIdPhongBanLamTruong(id);
  await phongBanRepository.khoaCacPhongBan([truoc.phongBanId, viTriDich?.phongBanId, ...phongLamTruong], ketNoi);
  const viTriIds = [...new Set([truoc.chucDanhPhongBanId, viTriDich?.id].filter(Boolean))].sort((a, b) => a - b);
  for (const viTriId of viTriIds) await phongBanRepository.khoaViTri(viTriId, ketNoi);
  const hoSo = await khoaVaLayHoSo(id, ketNoi);
  if (hoSo.phongBanId !== truoc.phongBanId || hoSo.chucDanhPhongBanId !== truoc.chucDanhPhongBanId) {
    throw new LoiUngDung(409, 'Hồ sơ nhân viên vừa được người khác thay đổi, vui lòng tải lại và thử lại');
  }
  return hoSo;
}

// HR không sửa hồ sơ của chính mình (docs/phan-quyen.md quy tắc 1)
function chanTuSua(nguoiDung, nhanVienId) {
  if (nguoiDung.nhanVienId === nhanVienId) {
    throw new LoiUngDung(403, 'Bạn không được tự thay đổi hồ sơ của chính mình, hãy nhờ HR khác thực hiện');
  }
}

async function chanNeuLaTruongBoPhan(nhanVienId, phongBanGiuLaiId, ketNoi) {
  const phongLamTruong = await phongBanRepository.layPhongBanLamTruong(nhanVienId, ketNoi);
  const phongBiBoTrong = phongLamTruong.filter((p) => p.id !== phongBanGiuLaiId);
  if (phongBiBoTrong.length) {
    throw new LoiUngDung(
      409,
      `Nhân viên đang là trưởng bộ phận ${phongBiBoTrong.map((p) => p.tenPhongBan).join(', ')}, cần bổ nhiệm người thay thế trước`,
    );
  }
}

async function layDanhSach(nguoiDung, boLoc) {
  let phamViPhongBanIds = null;
  if (!xemToanCongTy(nguoiDung.vaiTro)) {
    phamViPhongBanIds = await phongBanRepository.layPhongBanQuanLy(nguoiDung.nhanVienId ?? 0);
  }
  const { trang, kichThuoc } = boLoc;
  const { items, tongSo } = await nhanVienRepository.layDanhSach({
    ...boLoc,
    phamViPhongBanIds,
    viTri: (trang - 1) * kichThuoc,
    soLuong: kichThuoc,
  });
  return { items, phanTrang: { trang, kichThuoc, tongSo } };
}

async function layChiTiet(nguoiDung, id) {
  const hoSo = await layHoSoHoacLoi(id);
  const laMinh = nguoiDung.nhanVienId === hoSo.id;
  const toanCongTy = xemToanCongTy(nguoiDung.vaiTro);
  let duocXem = laMinh || toanCongTy;
  if (!duocXem && nguoiDung.vaiTro.includes('quanLy') && nguoiDung.nhanVienId) {
    const phamVi = await phongBanRepository.layPhongBanQuanLy(nguoiDung.nhanVienId);
    duocXem = phamVi.includes(hoSo.phongBanId);
  }
  // Ngoài phạm vi trả 404 như id không tồn tại: không để lộ id nào là hồ sơ có thật
  if (!duocXem) throw new LoiUngDung(404, 'Không tìm thấy nhân viên');
  const ketQua = locHoSo(hoSo, laMinh || toanCongTy);
  // Vai trò tài khoản chỉ trả cho người xem toàn công ty: giao diện ẩn nút "Cấp mật khẩu tạm"
  // khi HR mở hồ sơ người có vai trò cấp cao (backend vẫn chặn 403 ở nguoiDungService.datLaiMatKhau)
  if (toanCongTy && hoSo.nguoiDungId) {
    ketQua.vaiTroTaiKhoan = await nguoiDungRepository.layDanhSachVaiTro(hoSo.nguoiDungId);
  }
  return ketQua;
}

async function layHoSoCuaToi(nguoiDung) {
  if (!nguoiDung.nhanVienId) throw new LoiUngDung(404, 'Tài khoản chưa có hồ sơ nhân viên');
  return layHoSoHoacLoi(nguoiDung.nhanVienId);
}

// HR thêm nhân viên: tạo tài khoản (mật khẩu tạm, vai trò nhanVien) + hồ sơ trong một transaction.
// Mật khẩu tạm đánh dấu bằng RESET_MAT_KHAU_TAM trong nhatkyhethong -> bắt buộc đổi ở lần đăng nhập đầu, hết hạn sau 24 giờ.
async function themNhanVien(nguoiDung, body, diaChiIP) {
  const hoSo = chonTruong(body, COT_HO_SO_HR);
  hoSo.chucDanhPhongBanId = Number(body.chucDanhPhongBanId);
  hoSo.trangThaiLamViec = body.trangThaiLamViec || 'THU_VIEC';
  const tenDangNhap = body.tenDangNhap.trim().toLowerCase();
  const email = body.email.trim().toLowerCase();
  kiemTraNgayHoSo(hoSo.ngaySinh, hoSo.ngayVaoLam);

  const matKhauTam = taoMatKhauTam();
  const matKhauMaHoa = await bamMatKhau(matKhauTam);

  const nhanVienId = await chayTransaction(async (ketNoi) => {
    await kiemTraViTriTrong(hoSo.chucDanhPhongBanId, null, ketNoi);
    const trung = await nguoiDungRepository.timTheoTenHoacEmail(tenDangNhap, email, ketNoi);
    if (trung) {
      throw new LoiUngDung(409, trung.tenDangNhap === tenDangNhap ? 'Tên đăng nhập đã tồn tại' : 'Email đã được sử dụng');
    }

    const nguoiDungMoiId = await nguoiDungRepository.themNguoiDung({ tenDangNhap, email, matKhauMaHoa }, ketNoi);
    if ((await nguoiDungRepository.ganVaiTro(nguoiDungMoiId, 'nhanVien', ketNoi)) !== 1) {
      throw new Error('Không tìm thấy vai trò nhanVien trong bảng vaitro');
    }
    const soMa = (await nhanVienRepository.laySoMaLonNhat(ketNoi)) + 1;
    hoSo.maNhanVien = `NV${String(soMa).padStart(4, '0')}`;
    const idMoi = await nhanVienRepository.them(
      {
        soDienThoai: null,
        diaChi: null,
        soTaiKhoanNganHang: null,
        tenNganHang: null,
        ...hoSo,
        nguoiDungId: nguoiDungMoiId,
      },
      ketNoi,
    );

    await themNhatKy(nguoiDungMoiId, 'RESET_MAT_KHAU_TAM', diaChiIP, `Mật khẩu tạm khi tạo tài khoản ${hoSo.maNhanVien}`, ketNoi);
    await themNhatKy(nguoiDung.nguoiDungId, 'THEM_NHAN_VIEN', diaChiIP, `${hoSo.maNhanVien} - ${hoSo.hoVaTen} (${tenDangNhap})`, ketNoi);
    return idMoi;
  });

  return {
    nhanVien: await layHoSoHoacLoi(nhanVienId),
    // Chỉ trả một lần để HR bàn giao; hệ thống không lưu mật khẩu gốc
    taiKhoan: { tenDangNhap, matKhauTam },
  };
}

// Cập nhật + ghi nhật ký cùng transaction: không bao giờ có thay đổi hồ sơ mà thiếu dấu vết.
// Trả { hoSo, daThayDoi } để controller báo đúng khi người dùng bấm lưu mà không đổi gì
async function capNhatCoNhatKy(nguoiDung, id, truong, hanhDong, diaChiIP, kiemTraThem) {
  if (Object.keys(truong).length === 0) throw new LoiUngDung(400, 'Không có thông tin nào để cập nhật');
  const daThayDoi = await chayTransaction(async (ketNoi) => {
    const hoSo = await khoaVaLayHoSo(id, ketNoi);
    // Bấm lưu mà không đổi gì: không kiểm tra lại, không UPDATE, không ghi nhật ký rỗng
    const moTa = moTaThayDoi(hoSo, truong);
    if (moTa === KHONG_DOI) return false;
    if (kiemTraThem) await kiemTraThem(hoSo, ketNoi);
    await nhanVienRepository.capNhat(id, truong, ketNoi);
    await themNhatKy(nguoiDung.nguoiDungId, hanhDong, diaChiIP, `${hoSo.maNhanVien}: ${moTa}`, ketNoi);
    return true;
  });
  return { hoSo: await layHoSoHoacLoi(id), daThayDoi };
}

// Mọi người tự sửa SĐT, địa chỉ, ngân hàng của mình
async function capNhatHoSoCuaToi(nguoiDung, body, diaChiIP) {
  if (!nguoiDung.nhanVienId) throw new LoiUngDung(404, 'Tài khoản chưa có hồ sơ nhân viên');
  const truong = chonTruong(body, COT_HO_SO_CA_NHAN);
  return capNhatCoNhatKy(nguoiDung, nguoiDung.nhanVienId, truong, 'CAP_NHAT_HO_SO_CA_NHAN', diaChiIP);
}

// HR sửa thông tin hồ sơ (không gồm vị trí/trạng thái: dùng điều chuyển/đổi trạng thái)
async function capNhatHoSo(nguoiDung, id, body, diaChiIP) {
  chanTuSua(nguoiDung, id);
  const truong = chonTruong(body, COT_HO_SO_HR);
  return capNhatCoNhatKy(nguoiDung, id, truong, 'SUA_NHAN_VIEN', diaChiIP, async (hoSo, ketNoi) => {
    // Chỉ kiểm tra ngày thực sự đổi: form gửi lại ngày cũ không bị chặn bởi dữ liệu có sẵn
    const doiNgaySinh = truong.ngaySinh !== undefined && String(truong.ngaySinh ?? '') !== String(hoSo.ngaySinh ?? '');
    const doiNgayVaoLam = truong.ngayVaoLam !== undefined && String(truong.ngayVaoLam ?? '') !== String(hoSo.ngayVaoLam ?? '');
    if (doiNgaySinh || doiNgayVaoLam) {
      kiemTraNgayHoSo(truong.ngaySinh ?? hoSo.ngaySinh, truong.ngayVaoLam ?? hoSo.ngayVaoLam);
    }
    // Hợp đồng không được bắt đầu trước ngày vào làm (đã khóa dòng nhân viên nên không có hợp đồng mới chen vào)
    if (doiNgayVaoLam) {
      const ngayHopDongSomNhat = await hopDongRepository.layNgayBatDauSomNhat(id, ketNoi);
      if (ngayHopDongSomNhat && ngayHopDongSomNhat < truong.ngayVaoLam) {
        throw new LoiUngDung(409, `Ngày vào làm không được sau ngày bắt đầu hợp đồng sớm nhất (${ngayHopDongSomNhat})`);
      }
    }
  });
}

// Đổi trạng thái lao động theo máy trạng thái.
// Nghỉ việc -> khóa tài khoản. Quay lại làm việc -> chỉ mở khóa nếu lần khóa gần nhất là do nghỉ việc
// (tài khoản Admin chủ động khóa vì lý do khác thì giữ nguyên).
async function doiTrangThai(nguoiDung, id, { trangThaiLamViec, lyDo }, diaChiIP) {
  chanTuSua(nguoiDung, id);
  return chayTransaction(async (ketNoi) => {
    const hoSo = await khoaPhongBanRoiHoSo(id, null, ketNoi);
    const trangThaiCu = hoSo.trangThaiLamViec;
    if (trangThaiCu === trangThaiLamViec) throw new LoiUngDung(400, 'Nhân viên đã ở trạng thái này');
    if (!(CHUYEN_TRANG_THAI_HOP_LE[trangThaiCu] ?? []).includes(trangThaiLamViec)) {
      throw new LoiUngDung(400, `Không thể chuyển trạng thái từ ${trangThaiCu} sang ${trangThaiLamViec}`);
    }

    const nghiViec = trangThaiLamViec === 'DA_NGHI_VIEC';
    const quayLaiLamViec = trangThaiCu === 'DA_NGHI_VIEC';
    // Trưởng bộ phận tạm nghỉ/nghỉ việc thì phòng ban mất người duyệt -> giamDoc phải bổ nhiệm người khác trước
    if (nghiViec || trangThaiLamViec === 'TAM_NGHI') await chanNeuLaTruongBoPhan(id, null, ketNoi);
    if (nghiViec) {
      if (hoSo.nguoiDungId && !nguoiDung.vaiTro.includes('Admin')) {
        const vaiTroDich = await nguoiDungRepository.layDanhSachVaiTro(hoSo.nguoiDungId, ketNoi);
        if (vaiTroDich.some((vt) => VAI_TRO_CAP_CAO.includes(vt))) {
          throw new LoiUngDung(403, 'Nhân viên có vai trò Admin/giamDoc/HR, cần Admin thu hồi vai trò trước khi cho nghỉ việc');
        }
      }
    }
    if (quayLaiLamViec) await kiemTraViTriTrong(hoSo.chucDanhPhongBanId, id, ketNoi);

    await nhanVienRepository.capNhat(id, { trangThaiLamViec }, ketNoi);
    // Khóa dòng nguoidung rồi đọc lại trạng thái, tránh ghi đè thao tác khóa/mở tài khoản chạy song song
    if (hoSo.nguoiDungId) {
      hoSo.trangThaiTaiKhoan = await nguoiDungRepository.khoaVaLayTrangThai(hoSo.nguoiDungId, ketNoi);
    }
    if (hoSo.nguoiDungId && nghiViec && hoSo.trangThaiTaiKhoan !== 'KHOA') {
      await nguoiDungRepository.capNhatTrangThai(hoSo.nguoiDungId, 'KHOA', ketNoi);
      await themNhatKy(hoSo.nguoiDungId, 'KHOA_TAI_KHOAN_NGHI_VIEC', diaChiIP, hoSo.maNhanVien, ketNoi);
    } else if (hoSo.nguoiDungId && quayLaiLamViec && hoSo.trangThaiTaiKhoan === 'KHOA') {
      const lanGanNhat = await layHanhDongGanNhat(hoSo.nguoiDungId, HANH_DONG_KHOA_MO, ketNoi);
      if (lanGanNhat === 'KHOA_TAI_KHOAN_NGHI_VIEC') {
        await nguoiDungRepository.capNhatTrangThai(hoSo.nguoiDungId, 'DANG_HOAT_DONG', ketNoi);
        await themNhatKy(hoSo.nguoiDungId, 'MO_KHOA_TAI_KHOAN_NGHI_VIEC', diaChiIP, hoSo.maNhanVien, ketNoi);
      }
    }
    const chiTiet = `${hoSo.maNhanVien}: ${trangThaiCu} -> ${trangThaiLamViec}${lyDo ? `. Lý do: ${lyDo}` : ''}`;
    await themNhatKy(nguoiDung.nguoiDungId, 'DOI_TRANG_THAI_LAM_VIEC', diaChiIP, chiTiet, ketNoi);
    return nhanVienRepository.layTheoId(id, ketNoi);
  });
}

// Điều chuyển sang vị trí khác (đổi chucDanhPhongBanId)
async function dieuChuyen(nguoiDung, id, { chucDanhPhongBanId, lyDo }, diaChiIP) {
  chanTuSua(nguoiDung, id);
  const viTriMoiId = Number(chucDanhPhongBanId);
  return chayTransaction(async (ketNoi) => {
    // Đọc ngoài transaction: an toàn vì phongBanId của vị trí không sửa được (suaViTri chỉ đổi định biên/ghi chú/trạng thái).
    // Nếu sau này cho đổi phòng của vị trí thì phải đọc lại có khóa.
    const phongBanDichId = await phongBanRepository.layPhongBanCuaViTri(viTriMoiId);
    const hoSo = await khoaPhongBanRoiHoSo(id, phongBanDichId && { id: viTriMoiId, phongBanId: phongBanDichId }, ketNoi);
    // Người đã nghỉ việc vẫn được điều chuyển: để tái tuyển khi vị trí cũ đã đủ định biên hoặc đã ngừng
    // (kiemTraViTriTrong vẫn kiểm tra vị trí đích đang áp dụng và còn chỗ)
    if (hoSo.chucDanhPhongBanId === viTriMoiId) {
      throw new LoiUngDung(400, 'Nhân viên đang ở vị trí này');
    }
    const viTriMoi = await kiemTraViTriTrong(viTriMoiId, id, ketNoi);
    // Trưởng bộ phận rời phòng ban mình phụ trách sẽ làm sai phạm vi quanLy -> phải bổ nhiệm người khác trước
    await chanNeuLaTruongBoPhan(id, viTriMoi.phongBanId, ketNoi);

    await nhanVienRepository.capNhat(id, { chucDanhPhongBanId: viTriMoiId }, ketNoi);
    const chiTiet = `${hoSo.maNhanVien}: ${hoSo.tenChucDanh} - ${hoSo.tenPhongBan} -> ${viTriMoi.tenChucDanh} - ${viTriMoi.tenPhongBan}${lyDo ? `. Lý do: ${lyDo}` : ''}`;
    await themNhatKy(nguoiDung.nguoiDungId, 'DIEU_CHUYEN_NHAN_VIEN', diaChiIP, chiTiet, ketNoi);
    return nhanVienRepository.layTheoId(id, ketNoi);
  });
}

module.exports = {
  TRANG_THAI_LAM_VIEC,
  layDanhSach,
  layChiTiet,
  layHoSoCuaToi,
  themNhanVien,
  capNhatHoSoCuaToi,
  capNhatHoSo,
  doiTrangThai,
  dieuChuyen,
};
