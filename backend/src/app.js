const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { khongTimThayRoute, xuLyLoi } = require('./middlewares/xuLyLoi');
const { thatBai } = require('./utils/phanHoi');

// Tách app khỏi server.js để test bằng Supertest mà không cần mở cổng
const app = express();

// Chỉ tin X-Forwarded-For từ proxy cục bộ (Vite dev) để lấy đúng IP client ghi nhatkyhethong
// mà client không tự giả IP được; triển khai sau reverse proxy khác thì đổi giá trị này.
app.set('trust proxy', 'loopback');
// Chỉ cho các origin khai báo trong CORS_NGUON (phân cách bằng dấu phẩy) gọi API kèm cookie.
// Khi dev, frontend đi qua proxy Vite (cùng origin) nên không cần CORS; mặc định chỉ mở cho Vite.
const nguonChoPhep = (process.env.CORS_NGUON || 'http://localhost:5173')
  .split(',')
  .map((nguon) => nguon.trim())
  .filter(Boolean);
app.use(cors({ origin: nguonChoPhep, credentials: true }));

// Lớp chống CSRF bổ sung cho cookie SameSite (không phân biệt cổng/subdomain): request ghi dữ liệu
// từ trình duyệt luôn kèm Origin -> Origin lạ bị từ chối. Client không phải trình duyệt không gửi Origin.
const PHUONG_THUC_DOC = ['GET', 'HEAD', 'OPTIONS'];
app.use((req, res, next) => {
  const nguon = req.get('Origin');
  if (nguon && !PHUONG_THUC_DOC.includes(req.method) && !nguonChoPhep.includes(nguon)) {
    return thatBai(res, 403, 'Nguồn gửi yêu cầu không được phép');
  }
  return next();
});
app.use(express.json({ limit: '1mb' }));

app.use('/api/v1', routes);

app.use(khongTimThayRoute);
app.use(xuLyLoi);

module.exports = app;
