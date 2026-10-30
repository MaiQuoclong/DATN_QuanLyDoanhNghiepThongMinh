const LoiUngDung = require('../utils/LoiUngDung');
const { kiemTraPhien } = require('../services/xacThucService');

async function ganNguoiDung(req) {
  const [loai, token] = (req.headers.authorization || '').split(' ');
  if (loai !== 'Bearer' || !token) {
    throw new LoiUngDung(401, 'Bạn chưa đăng nhập');
  }
  req.nguoiDung = await kiemTraPhien(token);
}

// Gắn req.nguoiDung = { nguoiDungId, nhanVienId, vaiTro[], batBuocDoiMatKhau } (đọc lại từ CSDL mỗi request).
// Tài khoản đang dùng mật khẩu tạm bị chặn mọi API, trừ các route dùng xacThucJwtChoMatKhauTam.
async function xacThucJwt(req, res, next) {
  await ganNguoiDung(req);
  if (req.nguoiDung.batBuocDoiMatKhau) {
    throw new LoiUngDung(403, 'Bạn cần đổi mật khẩu tạm trước khi tiếp tục');
  }
  next();
}

// Dùng cho /xacThuc/toi, /doiMatKhau, /dangXuat: vẫn cho phép khi đang dùng mật khẩu tạm
async function xacThucJwtChoMatKhauTam(req, res, next) {
  await ganNguoiDung(req);
  next();
}

module.exports = { xacThucJwt, xacThucJwtChoMatKhauTam };
