# CLAUDE.md - Smart HRM & AI Agent Project Guidelines

## 1. Project Overview (Tổng quan dự án)
- **Tên đề tài:** Xây dựng hệ thống Quản lý Doanh nghiệp Thông minh tích hợp AI Agent (Smart HRM).
- **Sinh viên thực hiện:** Mai Quốc Long (Lớp 22T2 - Khoa Công nghệ Số, Trường Đại học Sư phạm Kỹ thuật - ĐHĐN).
- **Giảng viên hướng dẫn:** ThS. Phạm Thị Trà My.
- **Mục tiêu cốt lõi:** Số hóa toàn diện vòng đời nhân sự nội bộ (Hồ sơ, Trạng thái lao động, Hợp đồng, Chấm công, Phép, Lương, KPI, Khen thưởng - Kỷ luật) tích hợp tầng trí tuệ nhân tạo (AI Agent) gồm RAG (tra cứu quy chế nội bộ), Function Calling (xử lý đơn từ qua chat) và Text-to-SQL (truy vấn dữ liệu thời gian thực).

## 2. Tech Stack & Modular Architecture (Công nghệ & Kiến trúc thư mục)
- **Frontend:** ReactJS (Xây dựng giao diện Dashboard quản trị doanh nghiệp).
- **Backend Core:** ExpressJS (Node.js) xử lý CRUD nghiệp vụ, phân quyền RBAC và kết nối SQL Server.
- **AI Microservice:** Python (FastAPI/Flask) xử lý RAG, Text-to-SQL và Function Calling.
- **Database Quan hệ:** Microsoft SQL Server (Sử dụng script `erdlancuoi.sql` với tổng cộng 24 bảng dữ liệu cốt lõi).
- **Environment:** Visual Studio Code, Git Version Control.
- **Cấu trúc thư mục `.claude/` quản lý ngữ cảnh:**
  - `rules/database.md`: Quy định cứng về tính toàn vẹn của 24 bảng SQL Server.
  - `rules/api-style.md`: Quy chuẩn thiết kế cấu trúc API Response chung.
  - `agents/reviewer.md`: Sub-agent chuyên gia review code và soi ràng buộc CSDL.
  - `agents/qa-tester.md`: Sub-agent chuyên gia viết Test Cases và kiểm thử API/Logic.

## 3. UI/UX & Design System Guidelines (Phong cách thiết kế giao diện)
*Áp dụng nghiêm ngặt cho toàn bộ mã nguồn Frontend (ReactJS):*
- **Phong cách chủ đạo:** Modern Enterprise & Clean Dashboard (chuẩn SAP, Jira, Workday), tối ưu hóa mật độ dữ liệu (Data-Dense).
- **Bố cục (Layout):**
  - Layout 2 cột chuẩn: Sidebar menu cố định bên trái (Nhân sự, Chấm công, Lương, KPI, AI Chatbot), vùng nội dung chính bên phải.
  - Sử dụng Grid system rõ ràng, các ô thẻ thống kê (Metrics Cards) ở đầu trang và Data Tables cho bảng biểu.
- **Hệ thống màu sắc (Color Palette):**
  - **Primary:** Xanh dương đậm (Navy Blue / Royal Blue) thể hiện sự uy tín và tổ chức doanh nghiệp.
  - **Background:** Tông sáng nhẹ nhàng (`#F4F6F9` hoặc Off-white) cho Light mode tránh mỏi mắt; hỗ trợ Dark mode riêng cho khung AI Chat.
  - **Status Colors:** Xanh lá (Hoạt động/Thành công), Cam/Vàng (Chờ duyệt/Cảnh báo), Đỏ (Từ chối/Vi phạm).
- **Kiểu chữ (Typography):** Sử dụng các font Sans-serif hiện đại, hiển thị số liệu sắc nét như *Inter*, *Roboto*, hoặc *Segoe UI*. Chú trọng tính trực quan (Scannability) cho số liệu thống kê lớn.
- **Hiển thị dữ liệu & Tương tác:**
  - **Data Tables:** Hỗ trợ tìm kiếm nhanh, phân trang (pagination), lọc theo phòng ban và cố định dòng tiêu đề (Sticky header) do hệ thống có tới 24 bảng liên kết.
  - **Charts & Graphs:** Tích hợp biểu đồ trực quan (Recharts / Chart.js) cho trang tổng quan (quỹ lương, biến động nhân sự, hiệu suất KPI).
  - **AI Interaction:** Thiết kế Floating Chat Widget hoặc Chat Drawer gọn gàng ở góc màn hình để tương tác mượt mà.

## 4. Naming Conventions & Code Standards (Quy chuẩn đặt tên & Lập trình)
*Quy định bắt buộc cho toàn bộ tên file, tên biến, tên hàm, tên route và các thành phần mã nguồn trong dự án:*
- **Tiếng Việt không dấu:** Tuyệt đối không dùng tiếng Anh cho tên hàm/biến tùy chỉnh, phải dùng từ vựng tiếng Việt không dấu.
- **Định dạng camelCase (Viết liền, không khoảng trắng, không dấu gạch dưới `_`, không dấu hỏi/ngã/nặng):**
  - Chữ cái đầu tiên viết thường, các chữ cái đầu của từ tiếp theo viết hoa.
  - *Ví dụ đúng:* `tongHopDashboard`, `layDanhSachNhanVien`, `tinhLuongThangNay`, `kiemTraQuyPhep`.
  - *Ví dụ sai:* `tong_hop_dashboard`, `LayDanhSach`, `tính_lương`.
- **Giữ nguyên chuẩn Database:** Riêng đối với tên bảng và tên cột trong cơ sở dữ liệu SQL Server, giữ nguyên 100% theo script `erdlancuoi.sql` (ví dụ: `maNhanVien`, `chucDanhPhongBanId`) để không làm sai lệch truy vấn.

## 5. Mandatory Rules (Quy tắc bắt buộc)
- **NO ERD CHANGES:** Tuyệt đối không tự ý thay đổi cấu trúc, tên bảng, tên cột hoặc kiểu dữ liệu (`NVARCHAR`, `DECIMAL(15,2)`, `IDENTITY`,...) đã định nghĩa trong `erdlancuoi.sql`.
- **Foreign Keys & Constraints:** Tuân thủ nghiêm ngặt quan hệ khóa ngoại trên 24 bảng (xem chi tiết tại `rules/database.md`).
- **Clean Code & Tiếng Việt:** Viết code sạch, có comment giải thích bằng tiếng Việt cho các nghiệp vụ nhân sự phức tạp.
- **Text-to-SQL Safety:** Chỉ cho phép thực hiện truy vấn đọc dữ liệu (`SELECT`), cấm tuyệt đối các thao tác ghi/xóa nguy hiểm (`DROP`, `DELETE`, `UPDATE`).
- **Settings & Config Safeguard:** Bất cứ khi nào cần chỉnh sửa, bổ sung hoặc thay đổi cấu hình trong file `settings.json` hoặc các tệp cấu hình môi trường, Claude bắt buộc phải đưa ra thông báo chi tiết, giải thích lý do và chờ sự xác nhận (đồng ý) từ người dùng trước khi tiến hành ghi file.

## 6. Section-by-Section Coding Workflow (Quy trình code theo từng Section)
Khi thực hiện một tính năng lớn, chia nhỏ thành các section sau:
1. **Section 1 (Database & Model):** Kiểm tra phạm vi bảng trong 24 bảng CSDL.
2. **Section 2 (Backend API & Service):** Viết ExpressJS Controller/Service tuân thủ chuẩn JSON Response (xem tại `rules/api-style.md`) và quy chuẩn đặt tên tiếng Việt không dấu (`camelCase`).
3. **Section 3 (Code Review):** Kêu gọi Sub-agent `agents/reviewer.md` đối chiếu code với ràng buộc CSDL và quy chuẩn đặt tên.
4. **Section 4 (QA Testing & Auto-Update):** Kêu gọi Sub-agent `agents/qa-tester.md` sinh test cases và tiến hành cập nhật tiến độ vào file này.

## 7. Code Diff & Verification Protocol (Quy trình kiểm tra mã nguồn)
- **Diff Analysis:** AI phải tóm tắt rõ những dòng code hoặc file vừa tạo/sửa đổi so với logic hiện tại.
- **Constraint Check:** Xác thực an toàn CSDL, tuân thủ quy chuẩn đặt tên và không làm lệch cấu trúc 24 bảng.

## 8. Security & Authentication Standards (Tiêu chuẩn bảo mật & Xác thực)
- **JWT & RBAC:** Sử dụng JSON Web Token (JWT) để xác thực phiên làm việc người dùng. Phân quyền chặt chẽ theo mô hình RBAC dựa trên 5 nhóm đối tượng chính: `Admin`, `giamDoc`, `quanLy`, `HR`, và `nhanVien` trước khi cho phép truy cập bất kỳ route API bảo mật nào.
- **Data Isolation (Cô lập dữ liệu):** Nhân viên (`nhanVien`) chỉ có quyền truy cập, xem hoặc chỉnh sửa thông tin cá nhân của chính mình, tuyệt đối không được xem dữ liệu nhạy cảm (như lương, hợp đồng, hồ sơ) của nhân sự khác trừ khi thuộc thẩm quyền phân cấp của `quanLy`, `HR` hoặc `Admin`.
- **Data Encryption (Mã hóa dữ liệu):** Mật khẩu người dùng bắt buộc phải được băm một chiều an toàn bằng thuật toán `bcrypt` trước khi lưu trữ vào cột `matKhauMaHoa` trong cơ sở dữ liệu.
- **Audit Trails (Ghi vết hệ thống):** Mọi thao tác quan trọng, nhạy cảm (thêm/sửa/xóa nhân sự, duyệt bảng lương, thay đổi hợp đồng, phân quyền) phải được tự động ghi nhận vào bảng `NhatKyHeThong` kèm theo thời gian và địa chỉ IP.

## 9. State Management & Error Handling (Quản lý trạng thái & Xử lý lỗi)
- **Global Error Middleware:** Mọi ngoại lệ (exceptions) phát sinh tại tầng Backend (ExpressJS) phải được bắt tập trung qua middleware, ghi log và trả về client theo cấu trúc JSON chuẩn: `{"success": false, "code": [HTTP Status], "message": "Thông báo lỗi chi tiết bằng tiếng Việt", "data": null}`.
- **Database Transactions (Giao dịch CSDL):** Bắt buộc sử dụng Transaction (đảm bảo tính ACID) cho các luồng nghiệp vụ phức tạp liên quan đến nhiều bảng (ví dụ: quy trình duyệt đơn nghỉ phép phải đồng thời cập nhật trạng thái đơn và trừ số ngày phép tương ứng trong bảng `QuyNgayPhep`, hoặc quy trình chốt lương) nhằm tránh lệch dữ liệu.
- **Graceful Degradation (Xử lý sự cố hạ tầng AI):** Khi dịch vụ LLM API hoặc Vector Database gặp sự cố mất kết nối, hệ thống phải bắt lỗi an toàn, tuyệt đối không làm sập ứng dụng (crash server) và hiển thị thông báo chuyển hướng hoặc đưa tác vụ vào hàng đợi ngầm (Queue) nếu cần thiết.

## 10. AI Integration Standards (Tiêu chuẩn tích hợp AI Agent)
- **Function Calling (Tác vụ hành chính qua chat):** Khi `nhanVien` tương tác qua khung chat để làm thủ tục, AI Agent phải nhận diện đúng ý định (`Intent`), bóc tách chính xác các tham số thực thể (`Entities` như ngày bắt đầu, số lượng ngày, loại phép, lý do) và gọi đúng API Backend để khởi tạo bản ghi ở trạng thái chờ duyệt (`PENDING`).
- **Text-to-SQL Guardrails (Truy vấn báo cáo thời gian thực):** Các câu lệnh SQL do `giamDoc` hoặc `quanLy` kích hoạt thông qua ngôn ngữ tự nhiên chỉ được phép sử dụng cú pháp đọc dữ liệu (`SELECT`), nghiêm cấm tuyệt đối mọi câu lệnh can thiệp cấu trúc hoặc thay đổi dữ liệu (`DROP`, `DELETE`, `UPDATE`, `INSERT`) nhằm bảo mật tuyệt đối CSDL.
- **RAG Engine (Tra cứu quy chế nội bộ):** Ứng dụng kỹ thuật chia nhỏ văn bản (`Chunking`) và Vector Embeddings lưu trữ trong Vector Database; khi trả lời các câu hỏi chính sách, AI bắt buộc phải đối chiếu ngữ nghĩa và đính kèm trích dẫn nguồn tài liệu hoặc số điều khoản cụ thể để tránh hiện tượng bịa đặt thông tin (hallucination).

## 11. Feature Completion & Auto-Update Protocol (Nhật ký tiến độ dự án)
*(Cập nhật trực tiếp vào đây ngay sau khi hoàn thành từng Section/Tính năng)*

- **Progress Status (Tiến độ):**
  - [ ] Khởi tạo CSDL 24 bảng & Phân quyền RBAC cho 5 nhóm (`Admin`, `giamDoc`, `quanLy`, `HR`, `nhanVien`) (Chưa bắt đầu)
  - [ ] Module Hồ sơ nhân sự, Trạng thái lao động & Hợp đồng (Chưa bắt đầu)
  - [ ] Module Chấm công trực tuyến, Đơn từ hành chính & Lương (Chưa bắt đầu)
  - [ ] Module Đánh giá KPI, Khen thưởng & Kỷ luật (Chưa bắt đầu)
  - [ ] Tầng AI Agent: RAG quy chế, Function Calling tạo đơn, Text-to-SQL báo cáo (Chưa bắt đầu)

- **Endpoints Registry (Danh sách API đã hoàn thành):**
  - *(Chưa có)*

- **Environment Variables & Gotchas (Biến môi trường & Lưu ý kỹ thuật):**
  - *(Chưa có)*