// In ra chuỗi bcrypt của một mật khẩu, dùng khi soạn database/seed.sql
// Cách dùng: node scripts/taoMatKhauBam.js "MatKhau@123"
const bcrypt = require('bcrypt');

const SO_VONG_BAM = 10;
const matKhau = process.argv[2];

if (!matKhau) {
  console.error('Thiếu mật khẩu. Ví dụ: node scripts/taoMatKhauBam.js "MatKhau@123"');
  process.exit(1);
}

bcrypt.hash(matKhau, SO_VONG_BAM).then((chuoiBam) => console.log(chuoiBam));
