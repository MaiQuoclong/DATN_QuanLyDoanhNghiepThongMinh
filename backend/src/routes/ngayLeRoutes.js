const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const phanQuyen = require('../middlewares/phanQuyen');
const { xacThucJwt } = require('../middlewares/xacThucJwt');
const ngayLeController = require('../controllers/ngayLeController');

// GET /api/v1/ngayLe?nam=YYYY — mọi vai trò (dữ liệu công khai theo config THAM_SO_NGAY_LE)
const router = express.Router();
router.get('/', xacThucJwt, phanQuyen(['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien']), batLoiBatDongBo(ngayLeController.layNgayLe));

module.exports = router;
