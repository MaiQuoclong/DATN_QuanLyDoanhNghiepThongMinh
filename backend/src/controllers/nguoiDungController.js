const nguoiDungService = require('../services/nguoiDungService');
const { thanhCong } = require('../utils/phanHoi');
const { laySoNguyenDuong, layNgay, layGiaTriTrongDanhSach, layTuKhoa, layPhanTrang } = require('../utils/thamSoTruyVan');

function layId(req) {
  return laySoNguyenDuong(req.params.id, undefined, 'Mã tài khoản');
}

async function layDanhSachTaiKhoan(req, res) {
  const ketQua = await nguoiDungService.layDanhSachTaiKhoan({
    tuKhoa: layTuKhoa(req.query.tuKhoa),
    trangThai: layGiaTriTrongDanhSach(req.query.trangThai, nguoiDungService.TRANG_THAI_TAI_KHOAN, 'Trạng thái'),
    maVaiTro: layGiaTriTrongDanhSach(req.query.vaiTro, nguoiDungService.MA_VAI_TRO, 'Vai trò'),
    ...layPhanTrang(req.query),
  });
  return thanhCong(res, ketQua, 'Lấy danh sách tài khoản thành công');
}

async function layChiTietTaiKhoan(req, res) {
  const taiKhoan = await nguoiDungService.layTaiKhoan(layId(req));
  return thanhCong(res, taiKhoan, 'Lấy thông tin tài khoản thành công');
}

async function layDanhSachVaiTro(req, res) {
  const dsVaiTro = await nguoiDungService.layDanhSachVaiTro();
  return thanhCong(res, dsVaiTro, 'Lấy danh sách vai trò thành công');
}

async function datLaiMatKhau(req, res) {
  const ketQua = await nguoiDungService.datLaiMatKhau(req.nguoiDung, layId(req), req.ip);
  res.set('Cache-Control', 'no-store'); // response chứa mật khẩu tạm
  return thanhCong(res, ketQua, 'Cấp mật khẩu tạm thành công, mật khẩu hết hạn sau 24 giờ');
}

async function khoaTaiKhoan(req, res) {
  const taiKhoan = await nguoiDungService.khoaTaiKhoan(req.nguoiDung, layId(req), req.body?.lyDo, req.ip);
  return thanhCong(res, taiKhoan, 'Khóa tài khoản thành công');
}

async function moKhoaTaiKhoan(req, res) {
  const taiKhoan = await nguoiDungService.moKhoaTaiKhoan(req.nguoiDung, layId(req), req.body?.lyDo, req.ip);
  return thanhCong(res, taiKhoan, 'Mở khóa tài khoản thành công');
}

async function capNhatVaiTro(req, res) {
  const taiKhoan = await nguoiDungService.capNhatVaiTro(req.nguoiDung, layId(req), req.body?.vaiTro, req.ip);
  return thanhCong(res, taiKhoan, 'Cập nhật vai trò thành công');
}

async function layNhatKyHeThong(req, res) {
  const ketQua = await nguoiDungService.layNhatKy({
    nguoiDungId: laySoNguyenDuong(req.query.nguoiDungId, undefined, 'Người dùng'),
    hanhDong: typeof req.query.hanhDong === 'string' && req.query.hanhDong ? req.query.hanhDong.slice(0, 100) : undefined,
    tuNgay: layNgay(req.query.tuNgay, 'Từ ngày'),
    denNgay: layNgay(req.query.denNgay, 'Đến ngày'),
    ...layPhanTrang(req.query),
  });
  return thanhCong(res, ketQua, 'Lấy nhật ký hệ thống thành công');
}

module.exports = {
  layDanhSachTaiKhoan,
  layChiTietTaiKhoan,
  layDanhSachVaiTro,
  datLaiMatKhau,
  khoaTaiKhoan,
  moKhoaTaiKhoan,
  capNhatVaiTro,
  layNhatKyHeThong,
};
