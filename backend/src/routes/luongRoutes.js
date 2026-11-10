const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const kiemTraDuLieu = require('../middlewares/kiemTraDuLieu');
const phanQuyen = require('../middlewares/phanQuyen');
const { xacThucJwt } = require('../middlewares/xacThucJwt');
const luongController = require('../controllers/luongController');

// Quyền theo docs/phan-quyen.md mục 7
const MOI_VAI_TRO = ['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien'];
const XEM_BANG_LUONG = ['HR', 'giamDoc'];

// ===================== /api/v1/bangLuong =====================
const bangLuongRouter = express.Router();
bangLuongRouter.use(xacThucJwt);

bangLuongRouter.get('/', phanQuyen(XEM_BANG_LUONG), batLoiBatDongBo(luongController.layDanhSachBang));
bangLuongRouter.get('/baoCao', phanQuyen(XEM_BANG_LUONG), batLoiBatDongBo(luongController.layBaoCao));
bangLuongRouter.post('/', phanQuyen(['HR']), batLoiBatDongBo(luongController.lapBang));
bangLuongRouter.get('/:id', phanQuyen(XEM_BANG_LUONG), batLoiBatDongBo(luongController.layChiTietBang));
bangLuongRouter.get('/:id/xuatExcel', phanQuyen(XEM_BANG_LUONG), batLoiBatDongBo(luongController.xuatExcel));
bangLuongRouter.delete('/:id', phanQuyen(['HR']), batLoiBatDongBo(luongController.xoaBang));
bangLuongRouter.post('/:id/tinhLai', phanQuyen(['HR']), batLoiBatDongBo(luongController.tinhLaiBang));
bangLuongRouter.post('/:id/guiDuyet', phanQuyen(['HR']), batLoiBatDongBo(luongController.guiDuyet));
bangLuongRouter.post('/:id/duyet', phanQuyen(['giamDoc']), batLoiBatDongBo(luongController.duyetBang));
bangLuongRouter.post(
  '/:id/traLai',
  phanQuyen(['giamDoc']),
  kiemTraDuLieu({ lyDo: { nhan: 'Lý do trả lại', batBuoc: true, toiThieu: 5, toiDa: 900 } }),
  batLoiBatDongBo(luongController.traLaiBang),
);

// ===================== /api/v1/phieuLuong =====================
const phieuLuongRouter = express.Router();
phieuLuongRouter.use(xacThucJwt);

phieuLuongRouter.get('/cuaToi', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(luongController.layPhieuCuaToi));
phieuLuongRouter.get('/:id', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(luongController.layPhieu));
// Các trường số (soNgayCongThucTe, luongLamThemOT, thuongKPI, tongPhuCap) do service kiểm tra
phieuLuongRouter.patch('/:id', phanQuyen(['HR']), batLoiBatDongBo(luongController.suaPhieu));

module.exports = { bangLuongRouter, phieuLuongRouter };
