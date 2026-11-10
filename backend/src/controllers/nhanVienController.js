const nhanVienService = require('../services/nhanVienService');
const LoiUngDung = require('../utils/LoiUngDung');
const { thanhCong } = require('../utils/phanHoi');
const { laySoNguyenDuong, layTuKhoa, layPhanTrang } = require('../utils/thamSoTruyVan');

function layIdTuDuongDan(req) {
  return laySoNguyenDuong(req.params.id, undefined, 'Mã nhân viên');
}

async function layDanhSachNhanVien(req, res) {
  const { tuKhoa, phongBanId } = req.query;
  // trangThaiLamViec: một giá trị hoặc nhiều giá trị cách nhau bởi dấu phẩy (THU_VIEC,CHINH_THUC)
  const chuoiTrangThai = typeof req.query.trangThaiLamViec === 'string' ? req.query.trangThaiLamViec.trim() : '';
  const trangThaiLamViec = chuoiTrangThai ? [...new Set(chuoiTrangThai.split(',').map((t) => t.trim()))] : undefined;
  if (
    (req.query.trangThaiLamViec !== undefined && typeof req.query.trangThaiLamViec !== 'string') ||
    (trangThaiLamViec ?? []).some((t) => !nhanVienService.TRANG_THAI_LAM_VIEC.includes(t))
  ) {
    throw new LoiUngDung(400, 'Trạng thái làm việc không hợp lệ');
  }
  // boQuaIds: id cách nhau bởi dấu phẩy, loại khỏi kết quả (ô chọn nhân viên bỏ người đã chọn) - tối đa 100
  const chuoiBoQua = typeof req.query.boQuaIds === 'string' ? req.query.boQuaIds.trim() : '';
  const boQuaIds = chuoiBoQua ? [...new Set(chuoiBoQua.split(',').map((t) => t.trim()))] : undefined;
  if (
    (req.query.boQuaIds !== undefined && typeof req.query.boQuaIds !== 'string') ||
    (boQuaIds ?? []).some((t) => !/^[1-9]\d{0,9}$/.test(t)) ||
    (boQuaIds?.length ?? 0) > 100
  ) {
    throw new LoiUngDung(400, 'Danh sách nhân viên bỏ qua không hợp lệ');
  }
  const { trang, kichThuoc } = layPhanTrang(req.query);
  const ketQua = await nhanVienService.layDanhSach(req.nguoiDung, {
    tuKhoa: layTuKhoa(tuKhoa),
    phongBanId: laySoNguyenDuong(phongBanId, undefined, 'Phòng ban'),
    trangThaiLamViec,
    boQuaIds: boQuaIds?.map(Number),
    trang,
    kichThuoc,
  });
  return thanhCong(res, ketQua, 'Lấy danh sách nhân viên thành công');
}

async function layHoSoCuaToi(req, res) {
  const hoSo = await nhanVienService.layHoSoCuaToi(req.nguoiDung);
  return thanhCong(res, hoSo, 'Lấy hồ sơ cá nhân thành công');
}

async function capNhatHoSoCuaToi(req, res) {
  const { hoSo, daThayDoi } = await nhanVienService.capNhatHoSoCuaToi(req.nguoiDung, req.body, req.ip);
  return thanhCong(res, hoSo, daThayDoi ? 'Cập nhật hồ sơ cá nhân thành công' : 'Không có thông tin nào thay đổi');
}

async function layChiTietNhanVien(req, res) {
  const hoSo = await nhanVienService.layChiTiet(req.nguoiDung, layIdTuDuongDan(req));
  return thanhCong(res, hoSo, 'Lấy hồ sơ nhân viên thành công');
}

async function themNhanVien(req, res) {
  const ketQua = await nhanVienService.themNhanVien(req.nguoiDung, req.body, req.ip);
  res.set('Cache-Control', 'no-store'); // response chứa mật khẩu tạm
  return thanhCong(res, ketQua, 'Thêm nhân viên thành công', 201);
}

async function capNhatNhanVien(req, res) {
  const { hoSo, daThayDoi } = await nhanVienService.capNhatHoSo(req.nguoiDung, layIdTuDuongDan(req), req.body, req.ip);
  return thanhCong(res, hoSo, daThayDoi ? 'Cập nhật hồ sơ nhân viên thành công' : 'Không có thông tin nào thay đổi');
}

async function doiTrangThaiNhanVien(req, res) {
  const hoSo = await nhanVienService.doiTrangThai(req.nguoiDung, layIdTuDuongDan(req), req.body, req.ip);
  return thanhCong(res, hoSo, 'Đổi trạng thái lao động thành công');
}

async function dieuChuyenNhanVien(req, res) {
  const hoSo = await nhanVienService.dieuChuyen(req.nguoiDung, layIdTuDuongDan(req), req.body, req.ip);
  return thanhCong(res, hoSo, 'Điều chuyển nhân viên thành công');
}

module.exports = {
  layDanhSachNhanVien,
  layHoSoCuaToi,
  capNhatHoSoCuaToi,
  layChiTietNhanVien,
  themNhanVien,
  capNhatNhanVien,
  doiTrangThaiNhanVien,
  dieuChuyenNhanVien,
};
