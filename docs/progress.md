# Nhật ký tiến độ Smart HRM

## Tiến độ
- [ ] Khởi tạo CSDL 25 bảng & phân quyền RBAC 5 nhóm (`Admin`, `giamDoc`, `quanLy`, `HR`, `nhanVien`)
- [ ] Module Hồ sơ nhân sự, Trạng thái lao động & Hợp đồng
- [ ] Module Chấm công, Đơn từ hành chính & Lương
- [ ] Module Đánh giá KPI, Khen thưởng & Kỷ luật
- [ ] Tầng AI Agent: RAG quy chế, Function Calling tạo đơn, Text-to-SQL báo cáo

## Danh sách API đã hoàn thành
| Method | Endpoint | Vai trò | Mô tả |
|---|---|---|---|
| GET | `/api/v1/sucKhoe` | Công khai | Trạng thái máy chủ và kết nối CSDL (`KET_NOI` / `MAT_KET_NOI`) |

## Biến môi trường & lưu ý kỹ thuật
- CSDL là MariaDB 10.4 (XAMPP), không phải SQL Server. Schema: `database/schema.sql`.
- Tên database viết thường: `quanlydoanhnghiepthongminh`.
- Bảng mở rộng `dexuatkhenthuongkyluat` (2026-10-29) cho luồng quanLy đề xuất khen thưởng/kỷ luật. Ma trận quyền: `docs/phan-quyen.md`.
- Mật khẩu tạm (HR/Admin reset) không có cột cờ trong schema: suy ra từ `nhatkyhethong` (`RESET_MAT_KHAU_TAM` mới hơn `DOI_MAT_KHAU` thì bắt buộc đổi, hết hạn sau 24 giờ).
- Bảng `vaitro` chưa có dữ liệu mẫu; cần seed 5 vai trò trước khi làm RBAC.
- **MySQL (XAMPP) chạy ở cổng 3307**, không phải 3306 mặc định → `CSDL_CONG=3307`. Lệnh CLI cần thêm `-P 3307 -h 127.0.0.1`.
- Backend chỉ đọc `backend/.env` (tạo bằng cách copy `.env.example`); sửa `.env.example` không có tác dụng khi chạy. `nodemon` không theo dõi `.env` → sửa xong phải `Ctrl+C` rồi `npm run dev` lại.
- Express 5 (đã tự bắt lỗi async; `batLoiBatDongBo` vẫn giữ theo quy chuẩn). `bcrypt` 6 dùng bản dựng sẵn, cảnh báo "install-scripts" của npm 11 có thể bỏ qua.
- `schema.sql` không chứa `CREATE DATABASE` → phải tạo database `quanlydoanhnghiepthongminh` (utf8mb4_general_ci) trước khi import; import lại sẽ DROP các bảng hiện có.
- Chạy backend: `cd backend` → `npm test` → `npm run dev` → mở `http://localhost:5000/api/v1/sucKhoe`.
