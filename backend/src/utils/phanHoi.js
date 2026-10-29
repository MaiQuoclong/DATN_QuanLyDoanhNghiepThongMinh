// Chuẩn response chung của toàn hệ thống: { success, code, message, data }
// Ví dụ: return thanhCong(res, nhanVien, 'Tạo nhân viên thành công', 201);
function thanhCong(res, data = null, message = 'Thành công', code = 200) {
  return res.status(code).json({ success: true, code, message, data });
}

function thatBai(res, code, message) {
  return res.status(code).json({ success: false, code, message, data: null });
}

module.exports = { thanhCong, thatBai };
