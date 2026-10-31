// Giá trị trạng thái dùng chung (cột VARCHAR trong schema, không có ràng buộc CHECK).
// Mọi service, bộ lọc và frontend (ChipTrangThai) phải dùng đúng các giá trị này.
const TRANG_THAI_PHONG_BAN = ['DANG_HOAT_DONG', 'NGUNG_HOAT_DONG'];
const TRANG_THAI_CHUC_DANH = ['DANG_HOAT_DONG', 'NGUNG_HOAT_DONG'];
const TRANG_THAI_VI_TRI = ['DANG_AP_DUNG', 'NGUNG_AP_DUNG']; // chucdanhphongban
const TRANG_THAI_LAM_VIEC = ['THU_VIEC', 'CHINH_THUC', 'TAM_NGHI', 'DA_NGHI_VIEC'];
const TRANG_THAI_TAI_KHOAN = ['DANG_HOAT_DONG', 'KHOA'];

module.exports = {
  TRANG_THAI_PHONG_BAN,
  TRANG_THAI_CHUC_DANH,
  TRANG_THAI_VI_TRI,
  TRANG_THAI_LAM_VIEC,
  TRANG_THAI_TAI_KHOAN,
};
