// Tiện ích ngày tháng dùng chung, theo giờ máy chủ Node (không nhận từ client)
function ngayHomNay() {
  return new Date().toLocaleDateString('sv-SE');
}

const thangHienTai = () => ngayHomNay().slice(0, 7);

// Khoảng ngày của tháng dạng 'YYYY-MM' -> { tuNgay, denNgay, ngayCuoi }
function khoangNgayCuaThang(thang) {
  const [nam, soThang] = thang.split('-').map(Number);
  const ngayCuoi = new Date(Date.UTC(nam, soThang, 0)).getUTCDate();
  return { tuNgay: `${thang}-01`, denNgay: `${thang}-${String(ngayCuoi).padStart(2, '0')}`, ngayCuoi };
}

module.exports = { ngayHomNay, thangHienTai, khoangNgayCuaThang };
