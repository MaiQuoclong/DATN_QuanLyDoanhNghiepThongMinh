const express = require('express');
const { rateLimit } = require('express-rate-limit');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const { thatBai } = require('../utils/phanHoi');
const kiemTraDuLieu = require('../middlewares/kiemTraDuLieu');
const { xacThucJwtChoMatKhauTam } = require('../middlewares/xacThucJwt');
const xacThucController = require('../controllers/xacThucController');

const router = express.Router();

// Mật khẩu mới: tối thiểu 8 ký tự, có chữ và số
const MAU_MAT_KHAU_MANH = /^(?=.*[A-Za-z])(?=.*\d).+$/;

// Chống dò mật khẩu: tối đa 10 lần SAI / 15 phút (tắt khi chạy test).
// Đếm theo IP + tài khoản để cả văn phòng dùng chung IP (NAT) không bị khóa lây nhau.
// Hạn chế đã biết: kẻ tấn công đổi IP liên tục vẫn vượt được; nâng lên v8 phải bọc IP bằng ipKeyGenerator.
function taoGioiHanThuMatKhau(layKhoa) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: layKhoa,
    skip: () => process.env.NODE_ENV === 'test',
    handler: (req, res) => thatBai(res, 429, 'Bạn thử sai quá nhiều lần, vui lòng thử lại sau 15 phút'),
  });
}

const gioiHanDangNhap = taoGioiHanThuMatKhau(
  (req) => `${req.ip}|${String(req.body?.tenDangNhap ?? '').trim().toLowerCase()}`
);
// Đặt sau xác thực token nên đếm theo người dùng
const gioiHanDoiMatKhau = taoGioiHanThuMatKhau((req) => `nguoiDung:${req.nguoiDung.nguoiDungId}`);

router.post(
  '/dangNhap',
  gioiHanDangNhap,
  kiemTraDuLieu({
    tenDangNhap: { nhan: 'Tên đăng nhập', batBuoc: true, toiDa: 100 },
    matKhau: { nhan: 'Mật khẩu', batBuoc: true, toiDaByte: 72 },
  }),
  batLoiBatDongBo(xacThucController.dangNhap)
);

router.get('/toi', xacThucJwtChoMatKhauTam, batLoiBatDongBo(xacThucController.layThongTinCaNhan));

router.post(
  '/doiMatKhau',
  xacThucJwtChoMatKhauTam,
  gioiHanDoiMatKhau,
  kiemTraDuLieu({
    matKhauCu: { nhan: 'Mật khẩu hiện tại', batBuoc: true, toiDaByte: 72 },
    matKhauMoi: {
      nhan: 'Mật khẩu mới',
      batBuoc: true,
      toiThieu: 8,
      toiDaByte: 72, // bcrypt chỉ dùng 72 byte đầu
      mauKiemTra: MAU_MAT_KHAU_MANH,
      thongBaoMau: 'Mật khẩu mới phải có cả chữ và số',
    },
  }),
  batLoiBatDongBo(xacThucController.doiMatKhau)
);

router.post('/dangXuat', xacThucJwtChoMatKhauTam, batLoiBatDongBo(xacThucController.dangXuat));

module.exports = router;
