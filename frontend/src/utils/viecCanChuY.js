// Đọc số của một loại việc từ dữ liệu /viecCanChuY cho trang Tổng quan:
// - null: chưa có theoLoai (chưa tải xong / lỗi mạng lần đầu) hoặc loại không áp dụng cho vai trò
// - { loi: true }: nguồn đó lỗi ở backend (theoLoai[loai] === null) -> không được hiển thị như "không có việc"
// - { so, hienThi }: số đếm; '1000+' khi vượt trần đếm qua danh sách
export function layHienThiSoViec(viec, loai) {
  const theoLoai = viec?.theoLoai;
  if (!theoLoai || !(loai in theoLoai)) return null;
  const so = theoLoai[loai];
  if (so === null) return { so: null, hienThi: '—', loi: true };
  return { so, hienThi: viec.vuotTran?.includes(loai) ? `${so}+` : so, loi: false };
}
