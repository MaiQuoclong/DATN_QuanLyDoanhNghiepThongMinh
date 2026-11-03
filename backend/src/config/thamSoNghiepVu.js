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

// Nghỉ phép: chuỗi duyệt theo docs/phan-quyen.md quy tắc 5
const THAM_SO_NGHI_PHEP = {
  soNgayChuyenGiamDoc: 5, // đơn nghỉ dài hơn 5 ngày làm việc chuyển thẳng giamDoc duyệt
  soNgayPhepNamMacDinh: 12, // quỹ phép năm mặc định khi HR cấp hàng loạt
  soNgayDatTruocToiDa: 365, // chỉ được tạo đơn bắt đầu trong vòng 365 ngày tới
};

module.exports = { THAM_SO_CHAM_CONG, THAM_SO_NGHI_PHEP };
