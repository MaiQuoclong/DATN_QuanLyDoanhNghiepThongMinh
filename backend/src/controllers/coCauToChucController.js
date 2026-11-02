const coCauToChucService = require('../services/coCauToChucService');
const { thanhCong } = require('../utils/phanHoi');
const { laySoNguyenDuong, layGiaTriTrongDanhSach } = require('../utils/thamSoTruyVan');

// Cơ cấu tổ chức (docs/phan-quyen.md mục 2)
const { TRANG_THAI_PHONG_BAN, TRANG_THAI_CHUC_DANH, TRANG_THAI_VI_TRI } = coCauToChucService;

const layId = (req, nhan) => laySoNguyenDuong(req.params.id, undefined, nhan);

// ----- Đọc -----
async function layDanhSachPhongBan(req, res) {
  const ds = await coCauToChucService.layDanhSachPhongBan({
    trangThai: layGiaTriTrongDanhSach(req.query.trangThai, TRANG_THAI_PHONG_BAN, 'Trạng thái'),
  });
  return thanhCong(res, ds, 'Lấy danh sách phòng ban thành công');
}

async function layChiTietPhongBan(req, res) {
  const phongBan = await coCauToChucService.layChiTietPhongBan(req.nguoiDung.vaiTro, layId(req, 'Mã phòng ban'));
  return thanhCong(res, phongBan, 'Lấy thông tin phòng ban thành công');
}

async function layDanhSachChucDanh(req, res) {
  const ds = await coCauToChucService.layDanhSachChucDanh({
    trangThai: layGiaTriTrongDanhSach(req.query.trangThai, TRANG_THAI_CHUC_DANH, 'Trạng thái'),
  });
  return thanhCong(res, ds, 'Lấy danh sách chức danh thành công');
}

// Dùng cho form thêm/điều chuyển nhân viên: ?phongBanId&trangThai, mỗi vị trí có dinhBien, soDangGiu, conTrong
async function layDanhSachViTri(req, res) {
  const ds = await coCauToChucService.layDanhSachViTri({
    phongBanId: laySoNguyenDuong(req.query.phongBanId, undefined, 'Phòng ban'),
    trangThai: layGiaTriTrongDanhSach(req.query.trangThai, TRANG_THAI_VI_TRI, 'Trạng thái'),
  });
  return thanhCong(res, ds, 'Lấy danh sách vị trí thành công');
}

// ----- Phòng ban -----
async function themPhongBan(req, res) {
  const phongBan = await coCauToChucService.themPhongBan(req.nguoiDung, req.body, req.ip);
  return thanhCong(res, phongBan, 'Thêm phòng ban thành công', 201);
}

async function suaPhongBan(req, res) {
  const phongBan = await coCauToChucService.suaPhongBan(req.nguoiDung, layId(req, 'Mã phòng ban'), req.body, req.ip);
  return thanhCong(res, phongBan, 'Cập nhật phòng ban thành công');
}

async function doiTrangThaiPhongBan(req, res) {
  const phongBan = await coCauToChucService.doiTrangThaiPhongBan(req.nguoiDung, layId(req, 'Mã phòng ban'), req.body.trangThai, req.ip);
  return thanhCong(res, phongBan, 'Đổi trạng thái phòng ban thành công');
}

async function boNhiemTruongBoPhan(req, res) {
  const phongBan = await coCauToChucService.boNhiemTruongBoPhan(req.nguoiDung, layId(req, 'Mã phòng ban'), req.body.nhanVienId, req.ip);
  return thanhCong(res, phongBan, 'Bổ nhiệm trưởng bộ phận thành công');
}

async function mienNhiemTruongBoPhan(req, res) {
  const phongBan = await coCauToChucService.mienNhiemTruongBoPhan(req.nguoiDung, layId(req, 'Mã phòng ban'), req.ip);
  return thanhCong(res, phongBan, 'Miễn nhiệm trưởng bộ phận thành công');
}

// ----- Chức danh -----
async function themChucDanh(req, res) {
  const chucDanh = await coCauToChucService.themChucDanh(req.nguoiDung, req.body, req.ip);
  return thanhCong(res, chucDanh, 'Thêm chức danh thành công', 201);
}

async function suaChucDanh(req, res) {
  const chucDanh = await coCauToChucService.suaChucDanh(req.nguoiDung, layId(req, 'Mã chức danh'), req.body, req.ip);
  return thanhCong(res, chucDanh, 'Cập nhật chức danh thành công');
}

async function doiTrangThaiChucDanh(req, res) {
  const chucDanh = await coCauToChucService.doiTrangThaiChucDanh(req.nguoiDung, layId(req, 'Mã chức danh'), req.body.trangThai, req.ip);
  return thanhCong(res, chucDanh, 'Đổi trạng thái chức danh thành công');
}

// ----- Vị trí -----
async function themViTri(req, res) {
  const viTri = await coCauToChucService.themViTri(req.nguoiDung, req.body, req.ip);
  return thanhCong(res, viTri, 'Thêm vị trí thành công', 201);
}

async function suaViTri(req, res) {
  const viTri = await coCauToChucService.suaViTri(req.nguoiDung, layId(req, 'Mã vị trí'), req.body, req.ip);
  return thanhCong(res, viTri, 'Cập nhật vị trí thành công');
}

async function doiTrangThaiViTri(req, res) {
  const viTri = await coCauToChucService.doiTrangThaiViTri(req.nguoiDung, layId(req, 'Mã vị trí'), req.body.trangThai, req.ip);
  return thanhCong(res, viTri, 'Đổi trạng thái vị trí thành công');
}

module.exports = {
  layDanhSachPhongBan,
  layChiTietPhongBan,
  layDanhSachChucDanh,
  layDanhSachViTri,
  themPhongBan,
  suaPhongBan,
  doiTrangThaiPhongBan,
  boNhiemTruongBoPhan,
  mienNhiemTruongBoPhan,
  themChucDanh,
  suaChucDanh,
  doiTrangThaiChucDanh,
  themViTri,
  suaViTri,
  doiTrangThaiViTri,
};
