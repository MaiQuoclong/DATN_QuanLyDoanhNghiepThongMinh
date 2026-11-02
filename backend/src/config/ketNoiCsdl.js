const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.CSDL_HOST || 'localhost',
  port: Number(process.env.CSDL_CONG || 3306),
  user: process.env.CSDL_NGUOI_DUNG || 'root',
  password: process.env.CSDL_MAT_KHAU || '',
  database: process.env.CSDL_TEN || 'quanlydoanhnghiepthongminh',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});

const LOI_THU_LAI = ['ER_LOCK_DEADLOCK'];
const SO_LAN_THU_TOI_DA = 3;

async function chayMotLan(congViec) {
  const ketNoi = await pool.getConnection();
  try {
    await ketNoi.beginTransaction();
    const ketQua = await congViec(ketNoi);
    await ketNoi.commit();
    return ketQua;
  } catch (loi) {
    // Rollback lỗi (vd. mất kết nối) không được che mất lỗi gốc
    try { await ketNoi.rollback(); } catch { /* bỏ qua */ }
    throw loi;
  } finally {
    ketNoi.release();
  }
}

// Chạy nhiều câu lệnh trong một transaction: lỗi ở bất kỳ bước nào thì rollback toàn bộ.
// InnoDB hủy một bên khi deadlock (vd. hai HR cùng thêm nhân viên) -> tự chạy lại cả transaction.
async function chayTransaction(congViec) {
  for (let lan = 1; ; lan += 1) {
    try {
      return await chayMotLan(congViec);
    } catch (loi) {
      if (!LOI_THU_LAI.includes(loi.code) || lan >= SO_LAN_THU_TOI_DA) throw loi;
    }
  }
}

async function kiemTraKetNoi() {
  const [dong] = await pool.query('SELECT 1 AS ok');
  return dong[0].ok === 1;
}

module.exports = { pool, chayTransaction, kiemTraKetNoi };
