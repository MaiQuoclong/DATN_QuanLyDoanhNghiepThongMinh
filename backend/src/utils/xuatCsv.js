// CSV UTF-8 có BOM để Excel mở đúng tiếng Việt; dùng chung cho mọi chức năng "Xuất Excel" (lương, nhân viên).
// Ô chữ bắt đầu bằng = + - @ | % (tab, CR) được thêm ' để chặn chèn công thức (CSV injection).
// Số âm dạng chuỗi (mysql2 trả DECIMAL là chuỗi, vd '-500000.00') giữ nguyên để Excel còn tính toán được
const LA_SO = /^-?\d+(\.\d+)?$/;

function oCsv(giaTri) {
  let s = String(giaTri ?? '');
  if (/^[=+\-@|%\t\r]/.test(s) && typeof giaTri !== 'number' && !LA_SO.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const BOM = String.fromCharCode(0xfeff); // Excel cần BOM để nhận đúng UTF-8

function taoNoiDungCsv(tieuDe, cacDong) {
  const noiDung = [tieuDe, ...cacDong].map((d) => d.map(oCsv).join(',')).join('\r\n');
  return `${BOM}${noiDung}\r\n`;
}

module.exports = { oCsv, taoNoiDungCsv };
