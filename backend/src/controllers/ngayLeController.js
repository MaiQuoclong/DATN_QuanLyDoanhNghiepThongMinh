const LoiUngDung = require('../utils/LoiUngDung');
const { thanhCong } = require('../utils/phanHoi');
const { layNgayLeCuaNam, daKhaiBaoNgayLe } = require('../utils/ngayLe');

// Danh sách ngày lễ (đã gồm nghỉ bù) của một năm cho giao diện: tô lịch, xem trước số ngày nghỉ
async function layNgayLe(req, res) {
  const chuoi = String(req.query.nam ?? new Date().getFullYear());
  if (!/^\d{4}$/.test(chuoi) || Number(chuoi) < 2000 || Number(chuoi) > 2100) {
    throw new LoiUngDung(400, 'Năm phải là số từ 2000 đến 2100');
  }
  const nam = Number(chuoi);
  return thanhCong(
    res,
    { nam, cacNgay: [...layNgayLeCuaNam(nam)].sort(), daKhaiBaoAmLich: daKhaiBaoNgayLe(nam) },
    'Lấy danh sách ngày lễ thành công',
  );
}

module.exports = { layNgayLe };
