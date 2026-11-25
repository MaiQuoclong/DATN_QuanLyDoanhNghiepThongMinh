import { CalendarPlus, ClockAlert, Bot, UserPlus, FileUp } from 'lucide-react';
import { coQuyen } from './danhSachMenu';

// Menu nút "+" (Tạo nhanh). ?tao=1: trang đích tự mở hộp thoại tạo mới (hook useMoKhiCoThamSo).
// canHoSo: tài khoản chưa liên kết hồ sơ nhân viên không tạo được đơn/yêu cầu -> ẩn.
const thaoTacNhanh = [
  { ma: 'donNghiPhep', ten: 'Tạo đơn nghỉ phép', bieuTuong: CalendarPlus, duongDan: '/nghiPhep?tao=1', canHoSo: true },
  { ma: 'dieuChinhCong', ten: 'Gửi điều chỉnh công', bieuTuong: ClockAlert, duongDan: '/chamCong/dieuChinh?tao=1', canHoSo: true },
  { ma: 'troLyAi', ten: 'Hỏi Trợ lý AI', bieuTuong: Bot, duongDan: '/troLyAi' },
  { ma: 'themNhanVien', ten: 'Thêm nhân viên', bieuTuong: UserPlus, duongDan: '/nhanSu/danhSach?tao=1', vaiTro: ['HR'] },
  { ma: 'taiLieuQuyChe', ten: 'Tải tài liệu quy chế', bieuTuong: FileUp, duongDan: '/troLyAi/taiLieu?tao=1', vaiTro: ['HR'] },
];

export function layThaoTacDuocDung(nguoiDung) {
  return thaoTacNhanh.filter((t) => (!t.vaiTro || coQuyen(nguoiDung.vaiTro, t.vaiTro)) && (!t.canHoSo || nguoiDung.nhanVienId));
}
