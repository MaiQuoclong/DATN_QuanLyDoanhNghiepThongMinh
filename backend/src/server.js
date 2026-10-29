require('dotenv').config();
const app = require('./app');

const cong = Number(process.env.CONG || 5000);

app.listen(cong, () => {
  console.log(`Backend Smart HRM chạy tại http://localhost:${cong}/api/v1`);
});
