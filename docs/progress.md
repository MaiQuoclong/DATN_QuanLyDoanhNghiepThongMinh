# Nhật ký tiến độ Smart HRM

## Tiến độ
- [ ] Khởi tạo CSDL 24 bảng & phân quyền RBAC 5 nhóm (`Admin`, `giamDoc`, `quanLy`, `HR`, `nhanVien`)
- [ ] Module Hồ sơ nhân sự, Trạng thái lao động & Hợp đồng
- [ ] Module Chấm công, Đơn từ hành chính & Lương
- [ ] Module Đánh giá KPI, Khen thưởng & Kỷ luật
- [ ] Tầng AI Agent: RAG quy chế, Function Calling tạo đơn, Text-to-SQL báo cáo

## Danh sách API đã hoàn thành
*(Chưa có)*

## Biến môi trường & lưu ý kỹ thuật
- CSDL là MariaDB 10.4 (XAMPP), không phải SQL Server. Schema: `database/schema.sql`.
- Bảng `vaitro` chưa có dữ liệu mẫu; cần seed 5 vai trò trước khi làm RBAC.
