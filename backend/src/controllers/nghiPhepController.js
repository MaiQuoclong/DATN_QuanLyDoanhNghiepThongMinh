const nghiPhepService = require('../services/nghiPhepService');
const { thanhCong } = require('../utils/phanHoi');
const { TRANG_THAI_DON_NGHI_PHEP, TRANG_THAI_LOAI_NGHI_PHEP } = require('../utils/trangThai');
const { laySoNguyenDuong, layThang, layGiaTriTrongDanhSach, layTuKhoa, layPhanTrang } = require('../utils/thamSoTruyVan');

const { thangHienTai } = require('../utils/ngayThang');

function layIdTuDuongDan(req, nhan) {
  return laySoNguyenDuong(req.params.id, undefined, nhan);
}

// ===================== Loại nghỉ phép =====================

async function layDanhSachLoai(req, res) {
  const trangThai = layGiaTriTrongDanhSach(req.query.trangThai, TRANG_THAI_LOAI_NGHI_PHEP, 'Trạng thái');
  return thanhCong(res, await nghiPhepService.layDanhSachLoai({ trangThai }), 'Lấy danh sách loại nghỉ phép thành công');
}

async function themLoai(req, res) {
  const loai = await nghiPhepService.themLoai(req.nguoiDung, req.body, req.ip);
  return thanhCong(res, loai, 'Thêm loại nghỉ phép thành công', 201);
}

async function suaLoai(req, res) {
  const loai = await nghiPhepService.suaLoai(req.nguoiDung, layIdTuDuongDan(req, 'Mã loại nghỉ phép'), req.body, req.ip);
  return thanhCong(res, loai, 'Cập nhật loại nghỉ phép thành công');
}

// ===================== Quỹ phép =====================

async function layQuyCuaToi(req, res) {
  return thanhCong(res, await nghiPhepService.layQuyCuaToi(req.nguoiDung, req.query.nam), 'Lấy quỹ phép của bạn thành công');
}

async function layDanhSachQuy(req, res) {
  const { trang, kichThuoc } = layPhanTrang(req.query);
  const ketQua = await nghiPhepService.layDanhSachQuy(req.nguoiDung, {
    nam: req.query.nam,
    phongBanId: laySoNguyenDuong(req.query.phongBanId, undefined, 'Phòng ban'),
    tuKhoa: layTuKhoa(req.query.tuKhoa),
    trang,
    kichThuoc,
  });
  return thanhCong(res, ketQua, 'Lấy danh sách quỹ phép thành công');
}

async function capQuyNam(req, res) {
  const ketQua = await nghiPhepService.capQuyNam(req.nguoiDung, req.body, req.ip);
  return thanhCong(res, ketQua, `Đã cấp quỹ phép năm ${ketQua.nam} cho ${ketQua.soNhanVien} nhân viên`);
}

async function suaQuy(req, res) {
  const quy = await nghiPhepService.suaQuy(req.nguoiDung, layIdTuDuongDan(req, 'Mã quỹ phép'), req.body, req.ip);
  return thanhCong(res, quy, 'Cập nhật quỹ phép thành công');
}

// ===================== Đơn nghỉ phép =====================

function layBoLocDon(req) {
  const { trang, kichThuoc } = layPhanTrang(req.query);
  return {
    thang: layThang(req.query.thang),
    trangThai: layGiaTriTrongDanhSach(req.query.trangThai, TRANG_THAI_DON_NGHI_PHEP, 'Trạng thái'),
    loaiNghiPhepId: laySoNguyenDuong(req.query.loaiNghiPhepId, undefined, 'Loại nghỉ phép'),
    phongBanId: laySoNguyenDuong(req.query.phongBanId, undefined, 'Phòng ban'),
    tuKhoa: layTuKhoa(req.query.tuKhoa),
    trang,
    kichThuoc,
  };
}

async function taoDon(req, res) {
  const don = await nghiPhepService.taoDon(req.nguoiDung, req.body);
  return thanhCong(res, don, `Đã gửi đơn ${don.maDon}, chờ duyệt`, 201);
}

async function huyDon(req, res) {
  const don = await nghiPhepService.huyDon(req.nguoiDung, layIdTuDuongDan(req, 'Mã đơn'), req.ip);
  return thanhCong(res, don, `Đã hủy đơn ${don.maDon}`);
}

async function layDonCuaToi(req, res) {
  return thanhCong(res, await nghiPhepService.layDonCuaToi(req.nguoiDung, layBoLocDon(req)), 'Lấy đơn nghỉ phép của bạn thành công');
}

async function layDanhSachDon(req, res) {
  return thanhCong(res, await nghiPhepService.layDanhSachDon(req.nguoiDung, layBoLocDon(req)), 'Lấy danh sách đơn nghỉ phép thành công');
}

async function layLichNghi(req, res) {
  const ketQua = await nghiPhepService.layLichNghi(req.nguoiDung, {
    thang: layThang(req.query.thang, thangHienTai()),
    phongBanId: laySoNguyenDuong(req.query.phongBanId, undefined, 'Phòng ban'),
  });
  return thanhCong(res, ketQua, 'Lấy lịch nghỉ thành công');
}

async function duyetDon(req, res) {
  const don = await nghiPhepService.duyetDon(req.nguoiDung, layIdTuDuongDan(req, 'Mã đơn'), req.ip);
  return thanhCong(res, don, `Đã duyệt đơn ${don.maDon}`);
}

async function tuChoiDon(req, res) {
  const don = await nghiPhepService.tuChoiDon(req.nguoiDung, layIdTuDuongDan(req, 'Mã đơn'), req.body, req.ip);
  return thanhCong(res, don, `Đã từ chối đơn ${don.maDon}`);
}

module.exports = {
  layDanhSachLoai,
  themLoai,
  suaLoai,
  layQuyCuaToi,
  layDanhSachQuy,
  capQuyNam,
  suaQuy,
  taoDon,
  huyDon,
  layDonCuaToi,
  layDanhSachDon,
  layLichNghi,
  duyetDon,
  tuChoiDon,
};
