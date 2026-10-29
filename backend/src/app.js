const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { khongTimThayRoute, xuLyLoi } = require('./middlewares/xuLyLoi');

// Tách app khỏi server.js để test bằng Supertest mà không cần mở cổng
const app = express();

app.set('trust proxy', true); // lấy đúng IP client để ghi nhatkyhethong
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/v1', routes);

app.use(khongTimThayRoute);
app.use(xuLyLoi);

module.exports = app;
