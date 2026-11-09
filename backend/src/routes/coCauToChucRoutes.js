const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const kiemTraDuLieu = require('../middlewares/kiemTraDuLieu');
const phanQuyen = require('../middlewares/phanQuyen');
const { xacThucJwt } = require('../middlewares/xacThucJwt');
const { TRANG_THAI_PHONG_BAN, TRANG_THAI_CHUC_DANH, TRANG_THAI_VI_TRI } = require('../utils/trangThai');
const coCauToChucController = require('../controllers/coCauToChucController');

// Cơ cấu tổ chức (docs/phan-quyen.md mục 2). Gắn tại /api/v1.
// Mỗi route tự gắn xacThucJwt (không dùng router.use) vì router gắn ở '/': đường dẫn lạ vẫn rơi xuống 404.
const router = express.Router();
const MOI_VAI_TRO = ['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien'];
const moiNguoi = [xacThucJwt, phanQuyen(MOI_VAI_TRO)];
const chiHR = [xacThucJwt, phanQuyen(['HR'])];
const chiGiamDoc = [xacThucJwt, phanQuyen(['giamDoc'])];

const MAU_MA = /^[A-Za-z0-9-]+$/;
const LUAT_MA = (nhan) => ({
  nhan,
  batBuoc: true,
  toiThieu: 2,
  toiDa: 20,
  mauKiemTra: MAU_MA,
  thongBaoMau: `${nhan} chỉ gồm chữ không dấu, số và dấu gạch ngang`,
});
const luatTrangThai = (cacGiaTri) => kiemTraDuLieu({ trangThai: { nhan: 'Trạng thái', batBuoc: true, cacGiaTri } });

// ----- Đọc: mọi vai trò xem sơ đồ phòng ban -----
router.get('/phongBan', ...moiNguoi, batLoiBatDongBo(coCauToChucController.layDanhSachPhongBan));
router.get('/phongBan/:id', ...moiNguoi, batLoiBatDongBo(coCauToChucController.layChiTietPhongBan));
router.get('/chucDanh', ...moiNguoi, batLoiBatDongBo(coCauToChucController.layDanhSachChucDanh));
// Định biên/chỗ trống phục vụ form nhân sự: chỉ HR, giamDoc
router.get('/chucDanhPhongBan', xacThucJwt, phanQuyen(['HR', 'giamDoc']), batLoiBatDongBo(coCauToChucController.layDanhSachViTri));

// ----- Phòng ban (HR) -----
router.post(
  '/phongBan',
  ...chiHR,
  kiemTraDuLieu({
    maPhongBan: LUAT_MA('Mã phòng ban'),
    tenPhongBan: { nhan: 'Tên phòng ban', batBuoc: true, toiThieu: 2, toiDa: 100 },
    phongBanChaId: { nhan: 'Phòng ban cha', kieu: 'soNguyenDuong' },
  }),
  batLoiBatDongBo(coCauToChucController.themPhongBan),
);
router.patch(
  '/phongBan/:id',
  ...chiHR,
  kiemTraDuLieu({
    tenPhongBan: { nhan: 'Tên phòng ban', toiThieu: 2, toiDa: 100 },
    phongBanChaId: { nhan: 'Phòng ban cha', kieu: 'soNguyenDuong' },
  }),
  batLoiBatDongBo(coCauToChucController.suaPhongBan),
);
router.post(
  '/phongBan/:id/doiTrangThai',
  ...chiHR,
  luatTrangThai(TRANG_THAI_PHONG_BAN),
  batLoiBatDongBo(coCauToChucController.doiTrangThaiPhongBan),
);

// ----- Bổ nhiệm (giamDoc) -----
router.post(
  '/phongBan/:id/boNhiem',
  ...chiGiamDoc,
  kiemTraDuLieu({ nhanVienId: { nhan: 'Nhân viên', batBuoc: true, kieu: 'soNguyenDuong' } }),
  batLoiBatDongBo(coCauToChucController.boNhiemTruongBoPhan),
);
router.post('/phongBan/:id/mienNhiem', ...chiGiamDoc, batLoiBatDongBo(coCauToChucController.mienNhiemTruongBoPhan));

// ----- Chức danh (HR) -----
router.post(
  '/chucDanh',
  ...chiHR,
  kiemTraDuLieu({
    maChucDanh: LUAT_MA('Mã chức danh'),
    tenChucDanh: { nhan: 'Tên chức danh', batBuoc: true, toiThieu: 2, toiDa: 100 },
    capBac: { nhan: 'Cấp bậc', batBuoc: true, toiThieu: 2, toiDa: 50 },
  }),
  batLoiBatDongBo(coCauToChucController.themChucDanh),
);
router.patch(
  '/chucDanh/:id',
  ...chiHR,
  kiemTraDuLieu({
    tenChucDanh: { nhan: 'Tên chức danh', toiThieu: 2, toiDa: 100 },
    capBac: { nhan: 'Cấp bậc', toiThieu: 2, toiDa: 50 },
    trangThai: { nhan: 'Trạng thái', cacGiaTri: TRANG_THAI_CHUC_DANH },
  }),
  batLoiBatDongBo(coCauToChucController.suaChucDanh),
);
router.post(
  '/chucDanh/:id/doiTrangThai',
  ...chiHR,
  luatTrangThai(TRANG_THAI_CHUC_DANH),
  batLoiBatDongBo(coCauToChucController.doiTrangThaiChucDanh),
);

// ----- Vị trí = chức danh trong phòng ban (HR) -----
router.post(
  '/chucDanhPhongBan',
  ...chiHR,
  kiemTraDuLieu({
    phongBanId: { nhan: 'Phòng ban', batBuoc: true, kieu: 'soNguyenDuong' },
    chucDanhId: { nhan: 'Chức danh', batBuoc: true, kieu: 'soNguyenDuong' },
    dinhBien: { nhan: 'Định biên', batBuoc: true, kieu: 'soNguyenDuong' },
    ghiChu: { nhan: 'Ghi chú', toiDa: 255 },
  }),
  batLoiBatDongBo(coCauToChucController.themViTri),
);
router.patch(
  '/chucDanhPhongBan/:id',
  ...chiHR,
  kiemTraDuLieu({
    dinhBien: { nhan: 'Định biên', kieu: 'soNguyenDuong' },
    ghiChu: { nhan: 'Ghi chú', toiDa: 255 },
    trangThai: { nhan: 'Trạng thái', cacGiaTri: TRANG_THAI_VI_TRI },
  }),
  batLoiBatDongBo(coCauToChucController.suaViTri),
);
router.post(
  '/chucDanhPhongBan/:id/doiTrangThai',
  ...chiHR,
  luatTrangThai(TRANG_THAI_VI_TRI),
  batLoiBatDongBo(coCauToChucController.doiTrangThaiViTri),
);

module.exports = router;
