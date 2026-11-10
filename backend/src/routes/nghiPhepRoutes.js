const express = require('express');
const batLoiBatDongBo = require('../utils/batLoiBatDongBo');
const kiemTraDuLieu = require('../middlewares/kiemTraDuLieu');
const phanQuyen = require('../middlewares/phanQuyen');
const { xacThucJwt } = require('../middlewares/xacThucJwt');
const nghiPhepController = require('../controllers/nghiPhepController');
const { TRANG_THAI_LOAI_NGHI_PHEP } = require('../utils/trangThai');

// Quyền theo docs/phan-quyen.md mục 6
const MOI_VAI_TRO = ['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien'];
const XEM_NGHI_PHEP = ['HR', 'giamDoc', 'quanLy'];
const DUYET_DON = ['giamDoc', 'quanLy']; // service kiểm tra thêm chuỗi duyệt

// ===================== /api/v1/loaiNghiPhep =====================
const loaiNghiPhepRouter = express.Router();
loaiNghiPhepRouter.use(xacThucJwt);

loaiNghiPhepRouter.get('/', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(nghiPhepController.layDanhSachLoai));
loaiNghiPhepRouter.post(
  '/',
  phanQuyen(['HR']),
  kiemTraDuLieu({
    maLoai: { nhan: 'Mã loại', batBuoc: true, toiDa: 30 },
    tenLoai: { nhan: 'Tên loại', batBuoc: true, toiThieu: 2, toiDa: 100 },
    moTa: { nhan: 'Mô tả', toiDa: 255 },
  }),
  batLoiBatDongBo(nghiPhepController.themLoai),
);
loaiNghiPhepRouter.patch(
  '/:id',
  phanQuyen(['HR']),
  kiemTraDuLieu({
    tenLoai: { nhan: 'Tên loại', toiThieu: 2, toiDa: 100 },
    moTa: { nhan: 'Mô tả', toiDa: 255 },
    trangThai: { nhan: 'Trạng thái', cacGiaTri: TRANG_THAI_LOAI_NGHI_PHEP },
  }),
  batLoiBatDongBo(nghiPhepController.suaLoai),
);

// ===================== /api/v1/quyPhep =====================
const quyPhepRouter = express.Router();
quyPhepRouter.use(xacThucJwt);

quyPhepRouter.get('/cuaToi', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(nghiPhepController.layQuyCuaToi));
quyPhepRouter.get('/', phanQuyen(XEM_NGHI_PHEP), batLoiBatDongBo(nghiPhepController.layDanhSachQuy));
quyPhepRouter.post('/capNam', phanQuyen(['HR']), batLoiBatDongBo(nghiPhepController.capQuyNam));
quyPhepRouter.patch(
  '/:id',
  phanQuyen(['HR']),
  // tongSoNgayPhep (số, bước 0.5) do service kiểm tra
  kiemTraDuLieu({ lyDo: { nhan: 'Lý do', toiDa: 255 } }),
  batLoiBatDongBo(nghiPhepController.suaQuy),
);

// ===================== /api/v1/donNghiPhep =====================
const donNghiPhepRouter = express.Router();
donNghiPhepRouter.use(xacThucJwt);

donNghiPhepRouter.get('/', phanQuyen(XEM_NGHI_PHEP), batLoiBatDongBo(nghiPhepController.layDanhSachDon));
donNghiPhepRouter.get('/cuaToi', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(nghiPhepController.layDonCuaToi));
donNghiPhepRouter.get('/lich', phanQuyen(XEM_NGHI_PHEP), batLoiBatDongBo(nghiPhepController.layLichNghi));
donNghiPhepRouter.post(
  '/',
  phanQuyen(MOI_VAI_TRO),
  kiemTraDuLieu({
    loaiNghiPhepId: { nhan: 'Loại nghỉ phép', batBuoc: true, kieu: 'soNguyenDuong' },
    ngayBatDau: { nhan: 'Ngày bắt đầu', batBuoc: true, kieu: 'ngay' },
    ngayKetThuc: { nhan: 'Ngày kết thúc', batBuoc: true, kieu: 'ngay' },
    lyDo: { nhan: 'Lý do', batBuoc: true, toiThieu: 5, toiDa: 1000 },
  }),
  batLoiBatDongBo(nghiPhepController.taoDon),
);
donNghiPhepRouter.post('/:id/huy', phanQuyen(MOI_VAI_TRO), batLoiBatDongBo(nghiPhepController.huyDon));
donNghiPhepRouter.post('/:id/duyet', phanQuyen(DUYET_DON), batLoiBatDongBo(nghiPhepController.duyetDon));
donNghiPhepRouter.post(
  '/:id/tuChoi',
  phanQuyen(DUYET_DON),
  kiemTraDuLieu({ lyDoTuChoi: { nhan: 'Lý do từ chối', batBuoc: true, toiDa: 1000 } }),
  batLoiBatDongBo(nghiPhepController.tuChoiDon),
);

module.exports = { loaiNghiPhepRouter, quyPhepRouter, donNghiPhepRouter };
