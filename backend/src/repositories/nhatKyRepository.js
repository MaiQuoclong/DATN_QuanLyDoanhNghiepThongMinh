const { pool } = require('../config/ketNoiCsdl');

// ketNoi: truyền connection khi cần ghi chung transaction với nghiệp vụ
async function themNhatKy(nguoiDungId, hanhDong, diaChiIP, chiTiet = null, ketNoi = pool) {
  await ketNoi.execute(
    'INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, diaChiIP, chiTiet) VALUES (?, ?, ?, ?)',
    [nguoiDungId, hanhDong, diaChiIP, chiTiet]
  );
}

// Mốc mật khẩu của người dùng, tính trong SQL để tránh lệch múi giờ giữa Node và CSDL.
// giayTuThayDoiGanNhat tính cả lần khóa tài khoản: token cấp trước khi khóa bị thu hồi, kể cả khi sau đó được mở khóa.
// So thứ tự bằng id (datetime chỉ chính xác tới giây); số giây trôi qua dùng TIMESTAMPDIFF với NOW() của CSDL.
async function layMocMatKhau(nguoiDungId) {
  const [dong] = await pool.execute(
    `SELECT
        MAX(CASE WHEN hanhDong = 'RESET_MAT_KHAU_TAM' THEN id END) AS idReset,
        MAX(CASE WHEN hanhDong = 'DOI_MAT_KHAU' THEN id END) AS idDoi,
        TIMESTAMPDIFF(SECOND, MAX(CASE WHEN hanhDong = 'RESET_MAT_KHAU_TAM' THEN thoiGianTao END), NOW()) AS giayTuReset,
        TIMESTAMPDIFF(SECOND, MAX(thoiGianTao), NOW()) AS giayTuThayDoiGanNhat
       FROM nhatkyhethong
      WHERE nguoiDungId = ?
        AND hanhDong IN ('RESET_MAT_KHAU_TAM', 'DOI_MAT_KHAU', 'KHOA_TAI_KHOAN', 'KHOA_TAI_KHOAN_NGHI_VIEC')`,
    [nguoiDungId]
  );
  return dong[0];
}

// Hành động mới nhất (theo id) của một người dùng trong danh sách cho trước
async function layHanhDongGanNhat(nguoiDungId, cacHanhDong, ketNoi = pool) {
  const [dong] = await ketNoi.execute(
    `SELECT hanhDong FROM nhatkyhethong
      WHERE nguoiDungId = ? AND hanhDong IN (${cacHanhDong.map(() => '?').join(', ')})
      ORDER BY id DESC LIMIT 1`,
    [nguoiDungId, ...cacHanhDong]
  );
  return dong[0]?.hanhDong ?? null;
}

// Xem nhật ký hệ thống (Admin, giamDoc): lọc theo người dùng, hành động, khoảng ngày
async function layDanhSachNhatKy({ nguoiDungId, hanhDong, tuNgay, denNgay, viTri, soLuong }) {
  const dieuKien = [];
  const thamSo = [];
  if (nguoiDungId) {
    dieuKien.push('nk.nguoiDungId = ?');
    thamSo.push(nguoiDungId);
  }
  if (hanhDong) {
    dieuKien.push('nk.hanhDong = ?');
    thamSo.push(hanhDong);
  }
  if (tuNgay) {
    dieuKien.push('nk.thoiGianTao >= ?');
    thamSo.push(`${tuNgay} 00:00:00`);
  }
  if (denNgay) {
    dieuKien.push('nk.thoiGianTao <= ?');
    thamSo.push(`${denNgay} 23:59:59`);
  }
  const where = dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : '';
  const [[dem]] = await pool.query(`SELECT COUNT(*) AS tongSo FROM nhatkyhethong nk ${where}`, thamSo);
  const [items] = await pool.query(
    `SELECT nk.id, nk.nguoiDungId, nd.tenDangNhap, nk.hanhDong, nk.diaChiIP, nk.chiTiet, nk.thoiGianTao
       FROM nhatkyhethong nk
       LEFT JOIN nguoidung nd ON nd.id = nk.nguoiDungId
       ${where}
      ORDER BY nk.id DESC LIMIT ? OFFSET ?`,
    [...thamSo, soLuong, viTri]
  );
  return { items, tongSo: Number(dem.tongSo) };
}

module.exports = { themNhatKy, layMocMatKhau, layHanhDongGanNhat, layDanhSachNhatKy };
