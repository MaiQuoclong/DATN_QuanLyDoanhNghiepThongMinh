const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const kiemTraDuLieu = require('../middlewares/kiemTraDuLieu');
const phanQuyen = require('../middlewares/phanQuyen');
const { xacThucJwt } = require('../middlewares/xacThucJwt');
const { TRANG_THAI_LAM_VIEC } = require('../services/nhanVienService');
const nhanVienController = require('../controllers/nhanVienController');

const router = express.Router();
router.use(xacThucJwt);

const MAU_SO_DIEN_THOAI = /^0\d{9,10}$/;
const MAU_SO_TAI_KHOAN = /^\d{6,30}$/;
const GIOI_TINH = ['NAM', 'NU', 'KHAC'];

// Luật dùng chung cho các trường liên hệ/ngân hàng
const LUAT_LIEN_HE = {
  soDienThoai: { nhan: 'Số điện thoại', mauKiemTra: MAU_SO_DIEN_THOAI, thongBaoMau: 'Số điện thoại phải gồm 10-11 chữ số, bắt đầu bằng 0' },
  diaChi: { nhan: 'Địa chỉ', toiDa: 255 },
  soTaiKhoanNganHang: { nhan: 'Số tài khoản ngân hàng', mauKiemTra: MAU_SO_TAI_KHOAN, thongBaoMau: 'Số tài khoản chỉ gồm 6-30 chữ số' },
  tenNganHang: { nhan: 'Tên ngân hàng', toiDa: 100 },
};

const LUAT_HO_SO = {
  hoVaTen: {
    nhan: 'Họ và tên',
    toiThieu: 2,
    toiDa: 100,
    mauKiemTra: /^[\p{L}][\p{L}\s.'-]*$/u,
    thongBaoMau: 'Họ và tên chỉ gồm chữ cái và khoảng trắng',
  },
  gioiTinh: { nhan: 'Giới tính', cacGiaTri: GIOI_TINH },
  ngaySinh: { nhan: 'Ngày sinh', kieu: 'ngay' },
  ngayVaoLam: { nhan: 'Ngày vào làm', kieu: 'ngay' },
  ...LUAT_LIEN_HE,
};

// Bắt buộc với luật tạo mới
function batBuoc(luat, cacTruong) {
  const ketQua = { ...luat };
  cacTruong.forEach((truong) => {
    ketQua[truong] = { ...ketQua[truong], batBuoc: true };
  });
  return ketQua;
}

router.get('/', phanQuyen(['HR', 'giamDoc', 'quanLy']), batLoiBatDongBo(nhanVienController.layDanhSachNhanVien));

router.post(
  '/',
  phanQuyen(['HR']),
  kiemTraDuLieu({
    ...batBuoc(LUAT_HO_SO, ['hoVaTen', 'gioiTinh', 'ngaySinh', 'ngayVaoLam']),
    chucDanhPhongBanId: { nhan: 'Vị trí (chức danh phòng ban)', batBuoc: true, kieu: 'soNguyenDuong' },
    trangThaiLamViec: { nhan: 'Trạng thái làm việc', cacGiaTri: ['THU_VIEC', 'CHINH_THUC'] },
    tenDangNhap: {
      nhan: 'Tên đăng nhập',
      batBuoc: true,
      toiThieu: 3,
      toiDa: 50,
      mauKiemTra: /^[A-Za-z0-9._]+$/,
      thongBaoMau: 'Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới',
    },
    email: {
      nhan: 'Email',
      batBuoc: true,
      toiDa: 100,
      mauKiemTra: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      thongBaoMau: 'Email không hợp lệ',
    },
  }),
  batLoiBatDongBo(nhanVienController.themNhanVien),
);

const MOI_VAI_TRO = ['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien'];

// /toi đặt trước /:id
router.get('/toi', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(nhanVienController.layHoSoCuaToi));
router.patch('/toi', phanQuyen(MOI_VAI_TRO), kiemTraDuLieu(LUAT_LIEN_HE), batLoiBatDongBo(nhanVienController.capNhatHoSoCuaToi));

// Admin, nhanVien chỉ xem được hồ sơ của mình: service kiểm tra phạm vi
router.get('/:id', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(nhanVienController.layChiTietNhanVien));

router.patch('/:id', phanQuyen(['HR']), kiemTraDuLieu(LUAT_HO_SO), batLoiBatDongBo(nhanVienController.capNhatNhanVien));

router.post(
  '/:id/doiTrangThai',
  phanQuyen(['HR']),
  kiemTraDuLieu({
    trangThaiLamViec: { nhan: 'Trạng thái làm việc', batBuoc: true, cacGiaTri: TRANG_THAI_LAM_VIEC },
    lyDo: { nhan: 'Lý do', toiDa: 200 },
  }),
  batLoiBatDongBo(nhanVienController.doiTrangThaiNhanVien),
);

router.post(
  '/:id/dieuChuyen',
  phanQuyen(['HR']),
  kiemTraDuLieu({
    chucDanhPhongBanId: { nhan: 'Vị trí mới', batBuoc: true, kieu: 'soNguyenDuong' },
    lyDo: { nhan: 'Lý do', toiDa: 200 },
  }),
  batLoiBatDongBo(nhanVienController.dieuChuyenNhanVien),
);

module.exports = router;
