const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const phanQuyen = require('../middlewares/phanQuyen');
const { xacThucJwt } = require('../middlewares/xacThucJwt');
const viecCanChuYController = require('../controllers/viecCanChuYController');

const router = express.Router();
router.use(xacThucJwt);

// Mọi vai trò: service tự chọn mục theo vai trò và phạm vi của người gọi
router.get('/', phanQuyen(['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien']), batLoiBatDongBo(viecCanChuYController.layViecCanChuY));

module.exports = router;
