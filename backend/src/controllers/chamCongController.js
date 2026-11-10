const chamCongService = require('../services/chamCongService');
const { thanhCong } = require('../utils/phanHoi');
const { TRANG_THAI_DIEU_CHINH_CONG } = require('../utils/trangThai');
const { laySoNguyenDuong, layThang, layGiaTriTrongDanhSach, layTuKhoa, layPhanTrang } = require('../utils/thamSoTruyVan');

function layIdTuDuongDan(req, nhan = 'Mã yêu cầu') {
  return laySoNguyenDuong(req.params.id, undefined, nhan);
}

// ===================== Chấm công =====================

async function layHomNay(req, res) {
  return thanhCong(res, await chamCongService.layHomNay(req.nguoiDung), 'Lấy chấm công hôm nay thành công');
}

async function checkIn(req, res) {
  return thanhCong(res, await chamCongService.checkIn(req.nguoiDung), 'Check-in thành công', 201);
}

async function checkOut(req, res) {
  return thanhCong(res, await chamCongService.checkOut(req.nguoiDung), 'Check-out thành công');
}

async function layCuaToi(req, res) {
  const ketQua = await chamCongService.layCuaToi(req.nguoiDung, layThang(req.query.thang));
  return thanhCong(res, ketQua, 'Lấy lịch công của bạn thành công');
}

async function layBangCong(req, res) {
  const { trang, kichThuoc } = layPhanTrang(req.query);
  const ketQua = await chamCongService.layBangCong(req.nguoiDung, {
    thang: layThang(req.query.thang),
    phongBanId: laySoNguyenDuong(req.query.phongBanId, undefined, 'Phòng ban'),
    tuKhoa: layTuKhoa(req.query.tuKhoa),
    trang,
    kichThuoc,
  });
  return thanhCong(res, ketQua, 'Lấy bảng công tháng thành công');
}

async function layCongNhanVien(req, res) {
  const ketQua = await chamCongService.layCongNhanVien(req.nguoiDung, layIdTuDuongDan(req, 'Mã nhân viên'), layThang(req.query.thang));
  return thanhCong(res, ketQua, 'Lấy bảng công của nhân viên thành công');
}

async function layDanhSachThangDaChot(req, res) {
  return thanhCong(res, await chamCongService.layDanhSachThangDaChot(), 'Lấy danh sách tháng đã chốt công thành công');
}

async function chotCong(req, res) {
  const ketQua = await chamCongService.chotCong(req.nguoiDung, req.body.thang, req.ip);
  return thanhCong(res, ketQua, `Chốt công tháng ${ketQua.thang} thành công`);
}

// ===================== Điều chỉnh công =====================

function layBoLocYeuCau(req) {
  const { trang, kichThuoc } = layPhanTrang(req.query);
  return {
    thang: layThang(req.query.thang),
    trangThai: layGiaTriTrongDanhSach(req.query.trangThai, TRANG_THAI_DIEU_CHINH_CONG, 'Trạng thái'),
    phongBanId: laySoNguyenDuong(req.query.phongBanId, undefined, 'Phòng ban'),
    tuKhoa: layTuKhoa(req.query.tuKhoa),
    trang,
    kichThuoc,
  };
}

async function taoYeuCau(req, res) {
  const yeuCau = await chamCongService.taoYeuCau(req.nguoiDung, req.body);
  return thanhCong(res, yeuCau, 'Gửi yêu cầu điều chỉnh công thành công', 201);
}

async function layYeuCauCuaToi(req, res) {
  const ketQua = await chamCongService.layYeuCauCuaToi(req.nguoiDung, layBoLocYeuCau(req));
  return thanhCong(res, ketQua, 'Lấy yêu cầu điều chỉnh công của bạn thành công');
}

async function layDanhSachYeuCau(req, res) {
  const ketQua = await chamCongService.layDanhSachYeuCau(req.nguoiDung, layBoLocYeuCau(req));
  return thanhCong(res, ketQua, 'Lấy danh sách yêu cầu điều chỉnh công thành công');
}

async function duyetYeuCau(req, res) {
  const yeuCau = await chamCongService.duyetYeuCau(req.nguoiDung, layIdTuDuongDan(req), req.ip);
  return thanhCong(res, yeuCau, 'Duyệt yêu cầu điều chỉnh công thành công');
}

async function tuChoiYeuCau(req, res) {
  const yeuCau = await chamCongService.tuChoiYeuCau(req.nguoiDung, layIdTuDuongDan(req), req.body, req.ip);
  return thanhCong(res, yeuCau, 'Từ chối yêu cầu điều chỉnh công thành công');
}

module.exports = {
  layHomNay,
  checkIn,
  checkOut,
  layCuaToi,
  layBangCong,
  layCongNhanVien,
  layDanhSachThangDaChot,
  chotCong,
  taoYeuCau,
  layYeuCauCuaToi,
  layDanhSachYeuCau,
  duyetYeuCau,
  tuChoiYeuCau,
};
