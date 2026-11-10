// Định dạng hiển thị dùng chung (số tiền, ngày) theo chuẩn Việt Nam
const BO_DINH_DANG_TIEN = new Intl.NumberFormat('vi-VN');

export function dinhDangTien(giaTri) {
  if (giaTri === null || giaTri === undefined || giaTri === '') return '—';
  return `${BO_DINH_DANG_TIEN.format(Number(giaTri))} đ`;
}

// 'YYYY-MM-DD' hoặc 'YYYY-MM-DD HH:mm:ss' -> 'DD/MM/YYYY' (không qua Date để tránh lệch múi giờ)
export function dinhDangNgay(giaTri) {
  if (!giaTri) return '—';
  const [nam, thang, ngay] = String(giaTri).slice(0, 10).split('-');
  return `${ngay}/${thang}/${nam}`;
}

export function dinhDangThoiGian(giaTri) {
  if (!giaTri) return '—';
  return `${dinhDangNgay(giaTri)} ${String(giaTri).slice(11, 16)}`;
}

export const NHAN_LOAI_HOP_DONG = {
  THU_VIEC: 'Thử việc',
  XAC_DINH_THOI_HAN: 'Xác định thời hạn',
  KHONG_XAC_DINH_THOI_HAN: 'Không xác định thời hạn',
};

export const NHAN_GIOI_TINH = { NAM: 'Nam', NU: 'Nữ', KHAC: 'Khác' };

export const NHAN_TRANG_THAI_LAM_VIEC = {
  THU_VIEC: 'Thử việc',
  CHINH_THUC: 'Chính thức',
  TAM_NGHI: 'Tạm nghỉ',
  DA_NGHI_VIEC: 'Đã nghỉ việc',
};

export const NHAN_HANH_DONG_HOP_DONG = {
  TAO_MOI: 'Lập mới',
  GIA_HAN: 'Gia hạn',
  DIEU_CHINH: 'Điều chỉnh',
  CHAM_DUT: 'Chấm dứt',
};

// Chuyển { ma: nhan } thành luaChon cho ThanhLoc / select
export function thanhLuaChon(bang) {
  return Object.entries(bang).map(([giaTri, nhan]) => ({ giaTri, nhan }));
}

// Bỏ trường rỗng trước khi gửi query
export function locThamSo(thamSo) {
  return Object.fromEntries(Object.entries(thamSo).filter(([, giaTri]) => giaTri !== '' && giaTri !== undefined && giaTri !== null));
}

// 'HH:MM:SS' -> 'HH:MM'
export function dinhDangGio(giaTri) {
  return giaTri ? String(giaTri).slice(0, 5) : '—';
}

// Tháng hiện tại 'YYYY-MM' theo giờ máy người dùng
export function thangHienTai() {
  return new Date().toLocaleDateString('sv-SE').slice(0, 7);
}

const THU_TRONG_TUAN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export function layThu(ngay) {
  return THU_TRONG_TUAN[new Date(`${String(ngay).slice(0, 10)}T00:00:00Z`).getUTCDay()];
}

// Số ngày làm việc (T2-T6) trong khoảng, khớp backend utils/tinhNgayNghi.js (chỉ để xem trước, backend tính lại)
// ngayLe: Set 'YYYY-MM-DD' (hook useNgayLe) để bỏ ngày lễ như backend
export function demNgayLamViec(tuNgay, denNgay, ngayLe = new Set()) {
  if (!tuNgay || !denNgay || denNgay < tuNgay) return 0;
  let dem = 0;
  const ngay = new Date(`${tuNgay}T00:00:00Z`);
  const cuoi = new Date(`${denNgay}T00:00:00Z`);
  while (ngay <= cuoi) {
    if (![0, 6].includes(ngay.getUTCDay()) && !ngayLe.has(ngay.toISOString().slice(0, 10))) dem += 1;
    ngay.setUTCDate(ngay.getUTCDate() + 1);
  }
  return dem;
}

export const NHAN_TRANG_THAI_DON = {
  CHO_DUYET: 'Chờ duyệt',
  DA_DUYET: 'Đã duyệt',
  TU_CHOI: 'Từ chối',
  DA_HUY: 'Đã hủy',
};

// Người duyệt dự kiến do backend tính theo chuỗi duyệt
export function moTaNguoiDuyetDuKien(nguoiDuyet) {
  if (!nguoiDuyet) return '—';
  if (nguoiDuyet.loai === 'GIAM_DOC') return nguoiDuyet.lyDo === 'DON_DAI_NGAY' ? 'Ban Giám đốc (đơn dài ngày)' : 'Ban Giám đốc';
  return `${nguoiDuyet.hoVaTen} (${nguoiDuyet.maNhanVien})`;
}
