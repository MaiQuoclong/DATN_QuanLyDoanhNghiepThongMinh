// Dựng lại CSDL từ đầu bằng một lệnh: tạo database → import schema.sql → nạp seed.sql
// CẢNH BÁO: xóa toàn bộ bảng và dữ liệu hiện có. Chỉ dùng cho môi trường dev/test.
// Cách dùng (trong thư mục backend):
//   npm run khoiTaoCsdl                      → schema + seed
//   npm run khoiTaoCsdl -- --taiKhoanChiDoc  → thêm tài khoản chỉ đọc aiReadonly cho AI service
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const THU_MUC_CSDL = path.join(__dirname, '..', '..', 'database');
const TEN_CSDL = process.env.CSDL_TEN || 'quanlydoanhnghiepthongminh';

function docFileSql(tenFile) {
  return fs.readFileSync(path.join(THU_MUC_CSDL, tenFile), 'utf8');
}

async function khoiTaoCsdl() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Không được chạy khởi tạo CSDL khi NODE_ENV=production');
  }
  // Chặn chạy nhầm vào máy chủ thật quên đặt NODE_ENV
  const mayChu = process.env.CSDL_HOST || 'localhost';
  if (!['localhost', '127.0.0.1', '::1'].includes(mayChu)) {
    throw new Error(`Chỉ được khởi tạo CSDL trên máy cục bộ (CSDL_HOST hiện là ${mayChu})`);
  }
  if (!/^[A-Za-z0-9_]+$/.test(TEN_CSDL)) {
    throw new Error(`Tên database không hợp lệ: ${TEN_CSDL}`);
  }

  const ketNoi = await mysql.createConnection({
    host: process.env.CSDL_HOST || 'localhost',
    port: Number(process.env.CSDL_CONG || 3306),
    user: process.env.CSDL_NGUOI_DUNG || 'root',
    password: process.env.CSDL_MAT_KHAU || '',
    multipleStatements: true,
  });

  try {
    await ketNoi.query(
      `CREATE DATABASE IF NOT EXISTS \`${TEN_CSDL}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
    await ketNoi.query(`USE \`${TEN_CSDL}\``);

    console.log('1/2 Import schema.sql ...');
    await ketNoi.query(docFileSql('schema.sql'));
    console.log('2/2 Nạp seed.sql ...');
    await ketNoi.query(docFileSql('seed.sql'));

    if (process.argv.includes('--taiKhoanChiDoc')) {
      console.log('+   Tạo tài khoản chỉ đọc aiReadonly ...');
      await ketNoi.query(docFileSql('taoTaiKhoanChiDoc.sql'));
    }

    const [bang] = await ketNoi.query('SHOW TABLES');
    console.log(`Xong: database ${TEN_CSDL} có ${bang.length} bảng.`);
  } finally {
    await ketNoi.end();
  }
}

khoiTaoCsdl().catch((loi) => {
  console.error('Khởi tạo CSDL thất bại:', loi.message);
  process.exit(1);
});
