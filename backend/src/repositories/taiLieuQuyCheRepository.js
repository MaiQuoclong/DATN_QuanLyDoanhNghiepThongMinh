const { pool } = require('../config/ketNoiCsdl');

const COT_DANH_SACH = `t.id, t.maTaiLieu, t.tieuDe, t.duongDanTep, t.nguoiTaiLenId, t.ngayTao,
       nv.maNhanVien AS maNguoiTaiLen, nv.hoVaTen AS tenNguoiTaiLen`;

// Tìm theo mã hoặc tiêu đề; thoát ký tự đại diện LIKE để từ khóa "%" không khớp mọi dòng
function dieuKienLoc({ tuKhoa }) {
  if (!tuKhoa) return { where: '', thamSo: [] };
  const mau = `%${tuKhoa.replace(/[\\%_]/g, '\\$&')}%`;
  return { where: 'WHERE (t.maTaiLieu LIKE ? OR t.tieuDe LIKE ?)', thamSo: [mau, mau] };
}

async function layDanhSach(boLoc) {
  const { where, thamSo } = dieuKienLoc(boLoc);
  const [dong] = await pool.query(
    `SELECT ${COT_DANH_SACH}
       FROM tailieuquyche t JOIN nhanvien nv ON nv.id = t.nguoiTaiLenId
       ${where}
      ORDER BY t.ngayTao DESC, t.id DESC
      LIMIT ? OFFSET ?`,
    [...thamSo, boLoc.soLuong, boLoc.viTri],
  );
  const [tong] = await pool.query(`SELECT COUNT(*) AS tongSo FROM tailieuquyche t ${where}`, thamSo);
  return { items: dong, tongSo: Number(tong[0].tongSo) };
}

async function layTheoId(id) {
  const [dong] = await pool.execute(
    `SELECT ${COT_DANH_SACH}
       FROM tailieuquyche t JOIN nhanvien nv ON nv.id = t.nguoiTaiLenId
      WHERE t.id = ?`,
    [id],
  );
  return dong[0] ?? null;
}

async function layTheoMa(maTaiLieu) {
  const [dong] = await pool.execute('SELECT id FROM tailieuquyche WHERE maTaiLieu = ?', [maTaiLieu]);
  return dong[0] ?? null;
}

async function them({ maTaiLieu, tieuDe, duongDanTep, nguoiTaiLenId }) {
  const [kq] = await pool.execute('INSERT INTO tailieuquyche (maTaiLieu, tieuDe, duongDanTep, nguoiTaiLenId) VALUES (?, ?, ?, ?)', [
    maTaiLieu,
    tieuDe,
    duongDanTep,
    nguoiTaiLenId,
  ]);
  return kq.insertId;
}

async function xoa(id) {
  const [kq] = await pool.execute('DELETE FROM tailieuquyche WHERE id = ?', [id]);
  return kq.affectedRows;
}

// Id mọi tài liệu còn trong CSDL: ai-service dùng để dọn vector của tài liệu đã xóa
async function layTatCaId() {
  const [dong] = await pool.query('SELECT id FROM tailieuquyche');
  return dong.map((d) => d.id);
}

// {id, maTaiLieu} gửi ai-service để lọc/dọn vector theo cả mã: id tự tăng có thể bị cấp lại sau khoiTaoCsdl
async function layTatCaIdVaMa() {
  const [dong] = await pool.query('SELECT id, maTaiLieu FROM tailieuquyche');
  return dong;
}

// Mọi tài liệu kèm đường dẫn tệp cho script lập chỉ mục toàn bộ (scripts/lapChiMucTatCa.js)
async function layTatCaDeLapChiMuc() {
  const [dong] = await pool.query('SELECT id, maTaiLieu, tieuDe, duongDanTep FROM tailieuquyche ORDER BY id');
  return dong;
}

module.exports = { layDanhSach, layTheoId, layTheoMa, them, xoa, layTatCaId, layTatCaIdVaMa, layTatCaDeLapChiMuc };
