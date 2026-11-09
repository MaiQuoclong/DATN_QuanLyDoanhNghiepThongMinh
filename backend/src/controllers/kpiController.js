const kpiService = require('../services/kpiService');
const { thanhCong } = require('../utils/phanHoi');
const LoiUngDung = require('../utils/LoiUngDung');
const { TRANG_THAI_KY_DANH_GIA, TRANG_THAI_PHIEU_KPI, XEP_LOAI_KPI } = require('../utils/trangThai');
const {
  laySoNguyenDuong, layGiaTriTrongDanhSach, layTuKhoa, layPhanTrang,
} = require('../utils/thamSoTruyVan');

const layId = (req, nhan) => laySoNguyenDuong(req.params.id, undefined, nhan);

// ===================== Kỳ đánh giá =====================

async function layDanhSachKy(req, res) {
  const ds = await kpiService.layDanhSachKy({
    trangThai: layGiaTriTrongDanhSach(req.query.trangThai, TRANG_THAI_KY_DANH_GIA, 'Trạng thái'),
  });
  return thanhCong(res, ds, 'Lấy danh sách kỳ đánh giá thành công');
}

async function layChiTietKy(req, res) {
  return thanhCong(res, await kpiService.layChiTietKy(layId(req, 'Mã kỳ đánh giá')), 'Lấy kỳ đánh giá thành công');
}

async function themKy(req, res) {
  const ky = await kpiService.themKy(req.nguoiDung, req.body, req.ip);
  return thanhCong(res, ky, 'Đã mở kỳ đánh giá', 201);
}

async function suaKy(req, res) {
  const ky = await kpiService.suaKy(req.nguoiDung, layId(req, 'Mã kỳ đánh giá'), req.body ?? {}, req.ip);
  return thanhCong(res, ky, 'Cập nhật kỳ đánh giá thành công');
}

async function dongKy(req, res) {
  return thanhCong(res, await kpiService.dongKy(req.nguoiDung, layId(req, 'Mã kỳ đánh giá'), req.ip), 'Đã đóng kỳ đánh giá');
}

async function moLaiKy(req, res) {
  return thanhCong(res, await kpiService.moLaiKy(req.nguoiDung, layId(req, 'Mã kỳ đánh giá'), req.ip), 'Đã mở lại kỳ đánh giá');
}

async function xoaKy(req, res) {
  await kpiService.xoaKy(req.nguoiDung, layId(req, 'Mã kỳ đánh giá'), req.ip);
  return thanhCong(res, null, 'Đã xóa kỳ đánh giá');
}

// ===================== Chỉ tiêu =====================

async function layDanhSachChiTieu(req, res) {
  const ds = await kpiService.layDanhSachChiTieu(req.nguoiDung, {
    chucDanhPhongBanId: laySoNguyenDuong(req.query.chucDanhPhongBanId, undefined, 'Vị trí'),
    phongBanId: laySoNguyenDuong(req.query.phongBanId, undefined, 'Phòng ban'),
    chiTieuChung: req.query.chiTieuChung === 'true',
    tuKhoa: layTuKhoa(req.query.tuKhoa),
  });
  return thanhCong(res, ds, 'Lấy danh sách chỉ tiêu KPI thành công');
}

async function layViTriGanChiTieu(req, res) {
  return thanhCong(res, await kpiService.layViTriGanChiTieu(req.nguoiDung), 'Lấy danh sách vị trí thành công');
}

async function themChiTieu(req, res) {
  return thanhCong(res, await kpiService.themChiTieu(req.nguoiDung, req.body, req.ip), 'Thêm chỉ tiêu KPI thành công', 201);
}

async function suaChiTieu(req, res) {
  const ct = await kpiService.suaChiTieu(req.nguoiDung, layId(req, 'Mã chỉ tiêu'), req.body ?? {}, req.ip);
  return thanhCong(res, ct, 'Cập nhật chỉ tiêu KPI thành công');
}

async function xoaChiTieu(req, res) {
  await kpiService.xoaChiTieu(req.nguoiDung, layId(req, 'Mã chỉ tiêu'), req.ip);
  return thanhCong(res, null, 'Đã xóa chỉ tiêu KPI');
}

// ===================== Phiếu đánh giá =====================

function layBoLocPhieu(query) {
  return {
    kyDanhGiaId: laySoNguyenDuong(query.kyDanhGiaId, undefined, 'Kỳ đánh giá'),
    phongBanId: laySoNguyenDuong(query.phongBanId, undefined, 'Phòng ban'),
    trangThai: layGiaTriTrongDanhSach(query.trangThai, TRANG_THAI_PHIEU_KPI, 'Trạng thái'),
    xepLoaiChung: layGiaTriTrongDanhSach(query.xepLoaiChung, XEP_LOAI_KPI, 'Xếp loại'),
    tuKhoa: layTuKhoa(query.tuKhoa),
  };
}

async function layDanhSachPhieu(req, res) {
  const ketQua = await kpiService.layDanhSachPhieu(req.nguoiDung, { ...layBoLocPhieu(req.query), ...layPhanTrang(req.query) });
  return thanhCong(res, ketQua, 'Lấy danh sách phiếu đánh giá thành công');
}

async function layPhieuCuaToi(req, res) {
  const ds = await kpiService.layPhieuCuaToi(req.nguoiDung, {
    kyDanhGiaId: laySoNguyenDuong(req.query.kyDanhGiaId, undefined, 'Kỳ đánh giá'),
  });
  return thanhCong(res, ds, 'Lấy phiếu đánh giá của tôi thành công');
}

async function layChiTietPhieu(req, res) {
  return thanhCong(res, await kpiService.layChiTietPhieu(req.nguoiDung, layId(req, 'Mã phiếu')), 'Lấy phiếu đánh giá thành công');
}

async function layBaoCao(req, res) {
  const kyDanhGiaId = laySoNguyenDuong(req.query.kyDanhGiaId, undefined, 'Kỳ đánh giá');
  if (!kyDanhGiaId) throw new LoiUngDung(400, 'Kỳ đánh giá không được để trống');
  const ketQua = await kpiService.layBaoCao(req.nguoiDung, {
    kyDanhGiaId, phongBanId: laySoNguyenDuong(req.query.phongBanId, undefined, 'Phòng ban'),
  });
  return thanhCong(res, ketQua, 'Lấy báo cáo xếp loại KPI thành công');
}

async function taoPhieu(req, res) {
  return thanhCong(res, await kpiService.taoPhieu(req.nguoiDung, req.body, req.ip), 'Tạo phiếu đánh giá thành công', 201);
}

async function taoPhieuHangLoat(req, res) {
  const kq = await kpiService.taoPhieuHangLoat(req.nguoiDung, req.body, req.ip);
  const boQua = kq.soBoQuaChuaCoChiTieu ? `, bỏ qua ${kq.soBoQuaChuaCoChiTieu} người chưa có chỉ tiêu` : '';
  return thanhCong(res, kq, `Đã tạo ${kq.soPhieuTao} phiếu đánh giá${boQua}`, 201);
}

async function suaPhieu(req, res) {
  const phieu = await kpiService.suaPhieu(req.nguoiDung, layId(req, 'Mã phiếu'), req.body ?? {}, req.ip);
  return thanhCong(res, phieu, 'Cập nhật mục tiêu thành công');
}

async function xoaPhieu(req, res) {
  await kpiService.xoaPhieu(req.nguoiDung, layId(req, 'Mã phiếu'), req.ip);
  return thanhCong(res, null, 'Đã xóa phiếu đánh giá');
}

async function tuCham(req, res) {
  return thanhCong(res, await kpiService.tuCham(req.nguoiDung, layId(req, 'Mã phiếu'), req.body ?? {}), 'Đã lưu tự chấm');
}

async function guiDuyet(req, res) {
  return thanhCong(res, await kpiService.guiDuyet(req.nguoiDung, layId(req, 'Mã phiếu'), req.ip), 'Đã gửi phiếu chờ nghiệm thu');
}

async function nghiemThu(req, res) {
  const phieu = await kpiService.nghiemThu(req.nguoiDung, layId(req, 'Mã phiếu'), req.body ?? {}, req.ip);
  return thanhCong(res, phieu, [`Đã nghiệm thu: ${phieu.diemTong} điểm`, phieu.canhBao].filter(Boolean).join('. '));
}

async function traLai(req, res) {
  const phieu = await kpiService.traLai(req.nguoiDung, layId(req, 'Mã phiếu'), req.body ?? {}, req.ip);
  return thanhCong(res, phieu, 'Đã trả lại phiếu cho nhân viên');
}

module.exports = {
  layDanhSachKy, layChiTietKy, themKy, suaKy, dongKy, moLaiKy, xoaKy,
  layDanhSachChiTieu, layViTriGanChiTieu, themChiTieu, suaChiTieu, xoaChiTieu,
  layDanhSachPhieu, layPhieuCuaToi, layChiTietPhieu, layBaoCao, taoPhieu, taoPhieuHangLoat, suaPhieu, xoaPhieu,
  tuCham, guiDuyet, nghiemThu, traLai,
};
