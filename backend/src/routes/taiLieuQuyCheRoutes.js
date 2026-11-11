const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const phanQuyen = require('../middlewares/phanQuyen');
const kiemTraDuLieu = require('../middlewares/kiemTraDuLieu');
const { xacThucJwt } = require('../middlewares/xacThucJwt');
const { taiTepTaiLieu } = require('../middlewares/taiTep');
const taiLieuQuyCheController = require('../controllers/taiLieuQuyCheController');

const TAT_CA = ['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien'];

// /api/v1/taiLieuQuyChe: mọi vai trò xem danh sách, tải tệp (quy chế công khai nội bộ); chỉ HR tải lên, xóa, lập chỉ mục RAG.
// phanQuyen đứng trước taiTepTaiLieu để vai trò khác bị chặn trước khi nhận tệp vào bộ nhớ.
const router = express.Router();

router.get('/', xacThucJwt, phanQuyen(TAT_CA), batLoiBatDongBo(taiLieuQuyCheController.layDanhSach));
router.get('/:id/tep', xacThucJwt, phanQuyen(TAT_CA), batLoiBatDongBo(taiLieuQuyCheController.taiTep));
router.post(
  '/',
  xacThucJwt,
  phanQuyen(['HR']),
  taiTepTaiLieu,
  kiemTraDuLieu({
    maTaiLieu: {
      nhan: 'Mã tài liệu',
      batBuoc: true,
      toiDa: 30,
      mauKiemTra: /^[A-Z0-9][A-Z0-9_-]{1,29}$/,
      thongBaoMau: 'Mã tài liệu gồm 2-30 ký tự chữ in hoa, số, "-" hoặc "_" (VD: QC-NOIQUY)',
    },
    tieuDe: { nhan: 'Tiêu đề', batBuoc: true, toiDa: 255 },
  }),
  batLoiBatDongBo(taiLieuQuyCheController.taiLen),
);
router.post('/:id/lapChiMuc', xacThucJwt, phanQuyen(['HR']), batLoiBatDongBo(taiLieuQuyCheController.lapChiMuc));
router.delete('/:id', xacThucJwt, phanQuyen(['HR']), batLoiBatDongBo(taiLieuQuyCheController.xoa));

module.exports = router;
