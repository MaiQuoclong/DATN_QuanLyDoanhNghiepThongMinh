import './ChipTrangThai.css';

// Map mã trạng thái -> nhãn tiếng Việt + nhóm màu. Phải khớp backend/src/utils/trangThai.js
const BANG_TRANG_THAI = {
  DA_DUYET: ['Đã duyệt', 'xanh'],
  HIEU_LUC: ['Hiệu lực', 'xanh'],
  DANG_HOAT_DONG: ['Hoạt động', 'xanh'],
  CHINH_THUC: ['Chính thức', 'xanh'],
  HOP_LE: ['Hợp lệ', 'xanh'],
  DANG_MO: ['Đang mở', 'xanh'],
  DANG_AP_DUNG: ['Đang áp dụng', 'xanh'],
  CHO_DUYET: ['Chờ duyệt', 'cam'],
  THU_VIEC: ['Thử việc', 'cam'],
  TU_CHOI: ['Từ chối', 'do'],
  KHOA: ['Bị khóa', 'do'],
  DA_NGHI_VIEC: ['Đã nghỉ việc', 'do'],
  TAM_NGHI: ['Tạm nghỉ', 'cam'],
  NGUNG_HOAT_DONG: ['Ngừng hoạt động', 'xam'],
  NGUNG_AP_DUNG: ['Ngừng áp dụng', 'xam'],
  BAN_NHAP: ['Bản nháp', 'xam'],
  HET_HAN: ['Hết hạn', 'cam'],
  DA_CHAM_DUT: ['Đã chấm dứt', 'xam'],
  DA_DIEU_CHINH: ['Đã điều chỉnh', 'xanh'],
  DA_HUY: ['Đã hủy', 'xam'],
};

// kieu: 'cham' (chấm tròn + chữ, dùng trong bảng) | 'chip' (nền nhạt, dùng ở header)
function ChipTrangThai({ trangThai, nhan, kieu = 'cham' }) {
  const [nhanMacDinh, mau] = BANG_TRANG_THAI[trangThai] ?? [trangThai, 'xam'];
  return <span className={`trangThai ${kieu} ${mau}`}>{nhan ?? nhanMacDinh}</span>;
}

export default ChipTrangThai;
