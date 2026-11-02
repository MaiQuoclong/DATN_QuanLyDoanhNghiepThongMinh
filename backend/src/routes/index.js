const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const { kiemTraSucKhoe } = require('../controllers/sucKhoeController');
const xacThucRoutes = require('./xacThucRoutes');
const nhanVienRoutes = require('./nhanVienRoutes');
const nguoiDungRoutes = require('./nguoiDungRoutes');
const heThongRoutes = require('./heThongRoutes');
const coCauToChucRoutes = require('./coCauToChucRoutes');
const hopDongRoutes = require('./hopDongRoutes');

// Router gốc /api/v1: các module sau gắn thêm tại đây, ví dụ router.use('/nhanVien', nhanVienRoutes)
const router = express.Router();

router.get('/sucKhoe', batLoiBatDongBo(kiemTraSucKhoe));
router.use('/xacThuc', xacThucRoutes);
router.use('/nhanVien', nhanVienRoutes);
router.use('/nguoiDung', nguoiDungRoutes);
router.use('/hopDong', hopDongRoutes);
// Các router gắn ở '/' tự gắn xacThucJwt theo từng route (không router.use) để đường dẫn lạ vẫn trả 404
router.use('/', heThongRoutes);
router.use('/', coCauToChucRoutes);

module.exports = router;
