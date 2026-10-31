const { pool } = require('../config/ketNoiCsdl');

const COT_DANH_SACH = `nv.id, nv.maNhanVien, nv.hoVaTen, nv.gioiTinh, nv.ngaySinh, nv.soDienThoai,
       nv.chucDanhPhongBanId, cdpb.phongBanId, pb.maPhongBan, pb.tenPhongBan,
       cdpb.chucDanhId, cd.tenChucDanh, nv.ngayVaoLam, nv.trangThaiLamViec`;

const BANG_NOI = `FROM nhanvien nv
       JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId
       JOIN phongban pb ON pb.id = cdpb.phongBanId
       JOIN chucdanh cd ON cd.id = cdpb.chucDanhId`;

// Các cột service được phép cập nhật (tên cột lấy từ code, không lấy từ request)
const COT_CAP_NHAT = [
  'hoVaTen', 'gioiTinh', 'ngaySinh', 'soDienThoai', 'diaChi',
  'soTaiKhoanNganHang', 'tenNganHang', 'ngayVaoLam', 'trangThaiLamViec', 'chucDanhPhongBanId',
];

// boLoc.phamViPhongBanIds: null = toàn công ty, mảng = chỉ các phòng ban đó (quanLy)
async function layDanhSach({ tuKhoa, phongBanId, trangThaiLamViec, phamViPhongBanIds, viTri, soLuong }) {
  const dieuKien = [];
  const thamSo = [];
  if (phamViPhongBanIds) {
    if (phamViPhongBanIds.length === 0) return { items: [], tongSo: 0 };
    dieuKien.push(`cdpb.phongBanId IN (${phamViPhongBanIds.map(() => '?').join(', ')})`);
    thamSo.push(...phamViPhongBanIds);
  }
  if (tuKhoa) {
    dieuKien.push('(nv.maNhanVien LIKE ? OR nv.hoVaTen LIKE ? OR nv.soDienThoai LIKE ?)');
    const mau = `%${tuKhoa.replace(/[\\%_]/g, '\\$&')}%`;
    thamSo.push(mau, mau, mau);
  }
  if (phongBanId) {
    dieuKien.push('cdpb.phongBanId = ?');
    thamSo.push(phongBanId);
  }
  if (trangThaiLamViec) {
    dieuKien.push('nv.trangThaiLamViec = ?');
    thamSo.push(trangThaiLamViec);
  }
  const where = dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : '';

  const [[dem]] = await pool.query(`SELECT COUNT(*) AS tongSo ${BANG_NOI} ${where}`, thamSo);
  const [items] = await pool.query(
    `SELECT ${COT_DANH_SACH} ${BANG_NOI} ${where} ORDER BY nv.maNhanVien LIMIT ? OFFSET ?`,
    [...thamSo, soLuong, viTri]
  );
  return { items, tongSo: Number(dem.tongSo) };
}

// Hồ sơ đầy đủ (kèm ngân hàng, tài khoản); service quyết định cột nào được trả ra theo quyền
async function layTheoId(id, ketNoi = pool) {
  const [dong] = await ketNoi.execute(
    `SELECT ${COT_DANH_SACH}, nv.diaChi, nv.soTaiKhoanNganHang, nv.tenNganHang,
            nv.nguoiDungId, nd.tenDangNhap, nd.email, nd.trangThai AS trangThaiTaiKhoan,
            nv.ngayTao, nv.ngayCapNhat
       ${BANG_NOI}
       LEFT JOIN nguoidung nd ON nd.id = nv.nguoiDungId
      WHERE nv.id = ?`,
    [id]
  );
  return dong[0] ?? null;
}

// Số thứ tự mã NVxxxx lớn nhất; FOR UPDATE để hai HR tạo cùng lúc không sinh trùng mã
async function laySoMaLonNhat(ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT MAX(CAST(SUBSTRING(maNhanVien, 3) AS UNSIGNED)) AS soLonNhat
       FROM nhanvien
      WHERE maNhanVien REGEXP '^NV[0-9]+$'
      FOR UPDATE`
  );
  return Number(dong[0].soLonNhat ?? 0);
}

// Quân số đang giữ vị trí (không tính người đã nghỉ việc và người đang được điều chuyển).
// Phải là câu đọc có khóa: ở REPEATABLE READ, SELECT thường đọc ảnh chụp cũ và không thấy
// nhân viên mà transaction khác vừa commit -> vượt định biên.
async function demTheoViTri(chucDanhPhongBanId, boQuaNhanVienId, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT id FROM nhanvien
      WHERE chucDanhPhongBanId = ? AND trangThaiLamViec <> 'DA_NGHI_VIEC' AND id <> ?
      FOR UPDATE`,
    [chucDanhPhongBanId, boQuaNhanVienId ?? 0]
  );
  return dong.length;
}

// Khóa dòng nhân viên trước khi đổi trạng thái/điều chuyển để hai HR không ghi đè nhau
async function khoaNhanVien(id, ketNoi) {
  const [dong] = await ketNoi.execute('SELECT id FROM nhanvien WHERE id = ? FOR UPDATE', [id]);
  return dong.length > 0;
}

async function them(nv, ketNoi) {
  const [ketQua] = await ketNoi.execute(
    `INSERT INTO nhanvien (maNhanVien, nguoiDungId, hoVaTen, gioiTinh, ngaySinh, soDienThoai, diaChi,
                           soTaiKhoanNganHang, tenNganHang, chucDanhPhongBanId, ngayVaoLam, trangThaiLamViec)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nv.maNhanVien, nv.nguoiDungId, nv.hoVaTen, nv.gioiTinh, nv.ngaySinh, nv.soDienThoai, nv.diaChi,
      nv.soTaiKhoanNganHang, nv.tenNganHang, nv.chucDanhPhongBanId, nv.ngayVaoLam, nv.trangThaiLamViec,
    ]
  );
  return ketQua.insertId;
}

async function capNhat(id, truong, ketNoi = pool) {
  const cot = Object.keys(truong).filter((ten) => COT_CAP_NHAT.includes(ten));
  if (cot.length === 0) return;
  await ketNoi.execute(
    `UPDATE nhanvien SET ${cot.map((ten) => `${ten} = ?`).join(', ')} WHERE id = ?`,
    [...cot.map((ten) => truong[ten]), id]
  );
}

module.exports = { layDanhSach, layTheoId, laySoMaLonNhat, demTheoViTri, khoaNhanVien, them, capNhat };
