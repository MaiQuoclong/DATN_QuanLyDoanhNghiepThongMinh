const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const phanQuyen = require('../middlewares/phanQuyen');
const { xacThucJwt } = require('../middlewares/xacThucJwt');
const c = require('../controllers/khenThuongKyLuatController');

// Quyền theo docs/phan-quyen.md mục 9; phạm vi (PM, do mình tạo, không cho chính mình) kiểm tra ở service
const MOI_VAI_TRO = ['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien'];

// ===================== /api/v1/deXuatKhenThuongKyLuat =====================
const deXuatRouter = express.Router();
deXuatRouter.use(xacThucJwt);

deXuatRouter.get('/', phanQuyen(['giamDoc', 'quanLy', 'HR']), batLoiBatDongBo(c.layDanhSachDeXuat));
deXuatRouter.get('/:id', phanQuyen(['giamDoc', 'quanLy', 'HR']), batLoiBatDongBo(c.layChiTietDeXuat));
deXuatRouter.post('/', phanQuyen(['giamDoc', 'quanLy']), batLoiBatDongBo(c.taoDeXuat));
deXuatRouter.patch('/:id', phanQuyen(['giamDoc', 'quanLy']), batLoiBatDongBo(c.suaDeXuat));
deXuatRouter.delete('/:id', phanQuyen(['giamDoc', 'quanLy']), batLoiBatDongBo(c.xoaDeXuat));
deXuatRouter.post('/:id/tuChoi', phanQuyen(['HR']), batLoiBatDongBo(c.tuChoiDeXuat));
deXuatRouter.post('/:id/lapQuyetDinh', phanQuyen(['HR']), batLoiBatDongBo(c.lapQuyetDinhTuDeXuat));

// ===================== /api/v1/quyetDinhKhenThuongKyLuat =====================
const quyetDinhRouter = express.Router();
quyetDinhRouter.use(xacThucJwt);

quyetDinhRouter.get('/', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(c.layDanhSachQuyetDinh));
quyetDinhRouter.get('/nguoiKy', phanQuyen(['HR']), batLoiBatDongBo(c.layDanhSachNguoiKy));
quyetDinhRouter.get('/:id', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(c.layChiTietQuyetDinh));
quyetDinhRouter.post('/', phanQuyen(['HR', 'giamDoc']), batLoiBatDongBo(c.taoQuyetDinh));

module.exports = { deXuatRouter, quyetDinhRouter };
