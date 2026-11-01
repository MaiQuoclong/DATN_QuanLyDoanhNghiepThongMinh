const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const kiemTraDuLieu = require('../middlewares/kiemTraDuLieu');
const phanQuyen = require('../middlewares/phanQuyen');
const { xacThucJwt } = require('../middlewares/xacThucJwt');
const { LOAI_HOP_DONG } = require('../utils/trangThai');
const hopDongController = require('../controllers/hopDongController');

const router = express.Router();
router.use(xacThucJwt);

const MOI_VAI_TRO = ['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien'];
const LY_DO = { nhan: 'Lý do', toiDa: 500 };
const DUONG_DAN_FILE = { nhan: 'Đường dẫn file hợp đồng', toiDa: 255 };

router.get('/', phanQuyen(['HR', 'giamDoc']), batLoiBatDongBo(hopDongController.layDanhSachHopDong));
// Các đường dẫn cố định đặt trước /:id
router.get('/cuaToi', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(hopDongController.layHopDongCuaToi));
router.get('/sapHetHan', phanQuyen(['HR', 'giamDoc']), batLoiBatDongBo(hopDongController.layHopDongSapHetHan));
// Chính chủ, HR, giamDoc: service kiểm tra phạm vi
router.get('/:id', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(hopDongController.layChiTietHopDong));

router.post(
  '/',
  phanQuyen(['HR']),
  kiemTraDuLieu({
    nhanVienId: { nhan: 'Nhân viên', batBuoc: true, kieu: 'soNguyenDuong' },
    loaiHopDong: { nhan: 'Loại hợp đồng', batBuoc: true, cacGiaTri: LOAI_HOP_DONG },
    ngayBatDau: { nhan: 'Ngày bắt đầu', batBuoc: true, kieu: 'ngay' },
    ngayKetThuc: { nhan: 'Ngày kết thúc', kieu: 'ngay' },
    luongCoBan: { nhan: 'Lương cơ bản', batBuoc: true, kieu: 'soTien', duong: true },
    mucPhuCap: { nhan: 'Mức phụ cấp', kieu: 'soTien' },
    duongDanFileHopDong: DUONG_DAN_FILE,
    lyDo: LY_DO,
  }),
  batLoiBatDongBo(hopDongController.taoHopDong)
);

router.post(
  '/:id/giaHan',
  phanQuyen(['HR']),
  kiemTraDuLieu({
    ngayKetThucMoi: { nhan: 'Ngày kết thúc mới', batBuoc: true, kieu: 'ngay' },
    lyDo: LY_DO,
  }),
  batLoiBatDongBo(hopDongController.giaHanHopDong)
);

router.post(
  '/:id/dieuChinh',
  phanQuyen(['HR']),
  kiemTraDuLieu({
    luongCoBan: { nhan: 'Lương cơ bản', kieu: 'soTien', duong: true },
    mucPhuCap: { nhan: 'Mức phụ cấp', kieu: 'soTien' },
    duongDanFileHopDong: DUONG_DAN_FILE,
    lyDo: { ...LY_DO, batBuoc: true },
  }),
  batLoiBatDongBo(hopDongController.dieuChinhHopDong)
);

router.post(
  '/:id/chamDut',
  phanQuyen(['HR']),
  kiemTraDuLieu({
    ngayChamDut: { nhan: 'Ngày chấm dứt', batBuoc: true, kieu: 'ngay' },
    lyDo: { ...LY_DO, batBuoc: true },
  }),
  batLoiBatDongBo(hopDongController.chamDutHopDong)
);

module.exports = router;
