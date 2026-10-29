# Quy chuẩn API (ExpressJS)

## Cấu trúc response
Thành công:
```json
{ "success": true, "code": 200, "message": "Lấy danh sách nhân viên thành công", "data": { } }
```
Có phân trang: `data = { "items": [...], "phanTrang": { "trang": 1, "kichThuoc": 20, "tongSo": 135 } }`.

Lỗi (do global error middleware trả về):
```json
{ "success": false, "code": 400, "message": "Thông báo lỗi tiếng Việt", "data": null }
```

## Route
- Tiền tố `/api/v1`, tài nguyên viết camelCase tiếng Việt số nhiều theo nghĩa: `/api/v1/nhanVien`, `/api/v1/donNghiPhep/:id/duyet`.
- Đúng HTTP method: GET đọc, POST tạo, PUT/PATCH sửa, DELETE xóa. Hành động nghiệp vụ dùng POST `/:id/<hanhDong>`.
- Mã trạng thái: 200, 201 (tạo), 400 (dữ liệu sai), 401 (chưa đăng nhập), 403 (sai quyền), 404, 409 (trùng), 500.

## Tầng mã nguồn
`routes` → `middlewares` (xacThucJwt, phanQuyen([...vaiTro]), kiemTraDuLieu) → `controllers` (chỉ nhận req/trả res) → `services` (nghiệp vụ, transaction) → `repositories` (SQL).
- Controller bọc bằng `batLoiBatDongBo` để lỗi tự chuyển tới error middleware.
- Ném lỗi bằng class `LoiUngDung(code, message)`.
- Thao tác nhạy cảm gọi `ghiNhatKy(nguoiDungId, hanhDong, ip)` vào `nhatkyhethong`.
