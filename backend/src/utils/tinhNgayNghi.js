const { laCuoiTuan } = require('./tinhCong');

// Cộng số ngày vào 'YYYY-MM-DD' (tính theo UTC để không lệch múi giờ)
function congNgay(ngay, soNgay) {
  const d = new Date(`${ngay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + soNgay);
  return d.toISOString().slice(0, 10);
}

// Danh sách ngày làm việc (thứ 2 - thứ 6) trong [tuNgay, denNgay], chưa trừ ngày lễ
function layNgayLamViec(tuNgay, denNgay) {
  const ketQua = [];
  for (let ngay = tuNgay; ngay <= denNgay; ngay = congNgay(ngay, 1)) {
    if (!laCuoiTuan(ngay)) ketQua.push(ngay);
  }
  return ketQua;
}

// Số ngày nghỉ của đơn: bỏ T7/CN; nửa ngày (0.5) chỉ khi đơn gói gọn trong 1 ngày
function tinhSoNgayNghi(tuNgay, denNgay, nuaNgay = false) {
  const soNgay = layNgayLamViec(tuNgay, denNgay).length;
  return nuaNgay && soNgay === 1 ? 0.5 : soNgay;
}

// Các tháng 'YYYY-MM' mà khoảng ngày đi qua (để kiểm tra tháng đã chốt công)
function layCacThang(tuNgay, denNgay) {
  const ketQua = [];
  let [nam, thang] = tuNgay.slice(0, 7).split('-').map(Number);
  const cuoi = denNgay.slice(0, 7);
  for (;;) {
    const ma = `${nam}-${String(thang).padStart(2, '0')}`;
    ketQua.push(ma);
    if (ma >= cuoi) return ketQua;
    thang += 1;
    if (thang > 12) {
      thang = 1;
      nam += 1;
    }
  }
}

module.exports = { congNgay, layNgayLamViec, tinhSoNgayNghi, layCacThang };
