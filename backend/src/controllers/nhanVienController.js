const nhanVienService = require('../services/nhanVienService');
const LoiUngDung = require('../utils/LoiUngDung');
const { thanhCong } = require('../utils/phanHoi');
const { laySoNguyenDuong, layTuKhoa, layPhanTrang } = require('../utils/thamSoTruyVan');

function layIdTuDuongDan(req) {
  return laySoNguyenDuong(req.params.id, undefined, 'Mã nhân viên');
}

// trangThaiLamViec: một giá trị hoặc nhiều giá trị cách nhau bởi dấu phẩy (THU_VIEC,CHINH_THUC)
function docTrangThaiLamViec(query) {
  const chuoiTrangThai = typeof query.trangThaiLamViec === 'string' ? query.trangThaiLamViec.trim() : '';
  const trangThaiLamViec = chuoiTrangThai ? [...new Set(chuoiTrangThai.split(',').map((t) => t.trim()))] : undefined;
  if (
    (query.trangThaiLamViec !== undefined && typeof query.trangThaiLamViec !== 'string') ||
    (trangThaiLamViec ?? []).some((t) => !nhanVienService.TRANG_THAI_LAM_VIEC.includes(t))
  ) {
    throw new LoiUngDung(400, 'Trạng thái làm việc không hợp lệ');
  }
  return trangThaiLamViec;
}

// Bộ lọc dùng chung cho danh sách và xuất Excel (hai nơi luôn lọc giống nhau)
function docBoLocNhanVien(query) {
  return {
    tuKhoa: layTuKhoa(query.tuKhoa),
    phongBanId: laySoNguyenDuong(query.phongBanId, undefined, 'Phòng ban'),
    trangThaiLamViec: docTrangThaiLamViec(query),
  };
}

async function xuatExcelNhanVien(req, res) {
  const { tenFile, noiDung } = await nhanVienService.xuatExcel(req.nguoiDung, docBoLocNhanVien(req.query), req.ip);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${tenFile}"`);
  res.setHeader('Cache-Control', 'no-store'); // tệp chứa dữ liệu cá nhân
  return res.status(200).send(noiDung);
}

async function layDanhSachNhanVien(req, res) {
  const boLoc = docBoLocNhanVien(req.query);
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
    ...boLoc,
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
  xuatExcelNhanVien,
  layDanhSachNhanVien,
  layHoSoCuaToi,
  capNhatHoSoCuaToi,
  layChiTietNhanVien,
  themNhanVien,
  capNhatNhanVien,
  doiTrangThaiNhanVien,
  dieuChuyenNhanVien,
};
