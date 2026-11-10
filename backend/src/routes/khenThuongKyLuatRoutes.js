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
// HR tạo = lập trực tiếp, vào thẳng CHO_KY (bắt buộc chọn Giám đốc ký)
deXuatRouter.post('/', phanQuyen(['giamDoc', 'quanLy', 'HR']), batLoiBatDongBo(c.taoDeXuat));
deXuatRouter.patch('/:id', phanQuyen(['giamDoc', 'quanLy', 'HR']), batLoiBatDongBo(c.suaDeXuat));
deXuatRouter.delete('/:id', phanQuyen(['giamDoc', 'quanLy', 'HR']), batLoiBatDongBo(c.xoaDeXuat));
// HR từ chối khi CHO_DUYET; Giám đốc được trình từ chối khi CHO_KY
deXuatRouter.post('/:id/tuChoi', phanQuyen(['HR', 'giamDoc']), batLoiBatDongBo(c.tuChoiDeXuat));
deXuatRouter.post('/:id/trinhKy', phanQuyen(['HR']), batLoiBatDongBo(c.trinhKy));
deXuatRouter.post('/:id/ky', phanQuyen(['giamDoc']), batLoiBatDongBo(c.kyDeXuat));
deXuatRouter.post('/:id/traLai', phanQuyen(['giamDoc']), batLoiBatDongBo(c.traLaiDeXuat));

// ===================== /api/v1/quyetDinhKhenThuongKyLuat =====================
const quyetDinhRouter = express.Router();
quyetDinhRouter.use(xacThucJwt);

quyetDinhRouter.get('/', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(c.layDanhSachQuyetDinh));
quyetDinhRouter.get('/nguoiKy', phanQuyen(['HR']), batLoiBatDongBo(c.layDanhSachNguoiKy));
quyetDinhRouter.get('/:id', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(c.layChiTietQuyetDinh));
// Chỉ Giám đốc lập trực tiếp (tự ký); HR lập trực tiếp qua POST /deXuatKhenThuongKyLuat (CHO_KY)
quyetDinhRouter.post('/', phanQuyen(['giamDoc']), batLoiBatDongBo(c.taoQuyetDinh));

module.exports = { deXuatRouter, quyetDinhRouter };
