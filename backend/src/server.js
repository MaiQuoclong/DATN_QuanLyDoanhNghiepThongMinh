require('dotenv').config();
const app = require('./app');
const { layBiMatJwt } = require('./services/xacThucService');

const cong = Number(process.env.CONG || 5000);

// Kiểm tra cấu hình bảo mật ngay khi khởi động thay vì để request đầu tiên mới lỗi 500
try {
  layBiMatJwt();
} catch (loi) {
  console.error(`[CAU_HINH] ${loi.message}. Tạo chuỗi bằng: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`);
  process.exit(1);
}

app.listen(cong, () => {
  console.log(`Backend Smart HRM chạy tại http://localhost:${cong}/api/v1`);
});
