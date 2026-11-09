const LoiUngDung = require('../utils/LoiUngDung');
const { chayTransaction } = require('../config/ketNoiCsdl');
const nguoiDungRepository = require('../repositories/nguoiDungRepository');
const phongBanRepository = require('../repositories/phongBanRepository');
const nhanVienRepository = require('../repositories/nhanVienRepository');
const { themNhatKy, layDanhSachNhatKy } = require('../repositories/nhatKyRepository');
const { taoMatKhauTam, bamMatKhau } = require('../utils/matKhauTam');
const { TRANG_THAI_TAI_KHOAN } = require('../utils/trangThai');

const MA_VAI_TRO = ['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien'];
// HR chỉ cấp mật khẩu tạm cho tài khoản không có các vai trò này (docs/phan-quyen.md quy tắc 9)
const VAI_TRO_CAP_CAO = ['Admin', 'giamDoc', 'HR'];

function chanTuThaoTac(nguoiDung, nguoiDungId, thongBao) {
  if (nguoiDung.nguoiDungId === nguoiDungId) throw new LoiUngDung(403, thongBao);
}

// Giữ thứ tự khóa phongban -> nhanvien -> nguoidung (giống bổ nhiệm, đổi trạng thái lao động) để tránh deadlock:
// đọc hồ sơ liên kết ngoài transaction, khóa phòng ban hiện tại + phòng đang làm trưởng, rồi nhân viên, rồi tài khoản.
async function khoaTaiKhoanHoacLoi(nguoiDungId, ketNoi) {
  const hoSo = await nguoiDungRepository.layHoSoLienKet(nguoiDungId);
  if (hoSo) {
    const phongLamTruong = await phongBanRepository.layIdPhongBanLamTruong(hoSo.nhanVienId);
    await phongBanRepository.khoaCacPhongBan([hoSo.phongBanId, ...phongLamTruong], ketNoi);
    await nhanVienRepository.khoaNhanVien(hoSo.nhanVienId, ketNoi);
    const sauKhiKhoa = await nhanVienRepository.layTheoId(hoSo.nhanVienId, ketNoi);
    if (sauKhiKhoa && sauKhiKhoa.phongBanId !== hoSo.phongBanId) {
      throw new LoiUngDung(409, 'Nhân viên vừa được điều chuyển, vui lòng tải lại và thử lại');
    }
  }
  const taiKhoan = await nguoiDungRepository.khoaTaiKhoan(nguoiDungId, ketNoi);
  if (!taiKhoan) throw new LoiUngDung(404, 'Không tìm thấy tài khoản');
  return taiKhoan;
}

// Hệ thống luôn phải còn ít nhất 1 Admin hoạt động, nếu không sẽ không ai quản trị được tài khoản
async function chanMatAdminCuoiCung(ketNoi) {
  if ((await nguoiDungRepository.demAdminHoatDong(ketNoi)) <= 1) {
    throw new LoiUngDung(409, 'Không thể thực hiện: hệ thống phải còn ít nhất một Admin đang hoạt động');
  }
}

async function layDanhSachTaiKhoan(boLoc) {
  const { trang, kichThuoc } = boLoc;
  const { items, tongSo } = await nguoiDungRepository.layDanhSachTaiKhoan(boLoc);
  return {
    items: items.map(({ dsVaiTro, ...taiKhoan }) => ({ ...taiKhoan, vaiTro: dsVaiTro ? dsVaiTro.split(',') : [] })),
    phanTrang: { trang, kichThuoc, tongSo },
  };
}

function layDanhSachVaiTro() {
  return nguoiDungRepository.layTatCaVaiTro();
}

// Cấp mật khẩu tạm: Admin cho mọi tài khoản, HR chỉ cho tài khoản không có vai trò cấp cao.
// Ghi RESET_MAT_KHAU_TAM theo người bị reset -> bắt buộc đổi ở lần đăng nhập tới, hết hạn sau 24 giờ,
// đồng thời là mốc thu hồi mọi token cũ của người đó.
async function datLaiMatKhau(nguoiDung, nguoiDungId, diaChiIP) {
  chanTuThaoTac(nguoiDung, nguoiDungId, 'Không tự cấp mật khẩu tạm cho mình, hãy dùng chức năng đổi mật khẩu');
  const matKhauTam = taoMatKhauTam();
  const matKhauMaHoa = await bamMatKhau(matKhauTam);

  const taiKhoan = await chayTransaction(async (ketNoi) => {
    const tk = await khoaTaiKhoanHoacLoi(nguoiDungId, ketNoi);
    if (!nguoiDung.vaiTro.includes('Admin')) {
      const vaiTroDich = await nguoiDungRepository.layDanhSachVaiTro(nguoiDungId, ketNoi);
      if (vaiTroDich.some((vt) => VAI_TRO_CAP_CAO.includes(vt))) {
        throw new LoiUngDung(403, 'HR chỉ được cấp mật khẩu tạm cho tài khoản nhân viên/quản lý, hãy liên hệ Admin');
      }
    }
    await nguoiDungRepository.capNhatMatKhau(nguoiDungId, matKhauMaHoa, ketNoi);
    await themNhatKy(nguoiDungId, 'RESET_MAT_KHAU_TAM', diaChiIP, `Cấp bởi nguoiDungId=${nguoiDung.nguoiDungId}`, ketNoi);
    await themNhatKy(nguoiDung.nguoiDungId, 'CAP_MAT_KHAU_TAM', diaChiIP, `Cho tài khoản ${tk.tenDangNhap}`, ketNoi);
    return tk;
  });

  return {
    tenDangNhap: taiKhoan.tenDangNhap,
    matKhauTam, // chỉ trả một lần để bàn giao; hệ thống không lưu mật khẩu gốc
    trangThai: taiKhoan.trangThai,
  };
}

// Admin khóa tài khoản (vd. nghi lộ mật khẩu). Ghi theo người bị khóa: là mốc thu hồi token
// và giúp luồng tái tuyển không tự mở khóa (xem nhanVienService.doiTrangThai).
async function khoaTaiKhoan(nguoiDung, nguoiDungId, lyDo, diaChiIP) {
  chanTuThaoTac(nguoiDung, nguoiDungId, 'Không thể tự khóa tài khoản của mình');
  await chayTransaction(async (ketNoi) => {
    const tk = await khoaTaiKhoanHoacLoi(nguoiDungId, ketNoi);
    if (tk.trangThai === 'KHOA') throw new LoiUngDung(400, 'Tài khoản đã bị khóa');
    const vaiTroDich = await nguoiDungRepository.layDanhSachVaiTro(nguoiDungId, ketNoi);
    if (vaiTroDich.includes('Admin')) await chanMatAdminCuoiCung(ketNoi);
    await nguoiDungRepository.capNhatTrangThai(nguoiDungId, 'KHOA', ketNoi);
    const chiTiet = `Bởi nguoiDungId=${nguoiDung.nguoiDungId}${lyDo ? `. Lý do: ${lyDo}` : ''}`;
    await themNhatKy(nguoiDungId, 'KHOA_TAI_KHOAN', diaChiIP, chiTiet, ketNoi);
  });
  return layTaiKhoan(nguoiDungId);
}

async function moKhoaTaiKhoan(nguoiDung, nguoiDungId, lyDo, diaChiIP) {
  chanTuThaoTac(nguoiDung, nguoiDungId, 'Không thể tự mở khóa tài khoản của mình');
  await chayTransaction(async (ketNoi) => {
    const tk = await khoaTaiKhoanHoacLoi(nguoiDungId, ketNoi);
    if (tk.trangThai !== 'KHOA') throw new LoiUngDung(400, 'Tài khoản đang hoạt động');
    // Người đã nghỉ việc phải được HR cho quay lại làm việc (kiểm tra định biên) thay vì mở khóa trực tiếp
    if (tk.trangThaiLamViec === 'DA_NGHI_VIEC') {
      throw new LoiUngDung(409, 'Nhân viên đã nghỉ việc, HR cần chuyển trạng thái quay lại làm việc trước');
    }
    await nguoiDungRepository.capNhatTrangThai(nguoiDungId, 'DANG_HOAT_DONG', ketNoi);
    const chiTiet = `Bởi nguoiDungId=${nguoiDung.nguoiDungId}${lyDo ? `. Lý do: ${lyDo}` : ''}`;
    await themNhatKy(nguoiDungId, 'MO_KHOA_TAI_KHOAN', diaChiIP, chiTiet, ketNoi);
  });
  return layTaiKhoan(nguoiDungId);
}

// Gán lại toàn bộ vai trò. Ai có hồ sơ nhân viên luôn giữ vai trò nhanVien (quy tắc 3).
async function capNhatVaiTro(nguoiDung, nguoiDungId, dsVaiTro, diaChiIP) {
  if (!Array.isArray(dsVaiTro) || dsVaiTro.some((vt) => !MA_VAI_TRO.includes(vt))) {
    throw new LoiUngDung(400, `Vai trò phải là mảng gồm các giá trị: ${MA_VAI_TRO.join(', ')}`);
  }
  const vaiTroMoi = new Set(dsVaiTro);

  await chayTransaction(async (ketNoi) => {
    const tk = await khoaTaiKhoanHoacLoi(nguoiDungId, ketNoi);
    if (tk.nhanVienId) vaiTroMoi.add('nhanVien');
    if (vaiTroMoi.size === 0) throw new LoiUngDung(400, 'Tài khoản phải có ít nhất một vai trò');

    const vaiTroCu = await nguoiDungRepository.layDanhSachVaiTro(nguoiDungId, ketNoi);
    // Admin không tự cấp thêm vai trò cho mình (tránh tự mở quyền xem lương/hợp đồng), chỉ được giữ hoặc bớt
    if (nguoiDung.nguoiDungId === nguoiDungId && [...vaiTroMoi].some((vt) => !vaiTroCu.includes(vt))) {
      throw new LoiUngDung(403, 'Không được tự cấp thêm vai trò cho chính mình');
    }
    if (vaiTroCu.includes('Admin') && !vaiTroMoi.has('Admin')) {
      if (nguoiDung.nguoiDungId === nguoiDungId) throw new LoiUngDung(403, 'Không thể tự gỡ vai trò Admin của mình');
      if (tk.trangThai === 'DANG_HOAT_DONG') await chanMatAdminCuoiCung(ketNoi);
    }

    // Trưởng bộ phận cần quanLy để dùng API phạm vi phòng mình: phải được giamDoc miễn nhiệm trước
    if (vaiTroCu.includes('quanLy') && !vaiTroMoi.has('quanLy') && tk.nhanVienId) {
      const phongLamTruong = await phongBanRepository.layPhongBanLamTruong(tk.nhanVienId, ketNoi);
      if (phongLamTruong.length) {
        throw new LoiUngDung(
          409,
          `Tài khoản đang là trưởng bộ phận ${phongLamTruong.map((p) => p.tenPhongBan).join(', ')}, cần giamDoc miễn nhiệm trước khi gỡ quanLy`,
        );
      }
    }

    const ds = [...vaiTroMoi];
    if ((await nguoiDungRepository.thayVaiTro(nguoiDungId, ds, ketNoi)) !== ds.length) {
      throw new Error('Số vai trò gán được không khớp bảng vaitro');
    }
    const chiTiet = `${tk.tenDangNhap}: ${vaiTroCu.join(',') || 'trống'} -> ${ds.join(',')}`;
    await themNhatKy(nguoiDung.nguoiDungId, 'PHAN_QUYEN', diaChiIP, chiTiet, ketNoi);
    // Ghi theo người bị tác động: đánh dấu vai trò do Admin quyết định -> luồng miễn nhiệm không tự gỡ quanLy.
    // Chỉ ghi khi Admin thực sự thêm/gỡ quanLy, đổi vai trò khác không làm mất cơ chế tự gỡ khi miễn nhiệm.
    if (vaiTroCu.includes('quanLy') !== vaiTroMoi.has('quanLy'))
      await themNhatKy(nguoiDungId, 'DUOC_PHAN_QUYEN', diaChiIP, `${ds.join(',')} bởi nguoiDungId=${nguoiDung.nguoiDungId}`, ketNoi);
  });
  return layTaiKhoan(nguoiDungId);
}

async function layTaiKhoan(nguoiDungId) {
  const [thongTin, vaiTro] = await Promise.all([
    nguoiDungRepository.layThongTin(nguoiDungId),
    nguoiDungRepository.layDanhSachVaiTro(nguoiDungId),
  ]);
  if (!thongTin) throw new LoiUngDung(404, 'Không tìm thấy tài khoản');
  return { ...thongTin, vaiTro };
}

async function layNhatKy(boLoc) {
  const { trang, kichThuoc } = boLoc;
  const { items, tongSo } = await layDanhSachNhatKy(boLoc);
  return { items, phanTrang: { trang, kichThuoc, tongSo } };
}

module.exports = {
  MA_VAI_TRO,
  TRANG_THAI_TAI_KHOAN,
  layDanhSachTaiKhoan,
  layDanhSachVaiTro,
  datLaiMatKhau,
  khoaTaiKhoan,
  moKhoaTaiKhoan,
  capNhatVaiTro,
  layTaiKhoan,
  layNhatKy,
};
