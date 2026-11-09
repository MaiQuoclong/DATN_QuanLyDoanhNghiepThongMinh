const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const phanQuyen = require('../middlewares/phanQuyen');
const { xacThucJwt } = require('../middlewares/xacThucJwt');
const nguoiDungController = require('../controllers/nguoiDungController');

// Danh mục vai trò và nhật ký hệ thống. Gắn tại /api/v1
const router = express.Router();

router.get('/vaiTro', xacThucJwt, phanQuyen(['Admin']), batLoiBatDongBo(nguoiDungController.layDanhSachVaiTro));
router.get('/nhatKyHeThong', xacThucJwt, phanQuyen(['Admin', 'giamDoc']), batLoiBatDongBo(nguoiDungController.layNhatKyHeThong));

module.exports = router;
