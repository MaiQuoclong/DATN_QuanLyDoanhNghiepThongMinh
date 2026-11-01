// Giá trị trạng thái dùng chung (cột VARCHAR trong schema, không có ràng buộc CHECK).
// Mọi service, bộ lọc và frontend (ChipTrangThai) phải dùng đúng các giá trị này.
const TRANG_THAI_PHONG_BAN = ['DANG_HOAT_DONG', 'NGUNG_HOAT_DONG'];
const TRANG_THAI_CHUC_DANH = ['DANG_HOAT_DONG', 'NGUNG_HOAT_DONG'];
const TRANG_THAI_VI_TRI = ['DANG_AP_DUNG', 'NGUNG_AP_DUNG']; // chucdanhphongban
const TRANG_THAI_LAM_VIEC = ['THU_VIEC', 'CHINH_THUC', 'TAM_NGHI', 'DA_NGHI_VIEC'];
const TRANG_THAI_TAI_KHOAN = ['DANG_HOAT_DONG', 'KHOA'];
const LOAI_HOP_DONG = ['THU_VIEC', 'XAC_DINH_THOI_HAN', 'KHONG_XAC_DINH_THOI_HAN'];
// hopdonglaodong.trangThai lưu HIEU_LUC / DA_CHAM_DUT; HET_HAN chỉ suy ra khi đọc (quá ngày kết thúc)
const TRANG_THAI_HOP_DONG = ['HIEU_LUC', 'HET_HAN', 'DA_CHAM_DUT'];

module.exports = {
  TRANG_THAI_PHONG_BAN,
  TRANG_THAI_CHUC_DANH,
  TRANG_THAI_VI_TRI,
  TRANG_THAI_LAM_VIEC,
  TRANG_THAI_TAI_KHOAN,
  LOAI_HOP_DONG,
  TRANG_THAI_HOP_DONG,
};
