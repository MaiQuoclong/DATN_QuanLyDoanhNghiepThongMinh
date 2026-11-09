## Vấn đề / chức năng
<!-- PR này giải quyết việc gì? Thuộc module nào? -->

## Thay đổi chính
- Backend:
- Frontend:
- Seed / tài liệu:

## Cách kiểm tra
1. `cd backend && npm run khoiTaoCsdl && npm run lint && npm test`
2. `cd frontend && npm run lint && npm run build`
3. Đăng nhập vai trò ... → vào trang ... → thao tác ... → kết quả mong đợi ...

## Ảnh giao diện
<!-- Dán ảnh/GIF nếu có thay đổi UI -->

## Checklist
- [ ] Không thay đổi `database/schema.sql` (nếu có: đã được đồng ý)
- [ ] Đã chạy reviewer + qa-tester, sửa hết lỗi nghiêm trọng/trung bình
- [ ] `npm run lint` sạch ở backend và frontend
- [ ] `npm test` pass trên DB vừa dựng lại; `npm run build` pass
- [ ] Đã cập nhật `database/seed.sql` và `docs/progress.md` (nếu cần)
