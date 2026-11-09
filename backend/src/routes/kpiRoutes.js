const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const kiemTraDuLieu = require('../middlewares/kiemTraDuLieu');
const phanQuyen = require('../middlewares/phanQuyen');
const { xacThucJwt } = require('../middlewares/xacThucJwt');
const c = require('../controllers/kpiController');

// Quyền theo docs/phan-quyen.md mục 8; phạm vi (PM, Mình, không tự chấm/nghiệm thu) kiểm tra ở kpiService
const MOI_VAI_TRO = ['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien'];
const XEM_KPI = ['HR', 'giamDoc', 'quanLy'];
const QUAN_TRI_KPI = ['HR', 'quanLy'];
const NGHIEM_THU = ['giamDoc', 'quanLy'];

// ===================== /api/v1/kyDanhGiaKPI =====================
const kyDanhGiaRouter = express.Router();
kyDanhGiaRouter.use(xacThucJwt);

const LUAT_KY = {
  tenKyDanhGia: { nhan: 'Tên kỳ đánh giá', toiThieu: 3, toiDa: 100 },
  ngayBatDau: { nhan: 'Ngày bắt đầu', kieu: 'ngay' },
  ngayKetThuc: { nhan: 'Ngày kết thúc', kieu: 'ngay' },
};
const LUAT_KY_BAT_BUOC = Object.fromEntries(Object.entries(LUAT_KY).map(([k, v]) => [k, { ...v, batBuoc: true }]));

kyDanhGiaRouter.get('/', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(c.layDanhSachKy));
kyDanhGiaRouter.get('/:id', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(c.layChiTietKy));
kyDanhGiaRouter.post('/', phanQuyen(['HR']), kiemTraDuLieu(LUAT_KY_BAT_BUOC), batLoiBatDongBo(c.themKy));
kyDanhGiaRouter.patch('/:id', phanQuyen(['HR']), kiemTraDuLieu(LUAT_KY), batLoiBatDongBo(c.suaKy));
kyDanhGiaRouter.post('/:id/dong', phanQuyen(['HR']), batLoiBatDongBo(c.dongKy));
kyDanhGiaRouter.post('/:id/moLai', phanQuyen(['HR']), batLoiBatDongBo(c.moLaiKy));
kyDanhGiaRouter.delete('/:id', phanQuyen(['HR']), batLoiBatDongBo(c.xoaKy));

// ===================== /api/v1/chiTieuKPI =====================
const chiTieuRouter = express.Router();
chiTieuRouter.use(xacThucJwt);

chiTieuRouter.get('/', phanQuyen(XEM_KPI), batLoiBatDongBo(c.layDanhSachChiTieu));
chiTieuRouter.get('/viTri', phanQuyen(QUAN_TRI_KPI), batLoiBatDongBo(c.layViTriGanChiTieu));
// Kiểu số (trọng số, vị trí) do service kiểm tra
chiTieuRouter.post(
  '/',
  phanQuyen(QUAN_TRI_KPI),
  kiemTraDuLieu({
    maChiTieu: { nhan: 'Mã chỉ tiêu', batBuoc: true, toiDa: 30 },
    tenChiTieu: { nhan: 'Tên chỉ tiêu', batBuoc: true, toiThieu: 2, toiDa: 150 },
  }),
  batLoiBatDongBo(c.themChiTieu),
);
chiTieuRouter.patch('/:id', phanQuyen(QUAN_TRI_KPI), batLoiBatDongBo(c.suaChiTieu));
chiTieuRouter.delete('/:id', phanQuyen(QUAN_TRI_KPI), batLoiBatDongBo(c.xoaChiTieu));

// ===================== /api/v1/phieuDanhGiaKPI =====================
const phieuRouter = express.Router();
phieuRouter.use(xacThucJwt);

phieuRouter.get('/', phanQuyen(XEM_KPI), batLoiBatDongBo(c.layDanhSachPhieu));
phieuRouter.get('/cuaToi', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(c.layPhieuCuaToi));
phieuRouter.get('/baoCao', phanQuyen(XEM_KPI), batLoiBatDongBo(c.layBaoCao));
phieuRouter.get('/:id', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(c.layChiTietPhieu));
phieuRouter.post(
  '/',
  phanQuyen(QUAN_TRI_KPI),
  kiemTraDuLieu({
    kyDanhGiaId: { nhan: 'Kỳ đánh giá', batBuoc: true, kieu: 'soNguyenDuong' },
    nhanVienId: { nhan: 'Nhân viên', batBuoc: true, kieu: 'soNguyenDuong' },
  }),
  batLoiBatDongBo(c.taoPhieu),
);
phieuRouter.post(
  '/taoHangLoat',
  phanQuyen(QUAN_TRI_KPI),
  kiemTraDuLieu({
    kyDanhGiaId: { nhan: 'Kỳ đánh giá', batBuoc: true, kieu: 'soNguyenDuong' },
    phongBanId: { nhan: 'Phòng ban', kieu: 'soNguyenDuong' },
  }),
  batLoiBatDongBo(c.taoPhieuHangLoat),
);
phieuRouter.patch('/:id', phanQuyen(QUAN_TRI_KPI), batLoiBatDongBo(c.suaPhieu));
phieuRouter.delete('/:id', phanQuyen(QUAN_TRI_KPI), batLoiBatDongBo(c.xoaPhieu));
phieuRouter.patch('/:id/tuCham', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(c.tuCham));
phieuRouter.post('/:id/guiDuyet', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(c.guiDuyet));
phieuRouter.post('/:id/nghiemThu', phanQuyen(NGHIEM_THU), batLoiBatDongBo(c.nghiemThu));
phieuRouter.post(
  '/:id/traLai',
  phanQuyen(NGHIEM_THU),
  kiemTraDuLieu({ lyDo: { nhan: 'Lý do trả lại', batBuoc: true, toiDa: 1000 } }),
  batLoiBatDongBo(c.traLai),
);

module.exports = { kyDanhGiaRouter, chiTieuRouter, phieuRouter };
