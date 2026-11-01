const LoiUngDung = require('../utils/LoiUngDung');
const { thatBai } = require('../utils/phanHoi');

const LOI_MAT_KET_NOI_CSDL = [
  'ECONNREFUSED',
  'PROTOCOL_CONNECTION_LOST',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
];

function khongTimThayRoute(req, res) {
  return thatBai(res, 404, `Không tìm thấy đường dẫn ${req.method} ${req.originalUrl}`);
}

// Global error middleware: mọi lỗi đều trả về JSON chuẩn, không lộ stack trace ra client
// eslint-disable-next-line no-unused-vars
function xuLyLoi(loi, req, res, next) {
  if (loi instanceof LoiUngDung) {
    return thatBai(res, loi.code, loi.message);
  }
  if (loi.type === 'entity.parse.failed') {
    return thatBai(res, 400, 'Dữ liệu JSON gửi lên không hợp lệ');
  }
  if (loi.type === 'entity.too.large') {
    return thatBai(res, 413, 'Dữ liệu gửi lên quá lớn');
  }
  // Lỗi 4xx khác do body-parser/Express sinh ra (vd. charset không hỗ trợ)
  if (Number.isInteger(loi.status) && loi.status >= 400 && loi.status < 500) {
    return thatBai(res, loi.status, 'Yêu cầu không hợp lệ');
  }
  if (loi.code === 'ER_DUP_ENTRY') {
    return thatBai(res, 409, 'Dữ liệu bị trùng với bản ghi đã có');
  }
  if (loi.code === 'ER_NO_REFERENCED_ROW_2' || loi.code === 'ER_ROW_IS_REFERENCED_2') {
    return thatBai(res, 409, 'Vi phạm ràng buộc khóa ngoại');
  }
  if (loi.code === 'ER_LOCK_DEADLOCK' || loi.code === 'ER_LOCK_WAIT_TIMEOUT') {
    return thatBai(res, 409, 'Dữ liệu đang được người khác cập nhật, vui lòng thử lại');
  }
  if (LOI_MAT_KET_NOI_CSDL.includes(loi.code)) {
    console.error('[CSDL] Mất kết nối:', loi.code);
    return thatBai(res, 503, 'Không kết nối được cơ sở dữ liệu, vui lòng thử lại sau');
  }
  console.error('[LOI]', loi);
  return thatBai(res, 500, 'Lỗi hệ thống, vui lòng thử lại sau');
}

module.exports = { khongTimThayRoute, xuLyLoi };
