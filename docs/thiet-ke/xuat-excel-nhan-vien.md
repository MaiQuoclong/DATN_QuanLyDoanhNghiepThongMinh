# Thiết kế: Xuất Excel danh sách nhân viên (`feature/xuat-excel-nhan-vien`)

Người dùng duyệt 2026-11-25. Không đổi schema.

## Phương án đã chốt
1. Ghi `nhatkyhethong` hành động `XUAT_EXCEL_NHAN_VIEN` mọi lần xuất (số dòng, bộ lọc, có cột ngân hàng hay không, IP).
2. Trần 5000 dòng: vượt → 400 "Kết quả vượt 5000 nhân viên, vui lòng thu hẹp bộ lọc" (không cắt âm thầm).
3. Cột Địa chỉ hiện cho cả `quanLy` (khớp API chi tiết); `quanLy` chỉ bị ẩn `soTaiKhoanNganHang`, `tenNganHang`.
4. SĐT / số tài khoản giữ dạng chuỗi như module Lương (chống CSV injection bằng `oCsv`).

## API
`GET /api/v1/nhanVien/xuatExcel` — `phanQuyen(['HR','giamDoc','quanLy'])` (khai báo trước `/:id`).
- Query như danh sách: `tuKhoa`, `phongBanId`, `trangThaiLamViec` (nhiều giá trị, phân cách dấu phẩy).
- 200 `text/csv; charset=utf-8`, BOM, `Content-Disposition: attachment; filename="DanhSachNhanVien_YYYYMMDD_HHmm.csv"`, `Cache-Control: no-store`.
- 400 bộ lọc sai / vượt trần; 401; 403 (Admin, nhanVien).
- Phạm vi: HR/giamDoc toàn công ty; quanLy phòng mình phụ trách + phòng con (`layPhongBanQuanLy`). `phongBanId` ngoài phạm vi → file chỉ có tiêu đề.

## Cột
Mã NV · Họ và tên · Giới tính · Ngày sinh · Số điện thoại · Địa chỉ · Mã phòng ban · Phòng ban · Chức danh · Ngày vào làm · Trạng thái · Số tài khoản ngân hàng (*) · Ngân hàng (*)
(*) chỉ HR/giamDoc (người kiêm quanLy + HR/giamDoc vẫn thấy). Không bao giờ xuất cột tài khoản đăng nhập.

## Mã nguồn
- `backend/src/utils/xuatCsv.js`: `oCsv`, `taoNoiDungCsv` (tách từ `luongService`, Lương import lại).
- `nhanVienRepository`: dùng chung điều kiện lọc với danh sách; `layDanhSachXuat`.
- `nhanVienService.xuatExcel`, `nhanVienController.xuatExcelNhanVien`, route.
- Frontend: nút "Xuất Excel" ở `TrangDanhSachNhanVien.jsx`; tiện ích `utils/taiTepBlob.js` dùng chung với `TrangBangLuong.jsx`.

## Test
`backend/tests/nhanVienXuatExcel.test.js`: header/BOM/cột theo vai trò; quanLy chỉ phạm vi; 401/403; bộ lọc khớp `GET /nhanVien`; 400 bộ lọc sai; chống CSV injection; nhật ký; trần dòng; hồi quy xuất lương.

## Hạn chế đã biết
- Dữ liệu cá nhân rời hệ thống không thu hồi được (nhật ký chỉ truy vết).
- Phòng ban là phòng hiện tại; file là CSV (Excel mở được), không phải .xlsx.
