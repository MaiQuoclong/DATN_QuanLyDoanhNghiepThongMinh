const { THAM_SO_NGAY_LE } = require('../config/thamSoNghiepVu');

const laCuoiTuan = (ngay) => {
  const thu = new Date(`${ngay}T00:00:00Z`).getUTCDay();
  return thu === 0 || thu === 6;
};

function congMotNgay(ngay) {
  const d = new Date(`${ngay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Tập ngày lễ của một năm (đã gồm ngày nghỉ bù khi lễ cố định trùng cuối tuần), lưu đệm theo năm.
// Hai lượt: thêm mọi lễ rơi vào ngày thường trước, rồi mới tính nghỉ bù -> ngày bù không trùng một lễ khác
// (vd 2028: 30/4 Chủ nhật bù sang 02/5 vì 01/5 đã là lễ).
const boNhoDem = new Map();
const namDaCanhBao = new Set();
function layNgayLeCuaNam(nam) {
  if (boNhoDem.has(nam)) return boNhoDem.get(nam);
  if (!THAM_SO_NGAY_LE.theoNam[nam] && !namDaCanhBao.has(nam)) {
    namDaCanhBao.add(nam);
    console.warn(`[ngayLe] Chưa khai báo Tết Âm lịch/Giỗ Tổ năm ${nam} trong THAM_SO_NGAY_LE.theoNam: chỉ tính lễ dương lịch`);
  }
  const tap = new Set((THAM_SO_NGAY_LE.theoNam[nam] ?? []).filter((ngay) => !laCuoiTuan(ngay)));
  const cacLeCoDinh = THAM_SO_NGAY_LE.coDinh.map((mmdd) => `${nam}-${mmdd}`);
  for (const ngay of cacLeCoDinh) if (!laCuoiTuan(ngay)) tap.add(ngay);
  for (const ngay of cacLeCoDinh.filter(laCuoiTuan)) {
    let bu = congMotNgay(ngay);
    while (laCuoiTuan(bu) || tap.has(bu)) bu = congMotNgay(bu);
    tap.add(bu);
  }
  boNhoDem.set(nam, tap);
  return tap;
}

// Năm đã khai báo đủ lễ âm lịch chưa (để chặn chốt công/lập lương năm thiếu dữ liệu)
const daKhaiBaoNgayLe = (nam) => Boolean(THAM_SO_NGAY_LE.theoNam[nam]);

const laNgayLe = (ngay) => layNgayLeCuaNam(Number(ngay.slice(0, 4))).has(ngay);

// Ngày không phải làm việc theo ca hành chính: thứ 7, Chủ nhật hoặc ngày lễ
const laNgayNghiChung = (ngay) => laCuoiTuan(ngay) || laNgayLe(ngay);

module.exports = { laCuoiTuan, laNgayLe, laNgayNghiChung, layNgayLeCuaNam, daKhaiBaoNgayLe };
