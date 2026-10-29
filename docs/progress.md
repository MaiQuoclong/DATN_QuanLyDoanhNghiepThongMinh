# Nhật ký tiến độ Smart HRM

## Tiến độ
- [ ] Khởi tạo CSDL 25 bảng & phân quyền RBAC 5 nhóm (`Admin`, `giamDoc`, `quanLy`, `HR`, `nhanVien`)
- [ ] Module Hồ sơ nhân sự, Trạng thái lao động & Hợp đồng
- [ ] Module Chấm công, Đơn từ hành chính & Lương
- [ ] Module Đánh giá KPI, Khen thưởng & Kỷ luật
- [ ] Tầng AI Agent: RAG quy chế, Function Calling tạo đơn, Text-to-SQL báo cáo

## Danh sách API đã hoàn thành
*(Chưa có)*

## Biến môi trường & lưu ý kỹ thuật
- CSDL là MariaDB 10.4 (XAMPP), không phải SQL Server. Schema: `database/schema.sql`.
- Tên database viết thường: `quanlydoanhnghiepthongminh`.
- Bảng mở rộng `dexuatkhenthuongkyluat` (2026-10-29) cho luồng quanLy đề xuất khen thưởng/kỷ luật. Ma trận quyền: `docs/phan-quyen.md`.
- Mật khẩu tạm (HR/Admin reset) không có cột cờ trong schema: suy ra từ `nhatkyhethong` (`RESET_MAT_KHAU_TAM` mới hơn `DOI_MAT_KHAU` thì bắt buộc đổi, hết hạn sau 24 giờ).
- Bảng `vaitro` chưa có dữ liệu mẫu; cần seed 5 vai trò trước khi làm RBAC.
