const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const kiemTraDuLieu = require('../middlewares/kiemTraDuLieu');
const phanQuyen = require('../middlewares/phanQuyen');
const { xacThucJwt } = require('../middlewares/xacThucJwt');
const nguoiDungController = require('../controllers/nguoiDungController');

// Quản trị tài khoản (docs/phan-quyen.md mục 1). Gắn tại /api/v1/nguoiDung
const router = express.Router();
router.use(xacThucJwt);

const LUAT_LY_DO = kiemTraDuLieu({ lyDo: { nhan: 'Lý do', toiDa: 200 } });

router.get('/', phanQuyen(['Admin']), batLoiBatDongBo(nguoiDungController.layDanhSachTaiKhoan));
router.get('/:id', phanQuyen(['Admin']), batLoiBatDongBo(nguoiDungController.layChiTietTaiKhoan));

// HR chỉ reset được tài khoản nhanVien/quanLy: service kiểm tra vai trò đích
router.post('/:id/datLaiMatKhau', phanQuyen(['Admin', 'HR']), batLoiBatDongBo(nguoiDungController.datLaiMatKhau));

router.post('/:id/khoa', phanQuyen(['Admin']), LUAT_LY_DO, batLoiBatDongBo(nguoiDungController.khoaTaiKhoan));
router.post('/:id/moKhoa', phanQuyen(['Admin']), LUAT_LY_DO, batLoiBatDongBo(nguoiDungController.moKhoaTaiKhoan));
router.put('/:id/vaiTro', phanQuyen(['Admin']), batLoiBatDongBo(nguoiDungController.capNhatVaiTro));

module.exports = router;
