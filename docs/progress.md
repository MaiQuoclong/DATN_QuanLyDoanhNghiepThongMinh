# Nhật ký tiến độ Smart HRM

## Tiến độ
- [x] Khởi tạo CSDL 25 bảng & phân quyền RBAC 5 nhóm (`Admin`, `giamDoc`, `quanLy`, `HR`, `nhanVien`) — đã làm: đăng nhập/đổi mật khẩu/đăng xuất (JWT), middleware `xacThucJwt` + `phanQuyen` + `kiemTraDuLieu`, khung giao diện (đăng nhập, đổi mật khẩu, bố cục, tuyến bảo vệ). Test: `backend/tests/xacThuc.test.js` (66 test, pass; toàn backend 69/69 pass, 2026-10-31). Chưa có API quản trị tài khoản/gán vai trò/reset mật khẩu tạm.
- [ ] Module Hồ sơ nhân sự, Trạng thái lao động & Hợp đồng
- [ ] Module Chấm công, Đơn từ hành chính & Lương
- [ ] Module Đánh giá KPI, Khen thưởng & Kỷ luật
- [ ] Tầng AI Agent: RAG quy chế, Function Calling tạo đơn, Text-to-SQL báo cáo

## Danh sách API đã hoàn thành
| Method | Endpoint | Vai trò | Mô tả |
|---|---|---|---|
| GET | `/api/v1/sucKhoe` | Công khai | Trạng thái máy chủ và kết nối CSDL (`KET_NOI` / `MAT_KET_NOI`) |
| POST | `/api/v1/xacThuc/dangNhap` | Công khai | `{tenDangNhap, matKhau}` → `{token, nguoiDung}`; sai 401, khóa 403, thiếu trường 400 |
| GET | `/api/v1/xacThuc/toi` | Đã đăng nhập (kể cả mật khẩu tạm) | Thông tin tài khoản, vai trò, `batBuocDoiMatKhau` |
| POST | `/api/v1/xacThuc/doiMatKhau` | Đã đăng nhập (kể cả mật khẩu tạm) | `{matKhauCu, matKhauMoi}` (≥8 ký tự, có chữ và số) → token mới, thu hồi token cũ |
| POST | `/api/v1/xacThuc/dangXuat` | Đã đăng nhập (kể cả mật khẩu tạm) | Ghi `DANG_XUAT` vào `nhatkyhethong` |

## Biến môi trường & lưu ý kỹ thuật
- CSDL là MariaDB 10.4 (XAMPP), không phải SQL Server. Schema: `database/schema.sql`.
- Tên database viết thường: `quanlydoanhnghiepthongminh`.
- Bảng mở rộng `dexuatkhenthuongkyluat` (2026-10-29) cho luồng quanLy đề xuất khen thưởng/kỷ luật. Ma trận quyền: `docs/phan-quyen.md`.
- Mật khẩu tạm (HR/Admin reset) không có cột cờ trong schema: suy ra từ `nhatkyhethong` (`RESET_MAT_KHAU_TAM` mới hơn `DOI_MAT_KHAU` thì bắt buộc đổi, hết hạn sau 24 giờ).
- Dữ liệu mẫu: `database/seed.sql` (6 tài khoản `admin`, `giamdoc`, `quanly`, `hr`, `nhanvien`, `nhanvien2`, mật khẩu `MatKhau@123`; mọi tài khoản có thêm vai trò `nhanVien`). Test Auth dùng `nhanvien2` để thay đổi dữ liệu và tự khôi phục sau mỗi test.
- `app.set('trust proxy', 'loopback')`: chỉ tin `X-Forwarded-For` từ proxy cục bộ (Vite dev) để ghi đúng IP vào `nhatkyhethong`; triển khai sau reverse proxy khác phải đổi giá trị.
- `express-rate-limit`: `/dangNhap` và `/doiMatKhau` mỗi route một limiter riêng, tối đa 10 lần **thất bại** / 15 phút (`skipSuccessfulRequests`, trả 429); `/dangNhap` đếm theo IP + `tenDangNhap`, `/doiMatKhau` đếm theo `nguoiDungId` (đặt sau xác thực token). Nếu nâng lên v8 phải bọc IP bằng `ipKeyGenerator`, tự tắt khi `NODE_ENV=test` (Jest tự đặt).
- Thu hồi token khi đổi/reset mật khẩu so `iat` với số giây từ mốc `DOI_MAT_KHAU`/`RESET_MAT_KHAU_TAM` gần nhất, **dung sai 1 giây** (`xacThucService.js:65`): token cấp trong khoảng ~1 giây trước mốc vẫn còn hiệu lực đến khi hết hạn JWT. Test phải chờ >2 giây giữa lúc lấy token và lúc đổi mật khẩu.
- **Theo dõi hiệu năng `nhatkyhethong` (chưa sửa, 2026-10-31):** mỗi request có token chạy `layMocMatKhau` (`nhatKyRepository.js`), dùng index `nguoiDungId` sẵn có nên chỉ đọc nhật ký của một người (EXPLAIN: `type=ref`), hiện không đáng kể. Khi API có token chậm rõ rệt hoặc một người có hàng chục nghìn dòng nhật ký → Claude phải báo người dùng và đề xuất: (1) cache mốc mật khẩu trong RAM ~60 giây, xóa cache khi ghi `DOI_MAT_KHAU`/`RESET_MAT_KHAU_TAM` (không đổi schema, chỉ đúng khi chạy 1 tiến trình backend); (2) nếu chưa đủ, index ghép `(nguoiDungId, hanhDong, id)` — cần người dùng đồng ý vì phải sửa `schema.sql`.
- JWT chỉ chứa `nguoiDungId`; `kiemTraPhien` đọc lại `trangThai`, `nhanVienId`, `vaiTro` từ CSDL mỗi request (`req.nguoiDung = { nguoiDungId, nhanVienId, vaiTro, batBuocDoiMatKhau }`).
- Hành động nhật ký đăng nhập: `DANG_NHAP`, `DANG_NHAP_THAT_BAI`, `DANG_NHAP_BI_KHOA` (403), `DANG_NHAP_MAT_KHAU_TAM_HET_HAN` (401, mật khẩu tạm quá 24h), `DANG_NHAP_KHONG_VAI_TRO` (403, tài khoản chưa có vai trò); ngoài ra `DANG_XUAT`, `DOI_MAT_KHAU`, `RESET_MAT_KHAU_TAM`. Test xóa các bản ghi `DANG_NHAP_BI_KHOA`/`..._HET_HAN`/`..._KHONG_VAI_TRO`/`DOI_MAT_KHAU`/`RESET_MAT_KHAU_TAM` sinh ra (giữ `DANG_NHAP`/`DANG_NHAP_THAT_BAI`/`DANG_XUAT`).
- Đăng nhập bằng email: gửi email qua **trường `tenDangNhap`** (repo so khớp `tenDangNhap OR email`); body `{email, matKhau}` bị 400 vì `tenDangNhap` là bắt buộc.
- **MySQL (XAMPP) chạy ở cổng 3307**, không phải 3306 mặc định → `CSDL_CONG=3307`. Lệnh CLI cần thêm `-P 3307 -h 127.0.0.1`.
- Backend chỉ đọc `backend/.env` (tạo bằng cách copy `.env.example`); sửa `.env.example` không có tác dụng khi chạy. `nodemon` không theo dõi `.env` → sửa xong phải `Ctrl+C` rồi `npm run dev` lại.
- Express 5 (đã tự bắt lỗi async; `batLoiBatDongBo` vẫn giữ theo quy chuẩn). `bcrypt` 6 dùng bản dựng sẵn, cảnh báo "install-scripts" của npm 11 có thể bỏ qua.
- `schema.sql` không chứa `CREATE DATABASE` → phải tạo database `quanlydoanhnghiepthongminh` (utf8mb4_general_ci) trước khi import; import lại sẽ DROP các bảng hiện có.
- Chạy backend: `cd backend` → `npm test` → `npm run dev` → mở `http://localhost:5000/api/v1/sucKhoe`.
