# CLAUDE.md - Smart HRM & AI Agent

## Tổng quan
Hệ thống Quản lý Doanh nghiệp Thông minh tích hợp AI Agent (đồ án tốt nghiệp - Mai Quốc Long, 22T2, ĐHSPKT - ĐHĐN; GVHD: ThS. Phạm Thị Trà My).
Số hóa vòng đời nhân sự (hồ sơ, hợp đồng, chấm công, phép, lương, KPI, khen thưởng - kỷ luật) + AI Agent: RAG tra cứu quy chế, Function Calling tạo đơn qua chat, Text-to-SQL báo cáo.

## Cấu trúc
```
database/schema.sql   MariaDB 10.4, 25 bảng (24 gốc + 1 mở rộng) - nguồn chuẩn, KHÔNG sửa
docs/                 design-system.md, progress.md, phan-quyen.md
backend/              ExpressJS + mysql2: routes → middlewares → controllers → services → repositories
frontend/             ReactJS (Vite) + Recharts
ai-service/           Python FastAPI: rag/, textToSql/, functionCalling/
```
Mỗi service có `.env.example` (commit) và `.env` (không commit).

## Quy tắc chi tiết (đọc khi làm phần liên quan)
- CSDL, khóa ngoại, transaction, Text-to-SQL: @rules/database.md
- Chuẩn API & tầng mã nguồn: @rules/api-style.md
- Giao diện: `docs/design-system.md` (chỉ đọc khi làm frontend)
- Ma trận phân quyền 5 vai trò (căn cứ code `phanQuyen` và test): `docs/phan-quyen.md`
- Tiến độ & danh sách API: `docs/progress.md`

## Đặt tên
- Tên tự đặt (biến, hàm, file, route): tiếng Việt không dấu, camelCase. Đúng: `layDanhSachNhanVien`, `kiemTraQuyPhep`. Sai: `lay_danh_sach`, `getEmployees`.
- Ngoại lệ: React component dùng PascalCase (`BangNhanVien.jsx`); API của thư viện/framework giữ nguyên (`req`, `res`, `useState`, `onClick`); tên nhánh git dùng gạch ngang (xem Git Workflow).
- Tên bảng/cột giữ nguyên 100% như `database/schema.sql` (bảng viết thường: `nhanvien`; cột camelCase: `chucDanhPhongBanId`).

## Quy tắc bắt buộc
- KHÔNG thay đổi cấu trúc, tên bảng, tên cột, kiểu dữ liệu trong `database/schema.sql`.
- Giá trị trạng thái dùng đúng như schema (`CHO_DUYET`, `BAN_NHAP`, ...), không dùng `PENDING`.
- Text-to-SQL chỉ `SELECT`, chạy bằng tài khoản DB chỉ đọc.
- Trước khi sửa `settings.json` hoặc file cấu hình môi trường: giải thích thay đổi + lý do và chờ người dùng đồng ý.
- Comment tiếng Việt cho nghiệp vụ nhân sự phức tạp.

## Bảo mật
- JWT + RBAC 5 vai trò: `Admin`, `giamDoc`, `quanLy`, `HR`, `nhanVien` (giữ đúng giá trị lưu trong bảng `vaitro`).
- `nhanVien` chỉ xem/sửa dữ liệu của chính mình; `quanLy` chỉ trong phòng ban mình phụ trách; `HR`/`Admin` toàn quyền theo nghiệp vụ.
- Mật khẩu băm `bcrypt` vào `nguoidung.matKhauMaHoa`; không bao giờ trả cột này ra API.
- Ghi `nhatkyhethong` (thời gian, IP) cho: thêm/sửa/xóa nhân sự, duyệt lương, đổi hợp đồng, phân quyền.

## Xử lý lỗi
- Lỗi backend đi qua global error middleware → `{"success": false, "code": <HTTP>, "message": "<tiếng Việt>", "data": null}`.
- AI service lỗi/mất kết nối LLM hoặc Vector DB: trả thông báo thân thiện, không làm sập backend (timeout + try/catch ở phía Express).
- Function Calling tạo bản ghi ở trạng thái `CHO_DUYET`; RAG phải trích dẫn nguồn/số điều khoản.

## Workflow
1. Làm theo lát cắt dọc từng tính năng: DB → API → UI, trên nhánh `feature/ten-chuc-nang` (gạch ngang) tách từ `develop`, commit nhỏ theo Conventional Commits.
2. Thứ tự: Auth/RBAC → Hồ sơ nhân sự & Hợp đồng → Chấm công/Phép → Lương → KPI/Khen thưởng → AI Agent.
3. Xong một module: gọi sub-agent `reviewer`, sửa lỗi, rồi gọi `qa-tester` (tự cập nhật `docs/progress.md`).
4. Mỗi lần sửa code: tóm tắt file đã đổi và xác nhận không lệch schema.

## Quản lý context
- Khi hội thoại đã dài (nhiều file lớn đã đọc, nhiều vòng sửa) hoặc ngay sau khi xong một module, nhắc người dùng chạy `/context` để kiểm tra mức dùng token.
- Nếu người dùng báo context ≥ 70%: tóm tắt trạng thái hiện tại (đang làm gì, file đã đổi, việc còn lại), cập nhật `docs/progress.md`, rồi đề xuất `/compact` hoặc mở phiên mới.
## Git Workflow & Branching Strategy (Quy trình quản lý mã nguồn Git)
*Dự án áp dụng mô hình Git Flow chuẩn doanh nghiệp nhằm kiểm soát chặt chẽ từng tính năng:*
- **Các nhánh chính:**
  - `main`: Nhánh sản phẩm ổn định, chỉ chứa các phiên bản phát hành chính thức (release tags).
  - `develop`: Nhánh tích hợp các tính năng chung trong quá trình phát triển.
- **Nhánh phát triển tính năng (Feature Branch):**
  - Khi bắt đầu làm một chức năng mới, bắt buộc phải tạo nhánh riêng tách ra từ `develop` theo định dạng: `feature/ten-chuc-nang` (Ví dụ: `feature/quan-ly-nhan-su`, `feature/cham-cong-api`).
- **Quy chuẩn Commit nhỏ (Conventional Commits):**
  - Mọi commit phải sử dụng tiền tố rõ ràng bằng tiếng Anh kèm thông điệp ngắn gọn:
    - `feat:` Thêm tính năng mới.
    - `fix:` Sửa lỗi (bug).
    - `test:` Viết hoặc cập nhật test cases.
    - `chore:` Cấu hình hệ thống, tài liệu hoặc thư viện.
- **Quy trình gộp code (Pull Request):**
  - Sau khi hoàn thành tính năng trên nhánh `feature/...`, tạo **Pull Request** trỏ về nhánh `develop` để tiến hành review code, kiểm tra ràng buộc CSDL và đảm bảo không có lỗi trước khi gộp.