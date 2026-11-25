// Tìm kiếm không dấu: "duyet don" khớp "Duyệt đơn"
export function boDauTiengViet(chuoi = '') {
  return chuoi.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

// Mọi từ trong tuKhoa đều phải xuất hiện trong chuoi (không phân biệt dấu, hoa thường)
export function khopTuKhoa(chuoi, tuKhoa) {
  const nguon = boDauTiengViet(chuoi);
  return boDauTiengViet(tuKhoa)
    .split(/\s+/)
    .filter(Boolean)
    .every((tu) => nguon.includes(tu));
}
