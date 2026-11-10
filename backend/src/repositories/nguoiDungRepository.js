const { pool } = require('../config/ketNoiCsdl');

// Chỉ hàm layMatKhauMaHoa / timDeDangNhap trả cột matKhauMaHoa; service không được trả cột này ra API
async function timDeDangNhap(tenDangNhapHoacEmail) {
  const [dong] = await pool.execute(
    `SELECT nd.id, nd.tenDangNhap, nd.matKhauMaHoa, nd.trangThai
       FROM nguoidung nd
      WHERE nd.tenDangNhap = ? OR nd.email = ?
      LIMIT 1`,
    [tenDangNhapHoacEmail, tenDangNhapHoacEmail],
  );
  return dong[0] ?? null;
}

// ketNoi (transaction): khóa FOR UPDATE để không ai đổi/cấp lại mật khẩu chen giữa lúc kiểm tra và cập nhật
async function layMatKhauMaHoa(nguoiDungId, ketNoi = null) {
  const [dong] = await (ketNoi ?? pool).execute(`SELECT matKhauMaHoa FROM nguoidung WHERE id = ?${ketNoi ? ' FOR UPDATE' : ''}`, [
    nguoiDungId,
  ]);
  return dong[0]?.matKhauMaHoa ?? null;
}

// Thông tin công khai của tài khoản kèm hồ sơ nhân viên (nếu có)
async function layThongTin(nguoiDungId) {
  const [dong] = await pool.execute(
    `SELECT nd.id AS nguoiDungId, nd.tenDangNhap, nd.email, nd.trangThai, nd.lanDangNhapCuoi,
            nv.id AS nhanVienId, nv.maNhanVien, nv.hoVaTen
       FROM nguoidung nd
       LEFT JOIN nhanvien nv ON nv.nguoiDungId = nd.id
      WHERE nd.id = ?`,
    [nguoiDungId],
  );
  return dong[0] ?? null;
}

async function layDanhSachVaiTro(nguoiDungId, ketNoi = pool) {
  const [dong] = await ketNoi.execute(
    `SELECT vt.maVaiTro
       FROM nguoidungvaitro ndvt
       JOIN vaitro vt ON vt.id = ndvt.vaiTroId
      WHERE ndvt.nguoiDungId = ?`,
    [nguoiDungId],
  );
  return dong.map((d) => d.maVaiTro);
}

async function capNhatMatKhau(nguoiDungId, matKhauMaHoa, ketNoi = pool) {
  await ketNoi.execute('UPDATE nguoidung SET matKhauMaHoa = ? WHERE id = ?', [matKhauMaHoa, nguoiDungId]);
}

async function capNhatLanDangNhapCuoi(nguoiDungId) {
  await pool.execute('UPDATE nguoidung SET lanDangNhapCuoi = NOW() WHERE id = ?', [nguoiDungId]);
}

async function timTheoTenHoacEmail(tenDangNhap, email, ketNoi = pool) {
  const [dong] = await ketNoi.execute('SELECT id, tenDangNhap, email FROM nguoidung WHERE tenDangNhap = ? OR email = ? LIMIT 1', [
    tenDangNhap,
    email,
  ]);
  return dong[0] ?? null;
}

async function themNguoiDung({ tenDangNhap, email, matKhauMaHoa }, ketNoi = pool) {
  const [ketQua] = await ketNoi.execute('INSERT INTO nguoidung (tenDangNhap, email, matKhauMaHoa) VALUES (?, ?, ?)', [
    tenDangNhap,
    email,
    matKhauMaHoa,
  ]);
  return ketQua.insertId;
}

async function ganVaiTro(nguoiDungId, maVaiTro, ketNoi = pool) {
  const [ketQua] = await ketNoi.execute(
    `INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId)
     SELECT ?, id FROM vaitro WHERE maVaiTro = ?`,
    [nguoiDungId, maVaiTro],
  );
  return ketQua.affectedRows;
}

async function goVaiTro(nguoiDungId, maVaiTro, ketNoi = pool) {
  const [ketQua] = await ketNoi.execute(
    `DELETE ndvt FROM nguoidungvaitro ndvt JOIN vaitro vt ON vt.id = ndvt.vaiTroId
      WHERE ndvt.nguoiDungId = ? AND vt.maVaiTro = ?`,
    [nguoiDungId, maVaiTro],
  );
  return ketQua.affectedRows;
}

async function capNhatTrangThai(nguoiDungId, trangThai, ketNoi = pool) {
  await ketNoi.execute('UPDATE nguoidung SET trangThai = ? WHERE id = ?', [trangThai, nguoiDungId]);
}

async function khoaVaLayTrangThai(nguoiDungId, ketNoi) {
  const [dong] = await ketNoi.execute('SELECT trangThai FROM nguoidung WHERE id = ? FOR UPDATE', [nguoiDungId]);
  return dong[0]?.trangThai ?? null;
}

// Danh sách tài khoản cho Admin (không bao giờ chọn matKhauMaHoa); vai trò gộp thành chuỗi rồi tách ở service
async function layDanhSachTaiKhoan({ tuKhoa, trangThai, maVaiTro, viTri, soLuong }) {
  const dieuKien = [];
  const thamSo = [];
  if (tuKhoa) {
    const mau = `%${tuKhoa.replace(/[\\%_]/g, '\\$&')}%`;
    dieuKien.push('(nd.tenDangNhap LIKE ? OR nd.email LIKE ? OR nv.hoVaTen LIKE ? OR nv.maNhanVien LIKE ?)');
    thamSo.push(mau, mau, mau, mau);
  }
  if (trangThai) {
    dieuKien.push('nd.trangThai = ?');
    thamSo.push(trangThai);
  }
  if (maVaiTro) {
    dieuKien.push(`EXISTS (SELECT 1 FROM nguoidungvaitro x JOIN vaitro v ON v.id = x.vaiTroId
                           WHERE x.nguoiDungId = nd.id AND v.maVaiTro = ?)`);
    thamSo.push(maVaiTro);
  }
  const where = dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : '';
  const bangNoi = 'FROM nguoidung nd LEFT JOIN nhanvien nv ON nv.nguoiDungId = nd.id';

  const [[dem]] = await pool.query(`SELECT COUNT(*) AS tongSo ${bangNoi} ${where}`, thamSo);
  const [items] = await pool.query(
    `SELECT nd.id AS nguoiDungId, nd.tenDangNhap, nd.email, nd.trangThai, nd.ngayTao, nd.lanDangNhapCuoi,
            nv.id AS nhanVienId, nv.maNhanVien, nv.hoVaTen, nv.trangThaiLamViec,
            (SELECT GROUP_CONCAT(v.maVaiTro ORDER BY v.id) FROM nguoidungvaitro x JOIN vaitro v ON v.id = x.vaiTroId
              WHERE x.nguoiDungId = nd.id) AS dsVaiTro
       ${bangNoi} ${where}
      ORDER BY nd.id LIMIT ? OFFSET ?`,
    [...thamSo, soLuong, viTri],
  );
  return { items, tongSo: Number(dem.tongSo) };
}

// Hồ sơ liên kết với tài khoản, đọc không khóa (dùng trước transaction để biết cần khóa phòng ban/nhân viên nào)
async function layHoSoLienKet(nguoiDungId) {
  const [dong] = await pool.execute(
    `SELECT nv.id AS nhanVienId, cdpb.phongBanId
       FROM nhanvien nv
       LEFT JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId
      WHERE nv.nguoiDungId = ?`,
    [nguoiDungId],
  );
  return dong[0] ?? null;
}

// Đọc tài khoản kèm hồ sơ và khóa dòng nguoidung (dùng trong transaction)
async function khoaTaiKhoan(nguoiDungId, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT nd.id AS nguoiDungId, nd.tenDangNhap, nd.trangThai,
            nv.id AS nhanVienId, nv.maNhanVien, nv.trangThaiLamViec
       FROM nguoidung nd
       LEFT JOIN nhanvien nv ON nv.nguoiDungId = nd.id
      WHERE nd.id = ?
      FOR UPDATE`,
    [nguoiDungId],
  );
  return dong[0] ?? null;
}

async function layTatCaVaiTro() {
  const [dong] = await pool.execute('SELECT id, maVaiTro, tenVaiTro, moTa FROM vaitro ORDER BY id');
  return dong;
}

// Thay toàn bộ vai trò: xóa rồi chèn lại trong cùng transaction
async function thayVaiTro(nguoiDungId, dsMaVaiTro, ketNoi) {
  await ketNoi.execute('DELETE FROM nguoidungvaitro WHERE nguoiDungId = ?', [nguoiDungId]);
  const [ketQua] = await ketNoi.query(
    'INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) SELECT ?, id FROM vaitro WHERE maVaiTro IN (?)',
    [nguoiDungId, dsMaVaiTro],
  );
  return ketQua.affectedRows;
}

// Số Admin còn hoạt động; FOR UPDATE để hai Admin không cùng lúc gỡ quyền của nhau về 0
async function demAdminHoatDong(ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT nd.id FROM nguoidung nd
       JOIN nguoidungvaitro x ON x.nguoiDungId = nd.id
       JOIN vaitro v ON v.id = x.vaiTroId
      WHERE v.maVaiTro = 'Admin' AND nd.trangThai = 'DANG_HOAT_DONG'
      FOR UPDATE`,
  );
  return dong.length;
}

module.exports = {
  layDanhSachTaiKhoan,
  khoaTaiKhoan,
  layHoSoLienKet,
  layTatCaVaiTro,
  thayVaiTro,
  demAdminHoatDong,
  khoaVaLayTrangThai,
  timTheoTenHoacEmail,
  themNguoiDung,
  ganVaiTro,
  goVaiTro,
  capNhatTrangThai,
  timDeDangNhap,
  layMatKhauMaHoa,
  layThongTin,
  layDanhSachVaiTro,
  capNhatMatKhau,
  capNhatLanDangNhapCuoi,
};
