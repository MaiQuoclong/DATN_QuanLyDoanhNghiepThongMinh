const hopDongService = require('../services/hopDongService');
const { thanhCong } = require('../utils/phanHoi');
const { TRANG_THAI_HOP_DONG } = require('../utils/trangThai');
const {
  laySoNguyenDuong, layGiaTriTrongDanhSach, layTuKhoa, layPhanTrang,
} = require('../utils/thamSoTruyVan');

const SO_NGAY_CANH_BAO_MAC_DINH = 30;
const SO_NGAY_CANH_BAO_TOI_DA = 365;

function layIdTuDuongDan(req) {
  return laySoNguyenDuong(req.params.id, undefined, 'Mã hợp đồng');
}

async function layDanhSachHopDong(req, res) {
  const { trang, kichThuoc } = layPhanTrang(req.query);
  const ketQua = await hopDongService.layDanhSach({
    tuKhoa: layTuKhoa(req.query.tuKhoa),
    nhanVienId: laySoNguyenDuong(req.query.nhanVienId, undefined, 'Nhân viên'),
    loaiHopDong: layGiaTriTrongDanhSach(req.query.loaiHopDong, hopDongService.LOAI_HOP_DONG, 'Loại hợp đồng'),
    trangThai: layGiaTriTrongDanhSach(req.query.trangThai, TRANG_THAI_HOP_DONG, 'Trạng thái hợp đồng'),
    trang,
    kichThuoc,
  });
  return thanhCong(res, ketQua, 'Lấy danh sách hợp đồng thành công');
}

async function layHopDongCuaToi(req, res) {
  const danhSach = await hopDongService.layCuaToi(req.nguoiDung);
  return thanhCong(res, danhSach, 'Lấy hợp đồng của bạn thành công');
}

async function layHopDongSapHetHan(req, res) {
  const soNgay = Math.min(
    laySoNguyenDuong(req.query.soNgay, SO_NGAY_CANH_BAO_MAC_DINH, 'Số ngày'),
    SO_NGAY_CANH_BAO_TOI_DA
  );
  const danhSach = await hopDongService.laySapHetHan(soNgay);
  return thanhCong(res, { soNgay, items: danhSach }, 'Lấy danh sách hợp đồng sắp hết hạn thành công');
}

async function layChiTietHopDong(req, res) {
  const hopDong = await hopDongService.layChiTiet(req.nguoiDung, layIdTuDuongDan(req));
  return thanhCong(res, hopDong, 'Lấy chi tiết hợp đồng thành công');
}

async function taoHopDong(req, res) {
  const hopDong = await hopDongService.taoHopDong(req.nguoiDung, req.body, req.ip);
  return thanhCong(res, hopDong, 'Lập hợp đồng thành công', 201);
}

async function giaHanHopDong(req, res) {
  const hopDong = await hopDongService.giaHanHopDong(req.nguoiDung, layIdTuDuongDan(req), req.body, req.ip);
  return thanhCong(res, hopDong, 'Gia hạn hợp đồng thành công');
}

async function dieuChinhHopDong(req, res) {
  const hopDong = await hopDongService.dieuChinhHopDong(req.nguoiDung, layIdTuDuongDan(req), req.body, req.ip);
  return thanhCong(res, hopDong, 'Điều chỉnh hợp đồng thành công');
}

async function chamDutHopDong(req, res) {
  const hopDong = await hopDongService.chamDutHopDong(req.nguoiDung, layIdTuDuongDan(req), req.body, req.ip);
  return thanhCong(res, hopDong, 'Chấm dứt hợp đồng thành công');
}

module.exports = {
  layDanhSachHopDong,
  layHopDongCuaToi,
  layHopDongSapHetHan,
  layChiTietHopDong,
  taoHopDong,
  giaHanHopDong,
  dieuChinhHopDong,
  chamDutHopDong,
};
