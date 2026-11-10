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
// banghichamcong: HOP_LE = tự chấm, DA_DIEU_CHINH = giờ đã sửa theo yêu cầu được duyệt (thiếu check-out suy ra từ gioRa NULL)
const TRANG_THAI_CHAM_CONG = ['HOP_LE', 'DA_DIEU_CHINH'];
const TRANG_THAI_DIEU_CHINH_CONG = ['CHO_DUYET', 'DA_DUYET', 'TU_CHOI'];
// dondexuatnghiphep: DA_HUY = người gửi tự hủy khi đơn còn chờ duyệt (giữ lại lịch sử, không xóa dòng)
const TRANG_THAI_DON_NGHI_PHEP = ['CHO_DUYET', 'DA_DUYET', 'TU_CHOI', 'DA_HUY'];
const TRANG_THAI_LOAI_NGHI_PHEP = ['DANG_AP_DUNG', 'NGUNG_AP_DUNG'];
// phuongThucTao: tạo trên form hoặc qua trợ lý AI (Function Calling)
const PHUONG_THUC_TAO_DON = ['FORM_GIAO_DIEN', 'AI_CHAT'];
// bangtonghopluong: BAN_NHAP (HR lập/sửa) -> CHO_DUYET (HR gửi) -> DA_DUYET (giamDoc duyệt); trả lại -> BAN_NHAP
const TRANG_THAI_BANG_LUONG = ['BAN_NHAP', 'CHO_DUYET', 'DA_DUYET'];
// quyetdinhkhenthuongkyluat.loaiQuyetDinh
const LOAI_QUYET_DINH = ['KHEN_THUONG', 'KY_LUAT'];
// kydanhgiakpi: DANG_MO (được tạo phiếu, chấm, nghiệm thu) -> DA_DONG (khóa toàn bộ phiếu của kỳ)
const TRANG_THAI_KY_DANH_GIA = ['DANG_MO', 'DA_DONG'];
// phieudanhgiakpi: BAN_NHAP (nhân viên tự chấm) -> CHO_DUYET (chờ nghiệm thu) -> DA_DUYET; trả lại -> BAN_NHAP
const TRANG_THAI_PHIEU_KPI = ['BAN_NHAP', 'CHO_DUYET', 'DA_DUYET'];
// phieudanhgiakpi.xepLoaiChung (ngưỡng ở config/thamSoNghiepVu.js THAM_SO_KPI)
const XEP_LOAI_KPI = ['XUAT_SAC', 'TOT', 'KHA', 'TRUNG_BINH', 'YEU'];

module.exports = {
  TRANG_THAI_KY_DANH_GIA,
  TRANG_THAI_PHIEU_KPI,
  XEP_LOAI_KPI,
  TRANG_THAI_BANG_LUONG,
  LOAI_QUYET_DINH,
  TRANG_THAI_PHONG_BAN,
  TRANG_THAI_CHUC_DANH,
  TRANG_THAI_VI_TRI,
  TRANG_THAI_LAM_VIEC,
  TRANG_THAI_TAI_KHOAN,
  LOAI_HOP_DONG,
  TRANG_THAI_HOP_DONG,
  TRANG_THAI_CHAM_CONG,
  TRANG_THAI_DIEU_CHINH_CONG,
  TRANG_THAI_DON_NGHI_PHEP,
  TRANG_THAI_LOAI_NGHI_PHEP,
  PHUONG_THUC_TAO_DON,
};
