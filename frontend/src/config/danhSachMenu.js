import {
  LayoutGrid,
  Users,
  Clock,
  CalendarDays,
  Wallet,
  Target,
  Award,
  ShieldCheck,
  Bot,
} from 'lucide-react';

const TAT_CA = ['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien'];
const QUAN_LY_NHAN_SU = ['giamDoc', 'quanLy', 'HR'];

// Menu thanh icon + tab con trên thanh trên cùng, theo docs/phan-quyen.md.
// vaiTro của tab mặc định bằng vaiTro của module. Tab có duongDan '' là trang index của module.
// Đây chỉ là lớp giao diện, backend vẫn kiểm tra quyền và phạm vi dữ liệu.
const danhSachMenu = [
  { duongDan: '/', ten: 'Tổng quan', bieuTuong: LayoutGrid, vaiTro: TAT_CA },
  {
    duongDan: '/nhanSu',
    ten: 'Nhân sự',
    bieuTuong: Users,
    vaiTro: TAT_CA,
    tab: [
      { duongDan: '', ten: 'Hồ sơ của tôi' },
      { duongDan: 'danhSach', ten: 'Nhân viên', vaiTro: QUAN_LY_NHAN_SU },
      // quanLy không xem hợp đồng người khác; ai có vai trò nhanVien vẫn xem hợp đồng của mình
      { duongDan: 'hopDong', ten: 'Hợp đồng', vaiTro: ['Admin', 'giamDoc', 'HR', 'nhanVien'] },
      { duongDan: 'phongBan', ten: 'Phòng ban' },
    ],
  },
  {
    duongDan: '/chamCong',
    ten: 'Chấm công',
    bieuTuong: Clock,
    vaiTro: TAT_CA,
    tab: [
      { duongDan: '', ten: 'Lịch công' },
      { duongDan: 'dieuChinh', ten: 'Điều chỉnh công' },
      { duongDan: 'bangCong', ten: 'Bảng công', vaiTro: QUAN_LY_NHAN_SU },
    ],
  },
  {
    duongDan: '/nghiPhep',
    ten: 'Nghỉ phép',
    bieuTuong: CalendarDays,
    vaiTro: TAT_CA,
    tab: [
      { duongDan: '', ten: 'Đơn của tôi' },
      { duongDan: 'duyetDon', ten: 'Duyệt đơn', vaiTro: ['giamDoc', 'quanLy'] },
      { duongDan: 'lichNghi', ten: 'Lịch nghỉ', vaiTro: QUAN_LY_NHAN_SU },
    ],
  },
  {
    duongDan: '/luong',
    ten: 'Lương',
    bieuTuong: Wallet,
    vaiTro: TAT_CA,
    tab: [
      { duongDan: '', ten: 'Phiếu lương' },
      { duongDan: 'bangLuong', ten: 'Bảng lương', vaiTro: ['giamDoc', 'HR'] },
    ],
  },
  { duongDan: '/kpi', ten: 'KPI', bieuTuong: Target, vaiTro: TAT_CA },
  {
    duongDan: '/khenThuongKyLuat',
    ten: 'Khen thưởng - Kỷ luật',
    bieuTuong: Award,
    vaiTro: TAT_CA,
    tab: [
      { duongDan: '', ten: 'Quyết định' },
      { duongDan: 'deXuat', ten: 'Đề xuất', vaiTro: QUAN_LY_NHAN_SU },
    ],
  },
  {
    duongDan: '/heThong',
    ten: 'Hệ thống',
    bieuTuong: ShieldCheck,
    vaiTro: ['Admin', 'giamDoc', 'HR'],
    tab: [
      { duongDan: 'taiKhoan', ten: 'Tài khoản', vaiTro: ['Admin', 'HR'] },
      { duongDan: 'nhatKy', ten: 'Nhật ký', vaiTro: ['Admin', 'giamDoc'] },
    ],
  },
  { duongDan: '/troLyAi', ten: 'Trợ lý AI', bieuTuong: Bot, vaiTro: TAT_CA },
];

export const NHAN_VAI_TRO = {
  Admin: 'Quản trị hệ thống',
  giamDoc: 'Giám đốc',
  quanLy: 'Quản lý',
  HR: 'Nhân sự',
  nhanVien: 'Nhân viên',
};

export function coQuyen(vaiTroNguoiDung = [], vaiTroChoPhep = TAT_CA) {
  return vaiTroNguoiDung.some((vt) => vaiTroChoPhep.includes(vt));
}

// Tab con mà người dùng được xem trong một module
export function layTabDuocXem(module, vaiTroNguoiDung) {
  return (module.tab ?? []).filter((tab) => coQuyen(vaiTroNguoiDung, tab.vaiTro ?? module.vaiTro));
}

export default danhSachMenu;
