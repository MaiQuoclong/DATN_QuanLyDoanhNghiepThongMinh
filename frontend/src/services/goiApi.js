import axios from 'axios';

export const SU_KIEN_HET_PHIEN = 'smartHrm:hetPhien';
export const SU_KIEN_CAN_DOI_MAT_KHAU = 'smartHrm:canDoiMatKhau';

// Axios dùng chung: mọi request đi qua proxy /api của Vite tới backend.
// Token nằm trong cookie httpOnly do backend đặt -> trình duyệt tự gửi, JavaScript không đọc được (chống XSS lấy token).
const goiApi = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
  withCredentials: true,
});

const DUONG_DAN_DANG_NHAP = '/xacThuc/dangNhap';
const THONG_BAO_CAN_DOI_MAT_KHAU = 'Bạn cần đổi mật khẩu tạm trước khi tiếp tục';

// Trả thẳng phần body chuẩn { success, code, message, data }
goiApi.interceptors.response.use(
  (phanHoi) => phanHoi.data,
  (loi) => {
    const body = loi.response?.data;
    const trangThai = loi.response?.status;
    // Phiên bị từ chối -> báo NguCanhXacThuc đăng xuất (không áp dụng cho sai mật khẩu khi đăng nhập)
    if (trangThai === 401 && loi.config?.url !== DUONG_DAN_DANG_NHAP) {
      window.dispatchEvent(new Event(SU_KIEN_HET_PHIEN));
    }
    // Bị HR/Admin reset mật khẩu giữa phiên -> tải lại thông tin để TuyenBaoVe chuyển sang /doiMatKhau
    if (trangThai === 403 && body?.message === THONG_BAO_CAN_DOI_MAT_KHAU) {
      window.dispatchEvent(new Event(SU_KIEN_CAN_DOI_MAT_KHAU));
    }
    return Promise.reject(
      body ?? { success: false, code: 0, message: 'Không kết nối được máy chủ', data: null }
    );
  }
);

export default goiApi;
