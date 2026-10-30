import axios from 'axios';

export const KHOA_TOKEN = 'smartHrmToken';
export const SU_KIEN_HET_PHIEN = 'smartHrm:hetPhien';

// Axios dùng chung: mọi request đi qua proxy /api của Vite tới backend
const goiApi = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
});

const DUONG_DAN_DANG_NHAP = '/xacThuc/dangNhap';

goiApi.interceptors.request.use((cauHinh) => {
  const token = localStorage.getItem(KHOA_TOKEN);
  // Không gắn token cũ vào request đăng nhập: sai mật khẩu (401) không được hiểu là hết phiên
  if (token && cauHinh.url !== DUONG_DAN_DANG_NHAP) cauHinh.headers.Authorization = `Bearer ${token}`;
  return cauHinh;
});

// Trả thẳng phần body chuẩn { success, code, message, data }
goiApi.interceptors.response.use(
  (phanHoi) => phanHoi.data,
  (loi) => {
    const body = loi.response?.data;
    // Token gửi đi bị từ chối -> báo NguCanhXacThuc đăng xuất (không áp dụng cho sai mật khẩu khi đăng nhập)
    if (loi.response?.status === 401 && loi.config?.headers?.Authorization) {
      window.dispatchEvent(new Event(SU_KIEN_HET_PHIEN));
    }
    return Promise.reject(
      body ?? { success: false, code: 0, message: 'Không kết nối được máy chủ', data: null }
    );
  }
);

export default goiApi;
