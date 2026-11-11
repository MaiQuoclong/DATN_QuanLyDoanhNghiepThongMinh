// Dựng lại CSDL từ đầu bằng một lệnh: tạo database → import schema.sql → nạp seed.sql
// CẢNH BÁO: xóa toàn bộ bảng và dữ liệu hiện có. Chỉ dùng cho môi trường dev/test.
// Cách dùng (trong thư mục backend):
//   npm run khoiTaoCsdl  → schema + seed + tài khoản chỉ đọc aiReadonly (nếu có AI_CSDL_MAT_KHAU)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { layNgayLeCuaNam } = require('../src/utils/ngayLe');

const THU_MUC_CSDL = path.join(__dirname, '..', '..', 'database');
const TEN_CSDL = process.env.CSDL_TEN || 'quanlydoanhnghiepthongminh';

function docFileSql(tenFile) {
  return fs.readFileSync(path.join(THU_MUC_CSDL, tenFile), 'utf8');
}

// Tài khoản chỉ đọc aiReadonly cho Text-to-SQL (ai-service dùng CSDL_MAT_KHAU trùng giá trị này).
// Thiếu AI_CSDL_MAT_KHAU → chỉ cảnh báo, không làm hỏng việc dựng CSDL (CI backend, máy chưa dùng AI).
// Xóa rồi tạo lại user để quyền luôn đúng theo taoTaiKhoanChiDoc.sql (không giữ quyền cũ thừa).
async function taoTaiKhoanChiDoc(ketNoi) {
  const matKhau = process.env.AI_CSDL_MAT_KHAU || '';
  if (!matKhau) {
    console.warn('!   Bỏ qua tài khoản aiReadonly: chưa đặt AI_CSDL_MAT_KHAU (báo cáo AI sẽ không chạy).');
    return;
  }
  if (matKhau.length < 12) {
    throw new Error('AI_CSDL_MAT_KHAU phải có tối thiểu 12 ký tự');
  }
  if (TEN_CSDL !== 'quanlydoanhnghiepthongminh') {
    throw new Error('taoTaiKhoanChiDoc.sql cấp quyền cho database quanlydoanhnghiepthongminh, hãy dùng đúng CSDL_TEN');
  }
  console.log('+   Tạo tài khoản chỉ đọc aiReadonly ...');
  for (const mayChu of ['localhost', '127.0.0.1']) {
    await ketNoi.query('DROP USER IF EXISTS ?@?', ['aiReadonly', mayChu]);
    await ketNoi.query('CREATE USER ?@? IDENTIFIED BY ?', ['aiReadonly', mayChu, matKhau]);
  }
  await ketNoi.query(docFileSql('taoTaiKhoanChiDoc.sql'));
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
    await ketNoi.query(`CREATE DATABASE IF NOT EXISTS \`${TEN_CSDL}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
    await ketNoi.query(`USE \`${TEN_CSDL}\``);

    console.log('1/2 Import schema.sql ...');
    await ketNoi.query(docFileSql('schema.sql'));
    // Bảng TẠM (chỉ tồn tại trong phiên này, không thuộc schema): ngày lễ năm trước/nay/sau lấy từ
    // config THAM_SO_NGAY_LE để seed.sql bỏ ngày lễ khi sinh chấm công, tính công chuẩn và số ngày nghỉ
    const namNay = new Date().getFullYear();
    const cacNgayLe = [namNay - 1, namNay, namNay + 1].flatMap((nam) => [...layNgayLeCuaNam(nam)]);
    await ketNoi.query('CREATE TEMPORARY TABLE tamNgayLe (ngay DATE PRIMARY KEY)');
    await ketNoi.query('INSERT INTO tamNgayLe (ngay) VALUES ?', [cacNgayLe.map((ngay) => [ngay])]);
    console.log('2/2 Nạp seed.sql ...');
    await ketNoi.query(docFileSql('seed.sql'));
    await ketNoi.query('DROP TEMPORARY TABLE tamNgayLe');

    await taoTaiKhoanChiDoc(ketNoi);

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
