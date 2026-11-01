const xacThucService = require('../services/xacThucService');
const { thanhCong } = require('../utils/phanHoi');
const { ganCookieToken, xoaCookieToken } = require('../utils/cookieXacThuc');

// Trình duyệt chỉ nhận token qua cookie httpOnly: không trả token trong JSON để script (XSS) không đọc được.
// Client không phải trình duyệt (Postman, test, AI service) gửi header X-Tra-Token: 1 để nhận token dùng Bearer.
function traKetQuaCoToken(req, res, { token, ...ketQua }, thongBao) {
  ganCookieToken(res, token);
  res.set('Cache-Control', 'no-store');
  const data = req.get('X-Tra-Token') === '1' ? { token, ...ketQua } : ketQua;
  return thanhCong(res, data, thongBao);
}

async function dangNhap(req, res) {
  const { tenDangNhap, matKhau } = req.body;
  const ketQua = await xacThucService.dangNhap(tenDangNhap.trim(), matKhau, req.ip);
  return traKetQuaCoToken(req, res, ketQua, 'Đăng nhập thành công');
}

async function layThongTinCaNhan(req, res) {
  const nguoiDung = await xacThucService.layThongTinCaNhan(req.nguoiDung.nguoiDungId);
  return thanhCong(res, nguoiDung, 'Lấy thông tin tài khoản thành công');
}

async function doiMatKhau(req, res) {
  const { matKhauCu, matKhauMoi } = req.body;
  const ketQua = await xacThucService.doiMatKhau(req.nguoiDung.nguoiDungId, matKhauCu, matKhauMoi, req.ip);
  return traKetQuaCoToken(req, res, ketQua, 'Đổi mật khẩu thành công');
}

// Luôn xóa cookie; chỉ ghi DANG_XUAT khi phiên còn hợp lệ
async function dangXuat(req, res) {
  if (req.nguoiDung) await xacThucService.dangXuat(req.nguoiDung.nguoiDungId, req.ip);
  xoaCookieToken(res);
  return thanhCong(res, null, 'Đăng xuất thành công');
}

module.exports = { dangNhap, layThongTinCaNhan, doiMatKhau, dangXuat };
