const express = require('express');
const { rateLimit } = require('express-rate-limit');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const { thatBai } = require('../utils/phanHoi');
const phanQuyen = require('../middlewares/phanQuyen');
const kiemTraDuLieu = require('../middlewares/kiemTraDuLieu');
const { xacThucJwt } = require('../middlewares/xacThucJwt');
const troLyAiController = require('../controllers/troLyAiController');

const TAT_CA = ['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien'];

// Giới hạn 20 câu hỏi/phút/người dùng (mỗi câu hỏi tốn một lần gọi LLM). Đếm theo tài khoản, không theo IP,
// để cả văn phòng dùng chung IP không chặn lẫn nhau. Export để test đặt lại bộ đếm (resetKey).
const gioiHanHoiDap = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `nguoiDung:${req.nguoiDung.nguoiDungId}`,
  handler: (req, res) => thatBai(res, 429, 'Bạn hỏi quá nhanh, vui lòng thử lại sau ít phút'),
});

// Xác nhận bản nháp đơn: 10 lần/phút/người (mỗi lần tạo một đơn thật trong MySQL)
const gioiHanXacNhan = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `nguoiDung:${req.nguoiDung.nguoiDungId}`,
  handler: (req, res) => thatBai(res, 429, 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút'),
});

// /api/v1/troLyAi: mọi vai trò dùng; mỗi người chỉ thấy phiên của mình (phiên người khác → 404)
const router = express.Router();

router.get('/phien', xacThucJwt, phanQuyen(TAT_CA), batLoiBatDongBo(troLyAiController.layDanhSachPhien));
router.post(
  '/phien',
  xacThucJwt,
  phanQuyen(TAT_CA),
  kiemTraDuLieu({ tieuDePhien: { nhan: 'Tiêu đề phiên', toiDa: 150 } }),
  batLoiBatDongBo(troLyAiController.taoPhien),
);
router.patch(
  '/phien/:id',
  xacThucJwt,
  phanQuyen(TAT_CA),
  kiemTraDuLieu({ tieuDePhien: { nhan: 'Tiêu đề phiên', batBuoc: true, toiDa: 150 } }),
  batLoiBatDongBo(troLyAiController.doiTieuDe),
);
router.delete('/phien/:id', xacThucJwt, phanQuyen(TAT_CA), batLoiBatDongBo(troLyAiController.xoaPhien));
router.get('/phien/:id/tinNhan', xacThucJwt, phanQuyen(TAT_CA), batLoiBatDongBo(troLyAiController.layTinNhan));
router.post(
  '/hoiDap',
  xacThucJwt,
  phanQuyen(TAT_CA),
  gioiHanHoiDap,
  kiemTraDuLieu({
    phienId: { nhan: 'Mã phiên trò chuyện', kieu: 'soNguyenDuong' },
    cauHoi: { nhan: 'Câu hỏi', batBuoc: true, toiDa: 1000 },
  }),
  batLoiBatDongBo(troLyAiController.hoiDap),
);

// Bản nháp đơn (5.5): chỉ chủ bản nháp xác nhận/hủy được (của người khác → 404)
router.post('/banNhap/:id/xacNhan', xacThucJwt, phanQuyen(TAT_CA), gioiHanXacNhan, batLoiBatDongBo(troLyAiController.xacNhanBanNhap));
router.post('/banNhap/:id/huy', xacThucJwt, phanQuyen(TAT_CA), batLoiBatDongBo(troLyAiController.huyBanNhap));

module.exports = { router, gioiHanHoiDap, gioiHanXacNhan };
