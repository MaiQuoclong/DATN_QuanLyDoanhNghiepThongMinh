const luongService = require('../services/luongService');
const { thanhCong } = require('../utils/phanHoi');
const LoiUngDung = require('../utils/LoiUngDung');
const { TRANG_THAI_BANG_LUONG } = require('../utils/trangThai');
const { laySoNguyenDuong, layThang, layGiaTriTrongDanhSach, layTuKhoa, layPhanTrang } = require('../utils/thamSoTruyVan');
const { ngayHomNay } = require('../utils/ngayThang');

const layId = (req, nhan) => laySoNguyenDuong(req.params.id, undefined, nhan);
const namHienTai = () => Number(ngayHomNay().slice(0, 4));

function layNam(giaTri, macDinh) {
  if (giaTri === undefined || giaTri === '') return macDinh;
  if (!/^\d{4}$/.test(String(giaTri)) || Number(giaTri) < 2000 || Number(giaTri) > 2100) {
    throw new LoiUngDung(400, 'Năm phải là số từ 2000 đến 2100');
  }
  return Number(giaTri);
}

// ===================== Bảng lương =====================

async function layDanhSachBang(req, res) {
  const ketQua = await luongService.layDanhSachBang({
    nam: layNam(req.query.nam),
    trangThai: layGiaTriTrongDanhSach(req.query.trangThai, TRANG_THAI_BANG_LUONG, 'Trạng thái'),
  });
  return thanhCong(res, ketQua, 'Lấy danh sách bảng lương thành công');
}

async function layChiTietBang(req, res) {
  const { trang, kichThuoc, viTri, soLuong } = layPhanTrang(req.query);
  const ketQua = await luongService.layChiTietBang(layId(req, 'Mã bảng lương'), {
    phongBanId: laySoNguyenDuong(req.query.phongBanId, undefined, 'Phòng ban'),
    tuKhoa: layTuKhoa(req.query.tuKhoa),
    trang,
    kichThuoc,
    viTri,
    soLuong,
  });
  return thanhCong(res, ketQua, 'Lấy chi tiết bảng lương thành công');
}

async function lapBang(req, res) {
  const thang = layThang(req.body?.thang, undefined);
  if (!thang) throw new LoiUngDung(400, 'Tháng không được để trống');
  const bang = await luongService.lapBang(req.nguoiDung, thang, req.ip);
  return thanhCong(res, bang, `Đã lập bảng lương tháng ${thang} (${bang.soPhieu} phiếu)`, 201);
}

async function tinhLaiBang(req, res) {
  const bang = await luongService.tinhLaiBang(req.nguoiDung, layId(req, 'Mã bảng lương'), req.ip);
  return thanhCong(res, bang, 'Đã tính lại bảng lương');
}

async function xoaBang(req, res) {
  await luongService.xoaBang(req.nguoiDung, layId(req, 'Mã bảng lương'), req.ip);
  return thanhCong(res, null, 'Đã xóa bảng lương nháp');
}

async function guiDuyet(req, res) {
  const bang = await luongService.guiDuyet(req.nguoiDung, layId(req, 'Mã bảng lương'), req.ip);
  return thanhCong(res, bang, 'Đã gửi bảng lương cho giám đốc duyệt');
}

async function duyetBang(req, res) {
  const bang = await luongService.duyetBang(req.nguoiDung, layId(req, 'Mã bảng lương'), req.ip);
  return thanhCong(res, bang, 'Đã duyệt bảng lương');
}

async function traLaiBang(req, res) {
  const bang = await luongService.traLaiBang(req.nguoiDung, layId(req, 'Mã bảng lương'), req.body.lyDo, req.ip);
  return thanhCong(res, bang, 'Đã trả lại bảng lương cho HR');
}

async function layBaoCao(req, res) {
  const baoCao = await luongService.layBaoCaoQuyLuong(layNam(req.query.nam, namHienTai()));
  return thanhCong(res, baoCao, 'Lấy báo cáo quỹ lương thành công');
}

async function xuatExcel(req, res) {
  const { tenFile, noiDung } = await luongService.xuatExcel(layId(req, 'Mã bảng lương'));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${tenFile}"`);
  return res.status(200).send(noiDung);
}

// ===================== Phiếu lương =====================

async function layPhieuCuaToi(req, res) {
  const ketQua = await luongService.layPhieuCuaToi(req.nguoiDung, layNam(req.query.nam));
  return thanhCong(res, ketQua, 'Lấy phiếu lương của bạn thành công');
}

async function layPhieu(req, res) {
  return thanhCong(res, await luongService.layPhieu(req.nguoiDung, layId(req, 'Mã phiếu lương')), 'Lấy phiếu lương thành công');
}

async function suaPhieu(req, res) {
  const phieu = await luongService.suaPhieu(req.nguoiDung, layId(req, 'Mã phiếu lương'), req.body ?? {}, req.ip);
  return thanhCong(res, phieu, 'Cập nhật phiếu lương thành công');
}

module.exports = {
  layDanhSachBang,
  layChiTietBang,
  lapBang,
  tinhLaiBang,
  xoaBang,
  guiDuyet,
  duyetBang,
  traLaiBang,
  layBaoCao,
  xuatExcel,
  layPhieuCuaToi,
  layPhieu,
  suaPhieu,
};
