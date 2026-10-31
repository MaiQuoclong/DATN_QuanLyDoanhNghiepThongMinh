const jwt = require('jsonwebtoken');

// Token lưu trong cookie httpOnly: JavaScript phía trình duyệt không đọc được -> lỗ XSS không lấy cắp được token.
// SameSite=Strict chặn trình duyệt gửi cookie từ trang khác (chống CSRF); production bắt buộc HTTPS (secure).
// Giới hạn: "same-site" không phân biệt cổng/subdomain -> app.js chặn thêm request ghi có Origin ngoài CORS_NGUON.
const TEN_COOKIE = 'smartHrmToken';

function tuyChonCookie() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api',
  };
}

function ganCookieToken(res, token) {
  const { exp } = jwt.decode(token);
  res.cookie(TEN_COOKIE, token, { ...tuyChonCookie(), maxAge: exp * 1000 - Date.now() });
}

function xoaCookieToken(res) {
  res.clearCookie(TEN_COOKIE, tuyChonCookie());
}

// Đọc cookie từ header thô (không cần thêm thư viện cookie-parser).
// JWT chỉ gồm ký tự base64url và dấu chấm nên không cần decode; giá trị lạ coi như không có token.
const MAU_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;
function docCookieToken(req) {
  const cacCookie = (req.headers.cookie || '').split(';');
  for (const cookie of cacCookie) {
    const viTri = cookie.indexOf('=');
    if (viTri > 0 && cookie.slice(0, viTri).trim() === TEN_COOKIE) {
      const giaTri = cookie.slice(viTri + 1).trim();
      return MAU_JWT.test(giaTri) ? giaTri : null;
    }
  }
  return null;
}

module.exports = { TEN_COOKIE, ganCookieToken, xoaCookieToken, docCookieToken };
