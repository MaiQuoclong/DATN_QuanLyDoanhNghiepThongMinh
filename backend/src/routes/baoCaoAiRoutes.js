const express = require('express');
const { rateLimit } = require('express-rate-limit');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const { thatBai } = require('../utils/phanHoi');
const phanQuyen = require('../middlewares/phanQuyen');
const kiemTraDuLieu = require('../middlewares/kiemTraDuLieu');
const { xacThucJwt } = require('../middlewares/xacThucJwt');
const baoCaoAiController = require('../controllers/baoCaoAiController');

// Mỗi câu hỏi = 1-2 lần gọi LLM + 1 truy vấn CSDL: 10 lượt/phút/người (đếm theo tài khoản). Export để test resetKey.
const gioiHanBaoCao = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `nguoiDung:${req.nguoiDung.nguoiDungId}`,
  handler: (req, res) => thatBai(res, 429, 'Bạn đã hỏi quá nhiều, vui lòng thử lại sau 1 phút'),
});

// /api/v1/baoCaoAi: giamDoc, HR toàn công ty; quanLy giới hạn phòng ban mình (Admin, nhanVien → 403)
const router = express.Router();

router.post(
  '/truyVan',
  xacThucJwt,
  phanQuyen(['giamDoc', 'HR', 'quanLy']),
  gioiHanBaoCao,
  kiemTraDuLieu({ cauHoi: { nhan: 'Câu hỏi', batBuoc: true, toiThieu: 5, toiDa: 500 } }),
  batLoiBatDongBo(baoCaoAiController.truyVan),
);

module.exports = { router, gioiHanBaoCao };
