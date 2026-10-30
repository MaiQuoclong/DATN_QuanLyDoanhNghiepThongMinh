const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { khongTimThayRoute, xuLyLoi } = require('./middlewares/xuLyLoi');

// Tách app khỏi server.js để test bằng Supertest mà không cần mở cổng
const app = express();

// Chỉ tin X-Forwarded-For từ proxy cục bộ (Vite dev) để lấy đúng IP client ghi nhatkyhethong
// mà client không tự giả IP được; triển khai sau reverse proxy khác thì đổi giá trị này.
app.set('trust proxy', 'loopback');
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/v1', routes);

app.use(khongTimThayRoute);
app.use(xuLyLoi);

module.exports = app;
