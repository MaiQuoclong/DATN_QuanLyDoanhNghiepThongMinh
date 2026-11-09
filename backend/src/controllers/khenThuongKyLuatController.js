const ktklService = require('../services/khenThuongKyLuatService');
const { thanhCong } = require('../utils/phanHoi');
const { LOAI_QUYET_DINH } = require('../utils/trangThai');
const {
  laySoNguyenDuong, layGiaTriTrongDanhSach, layTuKhoa, layPhanTrang,
} = require('../utils/thamSoTruyVan');

const TRANG_THAI_DE_XUAT = ['CHO_DUYET', 'DA_DUYET', 'TU_CHOI'];
const layId = (req, nhan) => laySoNguyenDuong(req.params.id, undefined, nhan);

// ===================== Đề xuất =====================

async function layDanhSachDeXuat(req, res) {
  const kq = await ktklService.layDanhSachDeXuat(req.nguoiDung, {
    trangThai: layGiaTriTrongDanhSach(req.query.trangThai, TRANG_THAI_DE_XUAT, 'Trạng thái'),
    loaiDeXuat: layGiaTriTrongDanhSach(req.query.loaiDeXuat, LOAI_QUYET_DINH, 'Loại đề xuất'),
    tuKhoa: layTuKhoa(req.query.tuKhoa),
  }, layPhanTrang(req.query));
  return thanhCong(res, kq, 'Lấy danh sách đề xuất thành công');
}

async function layChiTietDeXuat(req, res) {
  return thanhCong(res, await ktklService.layChiTietDeXuat(req.nguoiDung, layId(req, 'Mã đề xuất')), 'Lấy đề xuất thành công');
}

async function taoDeXuat(req, res) {
  return thanhCong(res, await ktklService.taoDeXuat(req.nguoiDung, req.body ?? {}, req.ip), 'Đã gửi đề xuất', 201);
}

async function suaDeXuat(req, res) {
  const dx = await ktklService.suaDeXuat(req.nguoiDung, layId(req, 'Mã đề xuất'), req.body ?? {}, req.ip);
  return thanhCong(res, dx, 'Cập nhật đề xuất thành công');
}

async function xoaDeXuat(req, res) {
  await ktklService.xoaDeXuat(req.nguoiDung, layId(req, 'Mã đề xuất'), req.ip);
  return thanhCong(res, null, 'Đã thu hồi đề xuất');
}

async function tuChoiDeXuat(req, res) {
  const dx = await ktklService.tuChoiDeXuat(req.nguoiDung, layId(req, 'Mã đề xuất'), req.body ?? {}, req.ip);
  return thanhCong(res, dx, 'Đã từ chối đề xuất');
}

async function lapQuyetDinhTuDeXuat(req, res) {
  const kq = await ktklService.lapQuyetDinhTuDeXuat(req.nguoiDung, layId(req, 'Mã đề xuất'), req.body ?? {}, req.ip);
  return thanhCong(res, kq, 'Đã lập quyết định từ đề xuất', 201);
}

// ===================== Quyết định =====================

async function layDanhSachQuyetDinh(req, res) {
  const kq = await ktklService.layDanhSachQuyetDinh(req.nguoiDung, {
    loaiQuyetDinh: layGiaTriTrongDanhSach(req.query.loaiQuyetDinh, LOAI_QUYET_DINH, 'Loại quyết định'),
    nhanVienId: laySoNguyenDuong(req.query.nhanVienId, undefined, 'Mã nhân viên'),
    phongBanId: laySoNguyenDuong(req.query.phongBanId, undefined, 'Mã phòng ban'),
    nam: laySoNguyenDuong(req.query.nam, undefined, 'Năm'),
    tuKhoa: layTuKhoa(req.query.tuKhoa),
  }, layPhanTrang(req.query));
  return thanhCong(res, kq, 'Lấy danh sách quyết định thành công');
}

async function layChiTietQuyetDinh(req, res) {
  const qd = await ktklService.layChiTietQuyetDinh(req.nguoiDung, layId(req, 'Mã quyết định'));
  return thanhCong(res, qd, 'Lấy quyết định thành công');
}

async function layDanhSachNguoiKy(req, res) {
  return thanhCong(res, await ktklService.layDanhSachNguoiKy(), 'Lấy danh sách người ký thành công');
}

async function taoQuyetDinh(req, res) {
  return thanhCong(res, await ktklService.taoQuyetDinh(req.nguoiDung, req.body ?? {}, req.ip), 'Đã lập quyết định', 201);
}

module.exports = {
  layDanhSachDeXuat, layChiTietDeXuat, taoDeXuat, suaDeXuat, xoaDeXuat, tuChoiDeXuat, lapQuyetDinhTuDeXuat,
  layDanhSachQuyetDinh, layChiTietQuyetDinh, layDanhSachNguoiKy, taoQuyetDinh,
};
