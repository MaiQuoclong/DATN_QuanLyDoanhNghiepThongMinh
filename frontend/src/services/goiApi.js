import axios from 'axios';

// Axios dùng chung: mọi request đi qua proxy /api của Vite tới backend
const goiApi = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
});

// Trả thẳng phần body chuẩn { success, code, message, data }
goiApi.interceptors.response.use(
  (phanHoi) => phanHoi.data,
  (loi) => {
    const body = loi.response?.data;
    return Promise.reject(
      body ?? { success: false, code: 0, message: 'Không kết nối được máy chủ', data: null }
    );
  }
);

export default goiApi;
