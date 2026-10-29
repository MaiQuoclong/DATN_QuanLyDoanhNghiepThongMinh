const LoiUngDung = require('../utils/LoiUngDung');
const { thatBai } = require('../utils/phanHoi');

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
  if (loi.code === 'ER_DUP_ENTRY') {
    return thatBai(res, 409, 'Dữ liệu bị trùng với bản ghi đã có');
  }
  if (loi.code === 'ER_NO_REFERENCED_ROW_2' || loi.code === 'ER_ROW_IS_REFERENCED_2') {
    return thatBai(res, 409, 'Vi phạm ràng buộc khóa ngoại');
  }
  console.error('[LOI]', loi);
  return thatBai(res, 500, 'Lỗi hệ thống, vui lòng thử lại sau');
}

module.exports = { khongTimThayRoute, xuLyLoi };
