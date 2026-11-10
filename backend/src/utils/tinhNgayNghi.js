const { THAM_SO_NGHI_PHEP } = require('../config/thamSoNghiepVu');
const { laNgayNghiChung } = require('./ngayLe');

// Cộng số ngày vào 'YYYY-MM-DD' (tính theo UTC để không lệch múi giờ)
function congNgay(ngay, soNgay) {
  const d = new Date(`${ngay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + soNgay);
  return d.toISOString().slice(0, 10);
}

// Danh sách ngày làm việc (thứ 2 - thứ 6, trừ ngày lễ trong THAM_SO_NGAY_LE) trong [tuNgay, denNgay]
function layNgayLamViec(tuNgay, denNgay) {
  const ketQua = [];
  for (let ngay = tuNgay; ngay <= denNgay; ngay = congNgay(ngay, 1)) {
    if (!laNgayNghiChung(ngay)) ketQua.push(ngay);
  }
  return ketQua;
}

// Số ngày nghỉ của đơn: bỏ T7/CN và ngày lễ; nửa ngày (0.5) chỉ khi đơn gói gọn trong 1 ngày
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

// Số ngày phép năm của một người cho năm `nam` (Bộ luật Lao động 2019 Điều 113, 114; Nghị định 145/2020 Điều 66):
//  - cơ bản THAM_SO_NGHI_PHEP.soNgayPhepNamMacDinh (12 ngày, điều kiện bình thường; schema không lưu công việc
//    nặng nhọc/độc hại nên trường hợp 14, 16 ngày HR sửa riêng từng người);
//  - thâm niên: cứ đủ 5 năm làm việc (tính đến 01/01 năm cấp) cộng 1 ngày;
//  - vào làm trong năm (chưa đủ 12 tháng): (cơ bản + thâm niên) / 12 × số tháng làm việc; tháng vào làm tính
//    1 tháng khi số ngày làm việc từ ngày vào làm đến cuối tháng đạt ít nhất 50% ngày làm việc của tháng.
//  Kết quả làm tròn tới bước 0.5 ngày (cột DECIMAL(4,1)).
function tinhSoNgayPhepNam(ngayVaoLam, nam) {
  const coBan = THAM_SO_NGHI_PHEP.soNgayPhepNamMacDinh;
  const dauNam = `${nam}-01-01`;
  if (ngayVaoLam < dauNam) {
    const [n, t, d] = ngayVaoLam.split('-').map(Number);
    const soNamDu = nam - n - (t > 1 || d > 1 ? 1 : 0);
    return coBan + Math.floor(Math.max(soNamDu, 0) / 5);
  }
  const thangVao = Number(ngayVaoLam.slice(5, 7));
  const cuoiThang = new Date(Date.UTC(nam, thangVao, 0)).toISOString().slice(0, 10);
  const ngayLamCuaThang = layNgayLamViec(`${ngayVaoLam.slice(0, 7)}-01`, cuoiThang).length;
  const ngayLamSauKhiVao = layNgayLamViec(ngayVaoLam, cuoiThang).length;
  const tinhThangVao = ngayLamCuaThang > 0 && ngayLamSauKhiVao * 2 >= ngayLamCuaThang;
  const soThang = 12 - thangVao + (tinhThangVao ? 1 : 0);
  return Math.round(((coBan * soThang) / 12) * 2) / 2;
}

module.exports = { congNgay, layNgayLamViec, tinhSoNgayNghi, layCacThang, tinhSoNgayPhepNam };
