const xacThucService = require('../services/xacThucService');
const { thanhCong } = require('../utils/phanHoi');

async function dangNhap(req, res) {
  const { tenDangNhap, matKhau } = req.body;
  const ketQua = await xacThucService.dangNhap(tenDangNhap.trim(), matKhau, req.ip);
  return thanhCong(res, ketQua, 'Đăng nhập thành công');
}

async function layThongTinCaNhan(req, res) {
  const nguoiDung = await xacThucService.layThongTinCaNhan(req.nguoiDung.nguoiDungId);
  return thanhCong(res, nguoiDung, 'Lấy thông tin tài khoản thành công');
}

async function doiMatKhau(req, res) {
  const { matKhauCu, matKhauMoi } = req.body;
  const ketQua = await xacThucService.doiMatKhau(req.nguoiDung.nguoiDungId, matKhauCu, matKhauMoi, req.ip);
  return thanhCong(res, ketQua, 'Đổi mật khẩu thành công');
}

async function dangXuat(req, res) {
  await xacThucService.dangXuat(req.nguoiDung.nguoiDungId, req.ip);
  return thanhCong(res, null, 'Đăng xuất thành công');
}

module.exports = { dangNhap, layThongTinCaNhan, doiMatKhau, dangXuat };
