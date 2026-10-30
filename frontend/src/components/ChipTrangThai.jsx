import './ChipTrangThai.css';

// Map mã trạng thái theo schema -> nhãn tiếng Việt + nhóm màu
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
  BI_KHOA: ['Bị khóa', 'do'],
  BAN_NHAP: ['Bản nháp', 'xam'],
};

// kieu: 'cham' (chấm tròn + chữ, dùng trong bảng) | 'chip' (nền nhạt, dùng ở header)
function ChipTrangThai({ trangThai, nhan, kieu = 'cham' }) {
  const [nhanMacDinh, mau] = BANG_TRANG_THAI[trangThai] ?? [trangThai, 'xam'];
  return <span className={`trangThai ${kieu} ${mau}`}>{nhan ?? nhanMacDinh}</span>;
}

export default ChipTrangThai;
