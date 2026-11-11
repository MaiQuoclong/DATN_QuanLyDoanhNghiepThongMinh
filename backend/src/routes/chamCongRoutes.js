const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const kiemTraDuLieu = require('../middlewares/kiemTraDuLieu');
const phanQuyen = require('../middlewares/phanQuyen');
const { xacThucJwt } = require('../middlewares/xacThucJwt');
const chamCongController = require('../controllers/chamCongController');
const { LUAT_TAO_YEU_CAU } = require('../services/chamCongService');

const MOI_VAI_TRO = ['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien'];
const XEM_BANG_CONG = ['HR', 'giamDoc', 'quanLy'];

// ===================== /api/v1/chamCong =====================
const chamCongRouter = express.Router();
chamCongRouter.use(xacThucJwt);

chamCongRouter.get('/homNay', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(chamCongController.layHomNay));
chamCongRouter.post('/checkIn', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(chamCongController.checkIn));
chamCongRouter.post('/checkOut', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(chamCongController.checkOut));
chamCongRouter.get('/cuaToi', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(chamCongController.layCuaToi));
chamCongRouter.get('/bangCong', phanQuyen(XEM_BANG_CONG), batLoiBatDongBo(chamCongController.layBangCong));
// Chính chủ, HR, giamDoc, quanLy (PM): service kiểm tra phạm vi
chamCongRouter.get('/bangCong/:id', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(chamCongController.layCongNhanVien));
chamCongRouter.get('/chotCong', phanQuyen(XEM_BANG_CONG), batLoiBatDongBo(chamCongController.layDanhSachThangDaChot));
chamCongRouter.post(
  '/chotCong',
  phanQuyen(['HR']),
  kiemTraDuLieu({
    thang: { nhan: 'Tháng', batBuoc: true, mauKiemTra: /^\d{4}-(0[1-9]|1[0-2])$/, thongBaoMau: 'Tháng phải có dạng YYYY-MM' },
  }),
  batLoiBatDongBo(chamCongController.chotCong),
);

// ===================== /api/v1/dieuChinhCong =====================
const dieuChinhRouter = express.Router();
dieuChinhRouter.use(xacThucJwt);

dieuChinhRouter.get('/', phanQuyen(XEM_BANG_CONG), batLoiBatDongBo(chamCongController.layDanhSachYeuCau));
dieuChinhRouter.get('/cuaToi', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(chamCongController.layYeuCauCuaToi));
dieuChinhRouter.post('/', phanQuyen(MOI_VAI_TRO), kiemTraDuLieu(LUAT_TAO_YEU_CAU), batLoiBatDongBo(chamCongController.taoYeuCau));
dieuChinhRouter.post('/:id/duyet', phanQuyen(XEM_BANG_CONG), batLoiBatDongBo(chamCongController.duyetYeuCau));
dieuChinhRouter.post(
  '/:id/tuChoi',
  phanQuyen(XEM_BANG_CONG),
  kiemTraDuLieu({ lyDoTuChoi: { nhan: 'Lý do từ chối', batBuoc: true, toiDa: 1000 } }),
  batLoiBatDongBo(chamCongController.tuChoiYeuCau),
);

module.exports = { chamCongRouter, dieuChinhRouter };
