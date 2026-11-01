# Nhật ký tiến độ Smart HRM

## Tiến độ
- [x] Khởi tạo CSDL 25 bảng & phân quyền RBAC 5 nhóm (`Admin`, `giamDoc`, `quanLy`, `HR`, `nhanVien`) — đã làm: đăng nhập/đổi mật khẩu/đăng xuất (JWT), middleware `xacThucJwt` + `phanQuyen` + `kiemTraDuLieu`, khung giao diện (đăng nhập, đổi mật khẩu, bố cục, tuyến bảo vệ). Test: `backend/tests/xacThuc.test.js` (pass; token thiếu/sai `nguoiDungId` đã sửa → 401). Quản trị tài khoản (`/api/v1/nguoiDung`): danh sách, cấp mật khẩu tạm, khóa/mở, gán vai trò, nhật ký hệ thống — test `backend/tests/nguoiDung.test.js` (94 test, pass; gồm cookie httpOnly, `X-Tra-Token`, chặn Origin lạ).
- [x] Module Hồ sơ nhân sự, Trạng thái lao động & Hợp đồng (backend + frontend + seed, 2026-11-01)
  - [x] Hồ sơ nhân sự & trạng thái lao động (`/api/v1/nhanVien`) — test `backend/tests/nhanVien.test.js` (130 test, pass). Toàn backend 316/316 pass (2026-11-01, `npm test` hai lần + `npx jest --runInBand --randomize`).
  - [x] Cơ cấu tổ chức (`/api/v1/phongBan`, `/chucDanh`, `/chucDanhPhongBan`, bổ nhiệm/miễn nhiệm) — test `backend/tests/coCauToChuc.test.js` (101 test, pass). Toàn backend 417/417 pass (2026-11-01, `npm test` hai lần + `npm test -- --randomize`, seed 395550296).
  - [x] Hợp đồng lao động (`/api/v1/hopDong`) — test `backend/tests/hopDong.test.js` (96 test, pass). Sau đợt sửa lỗi reviewer: toàn backend 519/519 pass (2026-11-01, `npm test` + `npx jest --runInBand --randomize` seed -457478370; thêm test: chồng lấn với hợp đồng DA_CHAM_DUT, DUOC_PHAN_QUYEN chỉ khi đổi quanLy, sửa phòng con khi cha ngừng, nhật ký chỉ ghi trường đổi, DANG_NHAP_THAT_BAI không ghi chuỗi lạ). Trước đó 512/512 pass (2026-11-01, `npm test` hai lần + `npm test -- --randomize`, seed -574257199) trên CSDL vừa dựng lại bằng `npm run khoiTaoCsdl`. Test đặt ngày hợp đồng mẫu 6, 7 tương đối theo hôm nay ở `beforeEach` (seed dùng ngày cố định).
  - [x] Frontend module: Hồ sơ của tôi, Danh sách/Chi tiết nhân viên (`/nhanSu/danhSach/:id`), Hợp đồng (cảnh báo hết hạn, lịch sử, thao tác HR), Phòng ban (cây + vị trí + chức danh, bổ nhiệm), Hệ thống: Tài khoản (chỉ Admin), Nhật ký. `vite build` pass; chưa kiểm thử tự động giao diện.
- [ ] Module Chấm công, Đơn từ hành chính & Lương
- [ ] Module Đánh giá KPI, Khen thưởng & Kỷ luật
- [ ] Tầng AI Agent: RAG quy chế, Function Calling tạo đơn, Text-to-SQL báo cáo

## Đang làm & việc tiếp theo (cập nhật 2026-11-01)
- Nhánh hiện tại: `feature/ho-so-nhan-su` — module 2 xong, chờ người dùng thử trên web (`npm run dev` ở backend + frontend), commit, PR về `develop`, rồi PR `develop` → `main` (xong trọn module).
- Quy trình: xong MỖI chức năng → `reviewer` toàn project → sửa lỗi → `qa-tester` toàn project → sửa lỗi → mới làm chức năng kế tiếp.
- Review lượt 2 (toàn project) đã sửa: chồng lấn với hợp đồng chấm dứt ở tương lai, DUOC_PHAN_QUYEN chỉ ghi khi đổi quanLy, đổi tên phòng ban khi phòng cha đã ngừng, nhật ký chỉ ghi trường thật sự đổi, không lưu tenDangNhap lạ khi đăng nhập sai. Backend 519/519 (cả randomize).
- Seed mở rộng nhiều người/vai trò (hr2 NV0007, giamdoc2 NV0008, quanly2 NV0009 trưởng PKD, nhanvien3 NV0010; hợp đồng 8-11): test đã bỏ đếm cứng, giá trị kỳ vọng tính từ CSDL (COUNT, MAX mã NV, quân số theo cây phòng ban). Thêm 8 test "Nhiều người cùng vai trò" trong `nhanVien.test.js` (quanly2 chỉ thấy PKD, quanly không thấy PKD, hr/hr2 sửa hồ sơ lẫn nhau, giamdoc2 xem toàn công ty). Backend 529/529 pass (2026-11-01, `npm test` + `npx jest --runInBand --randomize` seed 34658132).
- Tồn đọng (chưa sửa, chờ quyết định): form lập hợp đồng nhập `nhanVienId` thay vì ô chọn nhân viên; nút "Cấp mật khẩu tạm" hiện với tài khoản cấp cao; sửa vị trí/chức danh gọi 2 API không nguyên tử; ứng viên bổ nhiệm tối đa 100; tài khoản quanLy có sẵn trong seed (`quanly`, `quanly2`) không có nhật ký TU_DONG_GAN_QUAN_LY nên miễn nhiệm không tự gỡ quanLy (đúng thiết kế; demo luồng tự gỡ thì bổ nhiệm người mới).
- Seed (review lượt 3): mỗi vai trò ≥ 2 người (thêm hr2, giamdoc2, quanly2 - trưởng PKD, nhanvien3); lịch sử hợp đồng lập trước khi HR vào làm do giám đốc NV0002 thực hiện. Backend 529/529 (randomize) trên DB dựng lại.
- Tiếp theo: Module Chấm công, Đơn từ hành chính & Lương — nhánh `feature/cham-cong` từ `develop`.
- Frontend: tab Tài khoản chỉ Admin (API `/nguoiDung` chỉ Admin); HR cấp mật khẩu tạm trong chi tiết nhân viên. Trang mới đăng ký trong `TRANG_DA_LAM` / `TRANG_CON` ở `frontend/src/App.jsx`.

## Danh sách API đã hoàn thành
| Method | Endpoint | Vai trò | Mô tả |
|---|---|---|---|
| GET | `/api/v1/sucKhoe` | Công khai | Trạng thái máy chủ và kết nối CSDL (`KET_NOI` / `MAT_KET_NOI`) |
| POST | `/api/v1/xacThuc/dangNhap` | Công khai | `{tenDangNhap, matKhau}` → `{nguoiDung}` + cookie `smartHrmToken` (`token` trong body chỉ khi có header `X-Tra-Token: 1`); sai 401, khóa 403, thiếu trường 400 |
| GET | `/api/v1/xacThuc/toi` | Đã đăng nhập (kể cả mật khẩu tạm) | Thông tin tài khoản, vai trò, `batBuocDoiMatKhau` |
| POST | `/api/v1/xacThuc/doiMatKhau` | Đã đăng nhập (kể cả mật khẩu tạm) | `{matKhauCu, matKhauMoi}` (≥8 ký tự, có chữ và số) → token mới, thu hồi token cũ |
| POST | `/api/v1/xacThuc/dangXuat` | Công khai (token tùy chọn) | Luôn 200 và xóa cookie; chỉ ghi `DANG_XUAT` khi token còn hợp lệ |
| GET | `/api/v1/nguoiDung` | Admin | `?tuKhoa&trangThai&vaiTro&trang&kichThuoc`; kèm `vaiTro[]` và hồ sơ liên kết |
| GET | `/api/v1/nguoiDung/:id` | Admin | Thông tin tài khoản + vai trò |
| POST | `/api/v1/nguoiDung/:id/datLaiMatKhau` | Admin (mọi tài khoản), HR (không có vai trò Admin/giamDoc/HR) | Trả `matKhauTam` một lần; ghi `RESET_MAT_KHAU_TAM` (người bị reset, thu hồi token cũ) + `CAP_MAT_KHAU_TAM` (người cấp); không tự reset mình |
| POST | `/api/v1/nguoiDung/:id/khoa` | Admin | `{lyDo}`; ghi `KHOA_TAI_KHOAN`; chặn tự khóa và khóa Admin hoạt động cuối cùng (409) |
| POST | `/api/v1/nguoiDung/:id/moKhoa` | Admin | `{lyDo}`; ghi `MO_KHOA_TAI_KHOAN`; người `DA_NGHI_VIEC` trả 409 (HR phải cho quay lại làm việc) |
| PUT | `/api/v1/nguoiDung/:id/vaiTro` | Admin | `{vaiTro: [...]}` thay toàn bộ; có hồ sơ thì luôn giữ `nhanVien`; không tự gỡ Admin, không gỡ Admin cuối; ghi `PHAN_QUYEN` |
| GET | `/api/v1/vaiTro` | Admin | Danh mục 5 vai trò |
| GET | `/api/v1/nhatKyHeThong` | Admin, giamDoc | `?nguoiDungId&hanhDong&tuNgay&denNgay&trang&kichThuoc`, mới nhất trước |
| GET | `/api/v1/phongBan` | Mọi vai trò | `?trangThai`; danh sách phẳng (dựng cây theo `phongBanChaId`), kèm trưởng bộ phận, `soNhanVien` (trực tiếp) và `tongQuanSo` (cộng cả phòng con) |
| GET | `/api/v1/phongBan/:id` | Mọi vai trò | Phòng ban + `viTri[]`; `dinhBien`/`conTrong`/`ghiChu` chỉ trả cho HR, giamDoc |
| POST | `/api/v1/phongBan` | HR | `{maPhongBan, tenPhongBan, phongBanChaId?}` (mã viết hoa, trùng 409; cha phải đang hoạt động); log `THEM_PHONG_BAN` |
| PATCH | `/api/v1/phongBan/:id` | HR | `{tenPhongBan?, phongBanChaId? (null = gốc)}`; chặn vòng 409; log `SUA_PHONG_BAN` |
| POST | `/api/v1/phongBan/:id/doiTrangThai` | HR | `{trangThai}`; ngừng khi không còn nhân viên đang làm và phòng con hoạt động (409), tự miễn nhiệm trưởng; kích hoạt cần cha hoạt động; log `NGUNG_/KICH_HOAT_PHONG_BAN` |
| POST | `/api/v1/phongBan/:id/boNhiem` | giamDoc | `{nhanVienId}`; người đang làm việc (không TAM_NGHI/DA_NGHI_VIEC) thuộc chính phòng đó, không tự bổ nhiệm; tự gán vai trò `quanLy` (người cũ bị gỡ nếu hết phòng); log `BO_NHIEM_TRUONG_BO_PHAN` + `TU_DONG_GAN_QUAN_LY` (theo người được bổ nhiệm) |
| POST | `/api/v1/phongBan/:id/mienNhiem` | giamDoc | Gỡ `truongBoPhanId`, tự gỡ `quanLy` nếu hết phòng; log `MIEN_NHIEM_TRUONG_BO_PHAN` |
| GET | `/api/v1/chucDanh` | Mọi vai trò | `?trangThai` |
| POST / PATCH | `/api/v1/chucDanh`, `/chucDanh/:id` | HR | `{maChucDanh, tenChucDanh, capBac}` / sửa tên, cấp bậc; log `THEM_/SUA_CHUC_DANH` |
| POST | `/api/v1/chucDanh/:id/doiTrangThai` | HR | Ngừng khi không còn vị trí `DANG_AP_DUNG` dùng chức danh (409) |
| GET | `/api/v1/chucDanhPhongBan` | HR, giamDoc | `?phongBanId&trangThai`; vị trí kèm `dinhBien`, `soDangGiu`, `conTrong` (form thêm/điều chuyển) |
| POST / PATCH | `/api/v1/chucDanhPhongBan`, `/chucDanhPhongBan/:id` | HR | `{phongBanId, chucDanhId, dinhBien 1-1000, ghiChu}` (trùng 409) / sửa định biên (≥ số đang giữ, 409), ghi chú; log `THEM_/SUA_VI_TRI` |
| POST | `/api/v1/chucDanhPhongBan/:id/doiTrangThai` | HR | Ngừng khi không còn người giữ (409); áp dụng lại cần phòng ban + chức danh hoạt động |
| GET | `/api/v1/nhanVien` | HR, giamDoc; quanLy (PM) | `?tuKhoa&phongBanId&trangThaiLamViec&trang&kichThuoc` (tối đa 100); không trả ngân hàng; tham số sai 400 |
| GET | `/api/v1/nhanVien/toi` | Người có hồ sơ | Hồ sơ đầy đủ của mình |
| PATCH | `/api/v1/nhanVien/toi` | Người có hồ sơ | Sửa `soDienThoai`, `diaChi`, `soTaiKhoanNganHang`, `tenNganHang` (`""` = xóa); log `CAP_NHAT_HO_SO_CA_NHAN` |
| GET | `/api/v1/nhanVien/:id` | Mình; HR, giamDoc; quanLy (PM, ẩn ngân hàng) | 403 nếu ngoài phạm vi |
| POST | `/api/v1/nhanVien` | HR | Transaction: `nguoidung` (mật khẩu tạm) + vai trò `nhanVien` + `nhanvien` (sinh `NVxxxx`), kiểm tra định biên, đủ 15 tuổi; trả `taiKhoan.matKhauTam` một lần; log `THEM_NHAN_VIEN` + `RESET_MAT_KHAU_TAM` |
| PATCH | `/api/v1/nhanVien/:id` | HR (trừ mình) | Sửa thông tin hồ sơ; log `SUA_NHAN_VIEN` |
| POST | `/api/v1/nhanVien/:id/doiTrangThai` | HR (trừ mình) | `{trangThaiLamViec, lyDo}`; `DA_NGHI_VIEC` → khóa tài khoản (409 nếu đang là trưởng bộ phận), quay lại → mở khóa; log `DOI_TRANG_THAI_LAM_VIEC` |
| POST | `/api/v1/nhanVien/:id/dieuChuyen` | HR (trừ mình) | `{chucDanhPhongBanId, lyDo}`; kiểm tra định biên, chặn trưởng bộ phận rời phòng; log `DIEU_CHUYEN_NHAN_VIEN` |
| GET | `/api/v1/hopDong` | HR, giamDoc | `?tuKhoa&nhanVienId&loaiHopDong&trangThai(HIEU_LUC/HET_HAN/DA_CHAM_DUT)&trang&kichThuoc`; tham số sai 400 |
| GET | `/api/v1/hopDong/cuaToi` | Mọi vai trò | Hợp đồng của mình, mới nhất trước |
| GET | `/api/v1/hopDong/sapHetHan` | HR, giamDoc | `?soNgay` (mặc định 30, tối đa 365) → `{soNgay, items[soNgayConLai]}`; bỏ người `DA_NGHI_VIEC` và hợp đồng đã có hợp đồng nối tiếp |
| GET | `/api/v1/hopDong/:id` | Chính chủ; HR, giamDoc | Kèm `lichSu[]` (mới nhất trước); Admin/quanLy xem người khác 403 |
| POST | `/api/v1/hopDong` | HR (trừ mình) | `{nhanVienId, loaiHopDong, ngayBatDau, ngayKetThuc?, luongCoBan>0, mucPhuCap?, duongDanFileHopDong?, lyDo?}` → 201, mã `HDyyyy-xxxx` theo năm `ngayBatDau`; chồng lấn 409, nghỉ việc 409; log `THEM_HOP_DONG` + lịch sử `TAO_MOI` |
| POST | `/api/v1/hopDong/:id/giaHan` | HR (trừ mình) | `{ngayKetThucMoi, lyDo?}`; chỉ XĐTH đang hiệu lực (409), ngày mới > ngày cũ (400), ≤36 tháng; log `GIA_HAN_HOP_DONG` |
| POST | `/api/v1/hopDong/:id/dieuChinh` | HR (trừ mình) | `{luongCoBan?, mucPhuCap?, duongDanFileHopDong?, lyDo}`; không đổi gì 400; chỉ `HIEU_LUC`; log `DIEU_CHINH_HOP_DONG` |
| POST | `/api/v1/hopDong/:id/chamDut` | HR (trừ mình) | `{ngayChamDut, lyDo}`; ngày trong [bắt đầu, kết thúc]; đã chấm dứt 409; log `CHAM_DUT_HOP_DONG` |

## Biến môi trường & lưu ý kỹ thuật
- **Hợp đồng:** `HET_HAN` không lưu, suy ra khi đọc (`HIEU_LUC` + `ngayKetThuc < CURDATE()`); API trả `trangThai` (suy ra) và `trangThaiLuu`; `lichsuhopdong.trangThaiCu` ghi giá trị lưu thật. THU_VIEC ≤180 ngày, XĐTH ≤36 tháng (bắt buộc ngày kết thúc), KXĐ không có ngày kết thúc; ngày bắt đầu ≥ ngày vào làm và ≤ hôm nay+180. Chồng lấn chỉ xét hợp đồng `HIEU_LUC` (khóa dòng `nhanvien` trước rồi tới hợp đồng). Mã trùng do gap lock thì service thử lại tối đa 3 lần. Test rollback mock `hopDongRepository.themLichSu`; `themNhatKy` được destructure trong service nên `jest.spyOn` trên module nhật ký không có tác dụng.
- CSDL là MariaDB 10.4 (XAMPP), không phải SQL Server. Schema: `database/schema.sql`.
- Tên database viết thường: `quanlydoanhnghiepthongminh`.
- Bảng mở rộng `dexuatkhenthuongkyluat` (2026-10-29) cho luồng quanLy đề xuất khen thưởng/kỷ luật. Ma trận quyền: `docs/phan-quyen.md`.
- Mật khẩu tạm (HR/Admin reset) không có cột cờ trong schema: suy ra từ `nhatkyhethong` (`RESET_MAT_KHAU_TAM` mới hơn `DOI_MAT_KHAU` thì bắt buộc đổi, hết hạn sau 24 giờ).
- Dữ liệu mẫu: `database/seed.sql` (6 tài khoản `admin`, `giamdoc`, `quanly`, `hr`, `nhanvien`, `nhanvien2`, mật khẩu `MatKhau@123`; mọi tài khoản có thêm vai trò `nhanVien`). Test Auth dùng `nhanvien2` để thay đổi dữ liệu và tự khôi phục sau mỗi test.
- `app.set('trust proxy', 'loopback')`: chỉ tin `X-Forwarded-For` từ proxy cục bộ (Vite dev) để ghi đúng IP vào `nhatkyhethong`; triển khai sau reverse proxy khác phải đổi giá trị.
- `express-rate-limit`: `/dangNhap` và `/doiMatKhau` mỗi route một limiter riêng, tối đa 10 lần **thất bại** / 15 phút (`skipSuccessfulRequests`, trả 429); `/dangNhap` đếm theo IP + `tenDangNhap`, `/doiMatKhau` đếm theo `nguoiDungId` (đặt sau xác thực token). Nếu nâng lên v8 phải bọc IP bằng `ipKeyGenerator`, tự tắt khi `NODE_ENV=test` (Jest tự đặt).
- Thu hồi token khi đổi/reset mật khẩu so `iat` với số giây từ mốc `DOI_MAT_KHAU`/`RESET_MAT_KHAU_TAM` gần nhất, **dung sai 1 giây** (`xacThucService.js:77`): token cấp trong khoảng ~1 giây trước mốc vẫn còn hiệu lực đến khi hết hạn JWT. Test phải chờ >2 giây giữa lúc lấy token và lúc đổi mật khẩu.
- **Theo dõi hiệu năng `nhatkyhethong` (chưa sửa, 2026-10-31):** mỗi request có token chạy `layMocMatKhau` (`nhatKyRepository.js`), dùng index `nguoiDungId` sẵn có nên chỉ đọc nhật ký của một người (EXPLAIN: `type=ref`), hiện không đáng kể. Khi API có token chậm rõ rệt hoặc một người có hàng chục nghìn dòng nhật ký → Claude phải báo người dùng và đề xuất cache mốc mật khẩu trong RAM ~60 giây, xóa cache khi ghi `DOI_MAT_KHAU`/`RESET_MAT_KHAU_TAM` (không đổi schema, chỉ đúng khi chạy 1 tiến trình backend — đủ cho quy mô đồ án). Không dùng phương án thêm index vì quy tắc cấm sửa `schema.sql`.
- **Dựng lại CSDL:** `cd backend` → `npm run khoiTaoCsdl` (tạo database nếu chưa có → `schema.sql` → `seed.sql`; thêm `-- --taiKhoanChiDoc` để tạo tài khoản `aiReadonly`). Xóa sạch dữ liệu cũ, bị chặn khi `NODE_ENV=production`.
- JWT chỉ chứa `nguoiDungId`; `kiemTraPhien` đọc lại `trangThai`, `nhanVienId`, `vaiTro` từ CSDL mỗi request (`req.nguoiDung = { nguoiDungId, nhanVienId, vaiTro, batBuocDoiMatKhau }`).
- Hành động nhật ký đăng nhập: `DANG_NHAP`, `DANG_NHAP_THAT_BAI`, `DANG_NHAP_BI_KHOA` (403), `DANG_NHAP_MAT_KHAU_TAM_HET_HAN` (401, mật khẩu tạm quá 24h), `DANG_NHAP_KHONG_VAI_TRO` (403, tài khoản chưa có vai trò); ngoài ra `DANG_XUAT`, `DOI_MAT_KHAU`, `RESET_MAT_KHAU_TAM`. Test xóa các bản ghi `DANG_NHAP_BI_KHOA`/`..._HET_HAN`/`..._KHONG_VAI_TRO`/`DOI_MAT_KHAU`/`RESET_MAT_KHAU_TAM` sinh ra (giữ `DANG_NHAP`/`DANG_NHAP_THAT_BAI`/`DANG_XUAT`).
- Đăng nhập bằng email: gửi email qua **trường `tenDangNhap`** (repo so khớp `tenDangNhap OR email`); body `{email, matKhau}` bị 400 vì `tenDangNhap` là bắt buộc.
- **MySQL (XAMPP) chạy ở cổng 3307**, không phải 3306 mặc định → `CSDL_CONG=3307`. Lệnh CLI cần thêm `-P 3307 -h 127.0.0.1`.
- Backend chỉ đọc `backend/.env` (tạo bằng cách copy `.env.example`); sửa `.env.example` không có tác dụng khi chạy. `nodemon` không theo dõi `.env` → sửa xong phải `Ctrl+C` rồi `npm run dev` lại.
- Express 5 (đã tự bắt lỗi async; `batLoiBatDongBo` vẫn giữ theo quy chuẩn). `bcrypt` 6 dùng bản dựng sẵn, cảnh báo "install-scripts" của npm 11 có thể bỏ qua.
- `schema.sql` không chứa `CREATE DATABASE` → phải tạo database `quanlydoanhnghiepthongminh` (utf8mb4_general_ci) trước khi import; import lại sẽ DROP các bảng hiện có.
- **Quy ước module Hồ sơ nhân sự (không đổi schema):** `trangThaiLamViec` ∈ `THU_VIEC`, `CHINH_THUC`, `TAM_NGHI`, `DA_NGHI_VIEC`; `gioiTinh` ∈ `NAM`, `NU`, `KHAC`; tài khoản bị khóa lưu `nguoidung.trangThai = 'KHOA'`. Định biên = số nhân viên chưa `DA_NGHI_VIEC` giữ cùng `chucDanhPhongBanId` ≤ `dinhBien`. Phạm vi quanLy tính bằng `WITH RECURSIVE` trong `phongBanRepository.layPhongBanQuanLy`.
- **Test module nhân viên (2026-10-31):** `nhanVien.test.js` chụp lại `nhanvien`, `nguoidung.trangThai`, `chucdanhphongban.dinhBien`, `nguoidungvaitro`, `vaitro` ở `beforeAll`; sau mỗi test xóa nhân viên/người dùng/vai trò/nhật ký mới sinh, khôi phục ảnh chụp và `ALTER TABLE ... AUTO_INCREMENT = 1` (InnoDB tự về MAX+1) nên mã mới luôn là `NV0007`. Ca rollback làm hỏng tạm `vaitro.maVaiTro = 'nhanVien'` để `ganVaiTro` thất bại giữa transaction.
- Tìm kiếm `tuKhoa` không phân biệt dấu do collation `utf8mb4_general_ci` (`Hoa` khớp cả `Hoàng`).
- Đã sửa: `xacThucService.kiemTraPhien` (`src/services/xacThucService.js:63-65`) kiểm tra `nguoiDungId` trong payload → token thiếu/sai trường này trả 401.
- **Đăng nhập trên web dùng cookie httpOnly `smartHrmToken`** (`utils/cookieXacThuc.js`, SameSite=Strict, path `/api`, secure khi production): frontend không lưu token. `xacThucJwt` ưu tiên header `Bearer` (test, Postman, AI service), không có thì đọc cookie. Body `dangNhap`/`doiMatKhau` **không trả `token`** trừ khi gửi header `X-Tra-Token: 1` (đúng giá trị `1`); cả hai đặt `Cache-Control: no-store`. Cookie rác/sai định dạng → 401 (không 500).
- `POST /xacThuc/dangXuat` luôn trả 200 và xóa cookie, kể cả token hỏng/thu hồi (chỉ ghi `DANG_XUAT` khi token hợp lệ).
- **Chặn Origin lạ cho request ghi** (`app.js`): POST/PUT/PATCH/DELETE có header `Origin` không thuộc `CORS_NGUON` → 403 trước khi vào route (kể cả `localhost:5174`, `null`); không có `Origin` (Postman, test) hoặc GET/HEAD/OPTIONS thì không bị lớp này chặn.
- **Hạn chế đã biết – dung sai 1 giây thu hồi token** (`xacThucService.js:77`): áp dụng cho cả mốc khóa tài khoản và reset/đổi mật khẩu; token cấp trong ~1 giây trước mốc vẫn dùng được. Test chờ 2,5 giây.
- **Test quản trị tài khoản (2026-11-01):** `nguoiDung.test.js` chụp `nguoidung` (mật khẩu, trạng thái, `lanDangNhapCuoi`), `nguoidungvaitro`, `nhanvien.trangThaiLamViec` ở `beforeEach`; `afterEach` xóa nhật ký/người dùng mới, khôi phục và đặt lại `AUTO_INCREMENT`. Nhánh 409 "Admin hoạt động cuối cùng" (khóa và gỡ vai trò) không chạm được qua API vì người gọi luôn là một Admin hoạt động khác → test giả lập `demAdminHoatDong = 1` bằng `jest.spyOn` (lớp phòng thủ cho tranh chấp đồng thời).
- CORS chỉ mở cho `CORS_NGUON` (mặc định `http://localhost:5173`, `credentials: true`). Server từ chối khởi động nếu `JWT_BI_MAT` là giá trị mẫu hoặc < 32 ký tự.
- **Quy ước nhật ký khóa/mở tài khoản:** `KHOA_TAI_KHOAN`, `MO_KHOA_TAI_KHOAN` (module Admin), `KHOA_TAI_KHOAN_NGHI_VIEC`, `MO_KHOA_TAI_KHOAN_NGHI_VIEC` ghi với `nguoiDungId` = người BỊ tác động (giống `RESET_MAT_KHAU_TAM`). Hai hành động KHOA là mốc thu hồi token trong `layMocMatKhau`.
- **Trạng thái dùng chung** ở `backend/src/utils/trangThai.js` (phòng ban/chức danh: `DANG_HOAT_DONG`/`NGUNG_HOAT_DONG`; vị trí: `DANG_AP_DUNG`/`NGUNG_AP_DUNG`; lao động; tài khoản `DANG_HOAT_DONG`/`KHOA`), khớp `frontend/src/components/ChipTrangThai.jsx`.
- **Tự gán/gỡ `quanLy` khi bổ nhiệm:** ghi `TU_DONG_GAN_QUAN_LY` / `TU_DONG_GO_QUAN_LY` theo người bị tác động; Admin đổi vai trò ghi thêm `DUOC_PHAN_QUYEN` (người bị tác động) bên cạnh `PHAN_QUYEN` (người thực hiện). Chỉ tự gỡ `quanLy` khi hành động vai trò gần nhất là `TU_DONG_GAN_QUAN_LY` (quanLy có từ seed/Admin gán tay được giữ). Admin gỡ `quanLy` của người đang là trưởng bộ phận → 409. Trưởng bộ phận không chuyển được sang `TAM_NGHI`/`DA_NGHI_VIEC` (409). Bổ nhiệm người có tài khoản `KHOA` → 409.
- Thứ tự khóa dòng chưa thống nhất giữa các luồng (phongban → nhanvien ở ngừng phòng ban; nhanvien → chucdanhphongban ở điều chuyển): có thể deadlock, đã tự thử lại 3 lần rồi trả 409, dữ liệu không sai.
- **Test cơ cấu tổ chức (2026-11-01):** `coCauToChuc.test.js` chụp `phongban` (tên, trưởng, cha, trạng thái), `chucdanh`, `chucdanhphongban` (định biên, ghi chú, trạng thái), `nhanvien` (vị trí, trạng thái), `nguoidung.trangThai`, `nguoidungvaitro` ở `beforeAll`; `afterEach` gỡ trưởng/cha của phòng tạm → khôi phục phòng gốc → xóa nhân viên/người dùng/vị trí/chức danh/phòng tạm → `AUTO_INCREMENT = 1` cho 6 bảng. Nhánh "ngừng phòng có trưởng → tự miễn nhiệm" không tới được qua API (trưởng phải thuộc phòng nên phòng luôn còn nhân viên) → test đặt `truongBoPhanId` bằng SQL. Ca song song (ngừng phòng + thêm nhân viên, 3 vòng) chấp nhận một bên 409, chưa ghi nhận trạng thái sai.
- Chạy backend: `cd backend` → `npm test` → `npm run dev` → mở `http://localhost:5000/api/v1/sucKhoe`.
