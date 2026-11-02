// Tham số nghiệp vụ dùng chung (không viết cứng trong service). Đổi quy chế công ty thì sửa tại đây.

// Chấm công: ca hành chính 08:00-17:00, nghỉ trưa 12:00-13:00 (8 giờ công/ngày)
const THAM_SO_CHAM_CONG = {
  gioVaoCa: '08:00:00',
  gioRaCa: '17:00:00',
  batDauNghiTrua: '12:00:00',
  ketThucNghiTrua: '13:00:00',
  nguongDiMuonPhut: 5, // vào sau 08:05 tính đi muộn
  nguongLamThemPhut: 30, // ở lại sau giờ ra ca từ 30 phút trở lên mới tính OT
};

module.exports = { THAM_SO_CHAM_CONG };
