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

// Chạy nhiều câu lệnh trong một transaction: lỗi ở bất kỳ bước nào thì rollback toàn bộ
async function chayTransaction(congViec) {
  const ketNoi = await pool.getConnection();
  try {
    await ketNoi.beginTransaction();
    const ketQua = await congViec(ketNoi);
    await ketNoi.commit();
    return ketQua;
  } catch (loi) {
    await ketNoi.rollback();
    throw loi;
  } finally {
    ketNoi.release();
  }
}

async function kiemTraKetNoi() {
  const [dong] = await pool.query('SELECT 1 AS ok');
  return dong[0].ok === 1;
}

module.exports = { pool, chayTransaction, kiemTraKetNoi };
