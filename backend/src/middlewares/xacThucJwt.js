const LoiUngDung = require('../utils/LoiUngDung');
const { kiemTraPhien } = require('../services/xacThucService');
const { docCookieToken } = require('../utils/cookieXacThuc');

// Ưu tiên header Bearer (Postman, test, AI service); trình duyệt dùng cookie httpOnly
async function ganNguoiDung(req) {
  const [loai, tokenHeader] = (req.headers.authorization || '').split(' ');
  const token = loai === 'Bearer' && tokenHeader ? tokenHeader : docCookieToken(req);
  if (!token) {
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

// Dùng cho /dangXuat: token hỏng/thu hồi vẫn cho qua (req.nguoiDung = null) để luôn xóa được cookie
async function xacThucJwtTuyChon(req, res, next) {
  try {
    await ganNguoiDung(req);
  } catch (loi) {
    if (!(loi instanceof LoiUngDung)) throw loi;
    req.nguoiDung = null;
  }
  next();
}

module.exports = { xacThucJwt, xacThucJwtChoMatKhauTam, xacThucJwtTuyChon };
