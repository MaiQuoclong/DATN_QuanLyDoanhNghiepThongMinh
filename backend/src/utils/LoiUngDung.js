// Lỗi nghiệp vụ có mã HTTP, được middleware xuLyLoi chuyển thành JSON chuẩn
// Ví dụ: throw new LoiUngDung(404, 'Không tìm thấy nhân viên');
class LoiUngDung extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LoiUngDung';
    this.code = code;
  }
}

module.exports = LoiUngDung;
