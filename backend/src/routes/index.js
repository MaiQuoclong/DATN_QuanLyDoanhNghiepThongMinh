const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const { kiemTraSucKhoe } = require('../controllers/sucKhoeController');

// Router gốc /api/v1: các module sau gắn thêm tại đây, ví dụ router.use('/nhanVien', nhanVienRoutes)
const router = express.Router();

router.get('/sucKhoe', batLoiBatDongBo(kiemTraSucKhoe));

module.exports = router;
