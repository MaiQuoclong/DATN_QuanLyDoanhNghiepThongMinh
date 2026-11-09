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

// Lương (docs/phan-quyen.md mục 7). Mức theo quy định hiện hành, đổi chính sách thì sửa tại đây.
const THAM_SO_LUONG = {
  soGioCongMotNgay: 8,
  heSoLamThem: 1.5, // OT ngày thường = 150% đơn giá giờ
  // Bảo hiểm bắt buộc phần người lao động đóng, tính trên lương cơ bản hợp đồng
  tyLeBaoHiem: { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 },
  mucTranDongBaoHiem: 46800000, // 20 lần lương cơ sở 2.340.000
  // Luật BHXH: không làm việc, không hưởng lương từ 14 ngày làm việc trở lên trong tháng thì không đóng tháng đó
  soNgayNghiKhongDongBaoHiem: 14,
  giamTruBanThan: 11000000, // giảm trừ gia cảnh bản thân/tháng (schema không lưu người phụ thuộc)
  // Biểu thuế TNCN lũy tiến từng phần theo tháng: [mức trần thu nhập tính thuế của bậc, thuế suất]
  bieuThueTNCN: [
    [5000000, 0.05], [10000000, 0.1], [18000000, 0.15], [32000000, 0.2],
    [52000000, 0.25], [80000000, 0.3], [Infinity, 0.35],
  ],
};

// KPI (docs/phan-quyen.md mục 8): điểm mỗi chỉ tiêu thang 0-10 (cột DECIMAL(4,2)).
// Điểm tổng = trung bình có trọng số điểm nghiệm thu; xếp loại theo ngưỡng (xét từ cao xuống thấp).
const THAM_SO_KPI = {
  diemToiDa: 10,
  trongSoToiDa: 100, // trọng số mỗi chỉ tiêu 0.01-100 (cột DECIMAL(5,2))
  nguongXepLoai: [
    [9, 'XUAT_SAC'], [8, 'TOT'], [6.5, 'KHA'], [5, 'TRUNG_BINH'], [0, 'YEU'],
  ],
  // Thưởng KPI = K(xếp loại) × M; M = lương hợp đồng × tyLeThuongMucTieu × số tháng của kỳ.
  // K tối đa 1.3 (xếp loại là 5 mức cố định nên không cần trần). Trả một lần vào lương tháng nghiệm thu.
  heSoThuong: { XUAT_SAC: 1.3, TOT: 1.1, KHA: 1.0, TRUNG_BINH: 0.5, YEU: 0 },
  tyLeThuongMucTieu: 0.1, // 10% lương hợp đồng cho mỗi tháng của kỳ
};

module.exports = { THAM_SO_CHAM_CONG, THAM_SO_NGHI_PHEP, THAM_SO_LUONG, THAM_SO_KPI };
