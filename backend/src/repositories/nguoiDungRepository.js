const { pool } = require('../config/ketNoiCsdl');

// Chỉ hàm layMatKhauMaHoa / timDeDangNhap trả cột matKhauMaHoa; service không được trả cột này ra API
async function timDeDangNhap(tenDangNhapHoacEmail) {
  const [dong] = await pool.execute(
    `SELECT nd.id, nd.tenDangNhap, nd.matKhauMaHoa, nd.trangThai
       FROM nguoidung nd
      WHERE nd.tenDangNhap = ? OR nd.email = ?
      LIMIT 1`,
    [tenDangNhapHoacEmail, tenDangNhapHoacEmail]
  );
  return dong[0] ?? null;
}

async function layMatKhauMaHoa(nguoiDungId) {
  const [dong] = await pool.execute('SELECT matKhauMaHoa FROM nguoidung WHERE id = ?', [nguoiDungId]);
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
    [nguoiDungId]
  );
  return dong[0] ?? null;
}

async function layDanhSachVaiTro(nguoiDungId) {
  const [dong] = await pool.execute(
    `SELECT vt.maVaiTro
       FROM nguoidungvaitro ndvt
       JOIN vaitro vt ON vt.id = ndvt.vaiTroId
      WHERE ndvt.nguoiDungId = ?`,
    [nguoiDungId]
  );
  return dong.map((d) => d.maVaiTro);
}

async function capNhatMatKhau(nguoiDungId, matKhauMaHoa, ketNoi = pool) {
  await ketNoi.execute('UPDATE nguoidung SET matKhauMaHoa = ? WHERE id = ?', [matKhauMaHoa, nguoiDungId]);
}

async function capNhatLanDangNhapCuoi(nguoiDungId) {
  await pool.execute('UPDATE nguoidung SET lanDangNhapCuoi = NOW() WHERE id = ?', [nguoiDungId]);
}

module.exports = {
  timDeDangNhap,
  layMatKhauMaHoa,
  layThongTin,
  layDanhSachVaiTro,
  capNhatMatKhau,
  capNhatLanDangNhapCuoi,
};
