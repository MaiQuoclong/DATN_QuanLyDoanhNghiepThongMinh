const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const { kiemTraSucKhoe } = require('../controllers/sucKhoeController');
const xacThucRoutes = require('./xacThucRoutes');
const nhanVienRoutes = require('./nhanVienRoutes');
const nguoiDungRoutes = require('./nguoiDungRoutes');
const heThongRoutes = require('./heThongRoutes');
const coCauToChucRoutes = require('./coCauToChucRoutes');
const hopDongRoutes = require('./hopDongRoutes');
const { chamCongRouter, dieuChinhRouter } = require('./chamCongRoutes');
const { loaiNghiPhepRouter, quyPhepRouter, donNghiPhepRouter } = require('./nghiPhepRoutes');
const { bangLuongRouter, phieuLuongRouter } = require('./luongRoutes');
const { kyDanhGiaRouter, chiTieuRouter, phieuRouter } = require('./kpiRoutes');
const { deXuatRouter, quyetDinhRouter } = require('./khenThuongKyLuatRoutes');
const ngayLeRoutes = require('./ngayLeRoutes');
const taiLieuQuyCheRoutes = require('./taiLieuQuyCheRoutes');
const { router: troLyAiRoutes } = require('./troLyAiRoutes');
const { router: baoCaoAiRoutes } = require('./baoCaoAiRoutes');

// Router gốc /api/v1: các module sau gắn thêm tại đây, ví dụ router.use('/nhanVien', nhanVienRoutes)
const router = express.Router();

router.get('/sucKhoe', batLoiBatDongBo(kiemTraSucKhoe));
router.use('/xacThuc', xacThucRoutes);
router.use('/nhanVien', nhanVienRoutes);
router.use('/nguoiDung', nguoiDungRoutes);
router.use('/hopDong', hopDongRoutes);
router.use('/chamCong', chamCongRouter);
router.use('/dieuChinhCong', dieuChinhRouter);
router.use('/loaiNghiPhep', loaiNghiPhepRouter);
router.use('/quyPhep', quyPhepRouter);
router.use('/donNghiPhep', donNghiPhepRouter);
router.use('/bangLuong', bangLuongRouter);
router.use('/phieuLuong', phieuLuongRouter);
router.use('/kyDanhGiaKPI', kyDanhGiaRouter);
router.use('/chiTieuKPI', chiTieuRouter);
router.use('/phieuDanhGiaKPI', phieuRouter);
router.use('/deXuatKhenThuongKyLuat', deXuatRouter);
router.use('/quyetDinhKhenThuongKyLuat', quyetDinhRouter);
router.use('/ngayLe', ngayLeRoutes);
router.use('/taiLieuQuyChe', taiLieuQuyCheRoutes);
router.use('/troLyAi', troLyAiRoutes);
router.use('/baoCaoAi', baoCaoAiRoutes);
// Các router gắn ở '/' tự gắn xacThucJwt theo từng route (không router.use) để đường dẫn lạ vẫn trả 404
router.use('/', heThongRoutes);
router.use('/', coCauToChucRoutes);

module.exports = router;
