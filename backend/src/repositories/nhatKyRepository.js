const { pool } = require('../config/ketNoiCsdl');

// ketNoi: truyền connection khi cần ghi chung transaction với nghiệp vụ
async function themNhatKy(nguoiDungId, hanhDong, diaChiIP, chiTiet = null, ketNoi = pool) {
  await ketNoi.execute(
    'INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, diaChiIP, chiTiet) VALUES (?, ?, ?, ?)',
    [nguoiDungId, hanhDong, diaChiIP, chiTiet]
  );
}

// Mốc mật khẩu của người dùng, tính trong SQL để tránh lệch múi giờ giữa Node và CSDL.
// So thứ tự bằng id (datetime chỉ chính xác tới giây); số giây trôi qua dùng TIMESTAMPDIFF với NOW() của CSDL.
async function layMocMatKhau(nguoiDungId) {
  const [dong] = await pool.execute(
    `SELECT
        MAX(CASE WHEN hanhDong = 'RESET_MAT_KHAU_TAM' THEN id END) AS idReset,
        MAX(CASE WHEN hanhDong = 'DOI_MAT_KHAU' THEN id END) AS idDoi,
        TIMESTAMPDIFF(SECOND, MAX(CASE WHEN hanhDong = 'RESET_MAT_KHAU_TAM' THEN thoiGianTao END), NOW()) AS giayTuReset,
        TIMESTAMPDIFF(SECOND, MAX(thoiGianTao), NOW()) AS giayTuThayDoiGanNhat
       FROM nhatkyhethong
      WHERE nguoiDungId = ? AND hanhDong IN ('RESET_MAT_KHAU_TAM', 'DOI_MAT_KHAU')`,
    [nguoiDungId]
  );
  return dong[0];
}

module.exports = { themNhatKy, layMocMatKhau };
