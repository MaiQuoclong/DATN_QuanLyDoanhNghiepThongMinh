const { pool } = require('../config/ketNoiCsdl');

// Phiên trò chuyện AI (bảng phientrochuyenai). Mọi truy vấn lọc theo nguoiDungId: chỉ chủ phiên đọc/sửa/xóa được.
const SO_PHIEN_TOI_DA = 100;

async function layTheoNguoiDung(nguoiDungId) {
  const [dong] = await pool.query(
    `SELECT id, tieuDePhien, thoiGianTao FROM phientrochuyenai
      WHERE nguoiDungId = ? ORDER BY thoiGianTao DESC, id DESC LIMIT ?`,
    [nguoiDungId, SO_PHIEN_TOI_DA],
  );
  return dong;
}

async function layCuaNguoiDung(id, nguoiDungId) {
  const [dong] = await pool.execute(
    'SELECT id, nguoiDungId, tieuDePhien, thoiGianTao FROM phientrochuyenai WHERE id = ? AND nguoiDungId = ?',
    [id, nguoiDungId],
  );
  return dong[0] ?? null;
}

async function them(nguoiDungId, tieuDePhien) {
  const [kq] = await pool.execute('INSERT INTO phientrochuyenai (nguoiDungId, tieuDePhien) VALUES (?, ?)', [nguoiDungId, tieuDePhien]);
  return kq.insertId;
}

async function doiTieuDe(id, nguoiDungId, tieuDePhien) {
  const [kq] = await pool.execute('UPDATE phientrochuyenai SET tieuDePhien = ? WHERE id = ? AND nguoiDungId = ?', [
    tieuDePhien,
    id,
    nguoiDungId,
  ]);
  return kq.affectedRows;
}

async function xoa(id, nguoiDungId) {
  const [kq] = await pool.execute('DELETE FROM phientrochuyenai WHERE id = ? AND nguoiDungId = ?', [id, nguoiDungId]);
  return kq.affectedRows;
}

module.exports = { layTheoNguoiDung, layCuaNguoiDung, them, doiTieuDe, xoa };
