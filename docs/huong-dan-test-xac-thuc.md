# Hướng dẫn test thủ công - Xác thực & Phân quyền

Tài khoản mẫu (`database/seed.sql`), mật khẩu chung `MatKhau@123`:

| Tài khoản | Vai trò | Nhân viên |
|---|---|---|
| `admin` | Admin + nhanVien | NV0001 Lê Văn Quản |
| `giamdoc` | giamDoc + nhanVien | NV0002 Trần Thị Minh |
| `quanly` | quanLy + nhanVien | NV0003 Nguyễn Văn Hùng |
| `hr` | HR + nhanVien | NV0004 Phạm Thị Lan |
| `nhanvien` | nhanVien | NV0005 Hoàng Văn Nam |
| `nhanvien2` | nhanVien | NV0006 Võ Thị Hoa (dùng cho các test đổi mật khẩu / khóa) |

## 0. Chuẩn bị
1. Bật **MySQL** trong XAMPP (cổng 3307).
2. Terminal 1: `cd backend` → `npm run dev` (http://localhost:5000).
3. Terminal 2: `cd frontend` → `npm run dev` → mở http://localhost:5173.
4. Chạy SQL bằng phpMyAdmin (http://localhost/phpmyadmin, database `quanlydoanhnghiepthongminh`) hoặc:
   `mysql -u root -P 3307 -h 127.0.0.1 quanlydoanhnghiepthongminh`
5. Xem nhật ký sau mỗi bước:
   ```sql
   SELECT id, nguoiDungId, hanhDong, diaChiIP, chiTiet, thoiGianTao
   FROM nhatkyhethong ORDER BY id DESC LIMIT 10;
   ```

---

## Phần A - Test trên giao diện web

### A1. Đăng nhập
| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở http://localhost:5173 khi chưa đăng nhập | Tự chuyển sang `/dangNhap` |
| 2 | Đăng nhập `hr` / `MatKhau@123` | Vào trang Tổng quan, "Xin chào, Phạm Thị Lan", chip "Nhân sự · Nhân viên"; nhật ký có `DANG_NHAP` |
| 3 | Đăng nhập bằng email `hr@smarthrm.local` | Thành công như trên |
| 4 | Sai mật khẩu `hr` / `abc` | Hộp đỏ "Tên đăng nhập hoặc mật khẩu không đúng"; nhật ký `DANG_NHAP_THAT_BAI` |
| 5 | Tên không tồn tại `khongco` / `abc` | Cùng thông báo như #4 (không lộ tài khoản có tồn tại hay không) |
| 6 | Bỏ trống ô | Trình duyệt chặn (required) |
| 7 | Đang đăng nhập, gõ `/dangNhap` lên thanh địa chỉ | Tự quay về `/` |
| 8 | Nhấn F5 ở trang bất kỳ | Vẫn giữ phiên, không nháy form đăng nhập |
| 9 | Mở http://localhost:5173/luong khi chưa đăng nhập, rồi đăng nhập | Sau khi đăng nhập quay lại đúng `/luong` |

### A2. Đăng xuất
| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Bấm avatar → Đăng xuất | Về `/dangNhap`; nhật ký `DANG_XUAT` |
| 2 | Bấm nút Back của trình duyệt | Vẫn bị đẩy về `/dangNhap` |

### A3. Menu & tab theo vai trò
Đăng nhập lần lượt từng tài khoản, kiểm tra thanh icon trái và tab trên thanh tối:

| Module | admin | giamdoc | quanly | hr | nhanvien |
|---|---|---|---|---|---|
| Nhân sự | Hồ sơ của tôi, Hợp đồng, Phòng ban | Hồ sơ, Nhân viên, Hợp đồng, Phòng ban | Hồ sơ, Nhân viên, Hợp đồng*, Phòng ban | Hồ sơ, Nhân viên, Hợp đồng, Phòng ban | Hồ sơ, Hợp đồng, Phòng ban |
| Chấm công | Lịch công, Điều chỉnh | + Bảng công | + Bảng công | + Bảng công | Lịch công, Điều chỉnh |
| Nghỉ phép | Đơn của tôi | Đơn, Duyệt đơn, Lịch nghỉ | Đơn, Duyệt đơn, Lịch nghỉ | Đơn, Lịch nghỉ (không Duyệt) | Đơn của tôi |
| Lương | Phiếu lương | Phiếu, Bảng lương | Phiếu lương | Phiếu, Bảng lương | Phiếu lương |
| Khen thưởng - Kỷ luật | Quyết định | Quyết định, Đề xuất | Quyết định, Đề xuất | Quyết định, Đề xuất | Quyết định |
| Hệ thống | Tài khoản, Nhật ký | Nhật ký | (ẩn) | Tài khoản | (ẩn) |

\* quanly thấy tab Hợp đồng vì có thêm vai trò nhanVien (chỉ xem hợp đồng của mình, backend sẽ lọc).

Kiểm tra gõ thẳng URL (chặn ở route, không chỉ ẩn menu):
| # | Tài khoản | URL | Kết quả |
|---|---|---|---|
| 1 | nhanvien | `/luong/bangLuong` | Về `/` |
| 2 | nhanvien | `/heThong/nhatKy` | Về `/` |
| 3 | hr | `/nghiPhep/duyetDon` | Về `/` |
| 4 | giamdoc | `/heThong` | Tự chuyển `/heThong/nhatKy` |
| 5 | hr | `/heThong` | Tự chuyển `/heThong/taiKhoan` |
| 6 | giamdoc | `/heThong/taiKhoan` | Về `/` |
| 7 | bất kỳ | `/abcxyz` | Trang "Không tìm thấy trang" (vẫn trong layout) |

### A4. Đổi mật khẩu (dùng `nhanvien2`)
| # | Thao tác | Kết quả |
|---|---|---|
| 1 | Avatar → Đổi mật khẩu, nhập mật khẩu hiện tại sai | "Mật khẩu hiện tại không đúng" |
| 2 | Mật khẩu mới và nhập lại khác nhau | "Mật khẩu xác nhận không khớp" (kiểm ở frontend) |
| 3 | Mật khẩu mới `abcdefgh` (không có số) | "Mật khẩu mới phải có cả chữ và số" |
| 4 | Mật khẩu mới `abc1` (ngắn) | Trình duyệt chặn (minLength 8) |
| 5 | Mật khẩu mới trùng mật khẩu cũ `MatKhau@123` | "Mật khẩu mới phải khác mật khẩu hiện tại" |
| 6 | Đổi thành `MatKhau@456` | Về Tổng quan; nhật ký `DOI_MAT_KHAU`; đăng xuất rồi đăng nhập bằng mật khẩu mới được, mật khẩu cũ không được |
| 7 | Nút Hủy | Quay lại trang trước |
| 8 | **Dọn dẹp:** đổi lại về `MatKhau@123` | |

### A5. Phiên ở 2 trình duyệt (thu hồi token)
1. Chrome đăng nhập `nhanvien2`; Edge (hoặc cửa sổ ẩn danh) cũng đăng nhập `nhanvien2`.
2. Chờ vài giây, ở Chrome đổi mật khẩu sang `MatKhau@456`.
3. Ở Edge nhấn F5 → bị đẩy về `/dangNhap` (token cũ bị thu hồi). Chrome vẫn dùng bình thường.
4. Dọn dẹp: đổi lại `MatKhau@123`.

### A6. Mật khẩu tạm (giả lập HR reset, vì API reset chưa làm)
```sql
INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, diaChiIP) VALUES (6, 'RESET_MAT_KHAU_TAM', '127.0.0.1');
```
| # | Thao tác | Kết quả |
|---|---|---|
| 1 | Nếu `nhanvien2` đang đăng nhập: nhấn F5 | Bị đẩy về `/dangNhap` (token cấp trước lúc reset bị thu hồi) |
| 2 | Đăng nhập `nhanvien2` / `MatKhau@123` | Vào thẳng `/doiMatKhau`, hộp vàng báo đang dùng mật khẩu tạm, nhãn "Mật khẩu tạm"; không có layout/menu |
| 3 | Gõ `/` hoặc `/luong` lên thanh địa chỉ | Vẫn bị giữ ở `/doiMatKhau` |
| 4 | Bấm "Đăng xuất" trên form | Về `/dangNhap` |
| 5 | Đăng nhập lại, đổi sang `MatKhau@456` | Vào Tổng quan bình thường |
| 6 | Dọn dẹp: đổi lại `MatKhau@123` | |

Mật khẩu tạm hết hạn (>24 giờ):
```sql
INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, diaChiIP, thoiGianTao)
VALUES (6, 'RESET_MAT_KHAU_TAM', '127.0.0.1', NOW() - INTERVAL 25 HOUR);
```
→ Đăng nhập `nhanvien2`: "Mật khẩu tạm đã hết hạn (quá 24 giờ)..."; nhật ký `DANG_NHAP_MAT_KHAU_TAM_HET_HAN`.

**Dọn dẹp A6** (chỉ khi chưa đổi mật khẩu thành công; nếu đã đổi thì bản ghi `DOI_MAT_KHAU` mới hơn đã gỡ cờ):
```sql
DELETE FROM nhatkyhethong WHERE nguoiDungId = 6 AND hanhDong = 'RESET_MAT_KHAU_TAM';
```

### A7. Tài khoản bị khóa
```sql
UPDATE nguoidung SET trangThai = 'BI_KHOA' WHERE id = 6;
```
| # | Thao tác | Kết quả |
|---|---|---|
| 1 | `nhanvien2` đang đăng nhập → nhấn F5 | Bị đẩy về `/dangNhap` ngay (không chờ hết hạn token) |
| 2 | Đăng nhập `nhanvien2` đúng mật khẩu | "Tài khoản đã bị khóa..."; nhật ký `DANG_NHAP_BI_KHOA` |
| 3 | Đăng nhập sai mật khẩu | "Tên đăng nhập hoặc mật khẩu không đúng" (không lộ trạng thái khóa) |

Dọn dẹp: `UPDATE nguoidung SET trangThai = 'DANG_HOAT_DONG' WHERE id = 6;`

### A8. Gỡ vai trò có hiệu lực ngay
1. Đăng nhập `hr`, mở module Lương → thấy tab Bảng lương.
2. `DELETE FROM nguoidungvaitro WHERE nguoiDungId = 4 AND vaiTroId = 4;`
3. Nhấn F5 → tab Bảng lương, Hệ thống biến mất (vai trò đọc lại từ CSDL).
4. Dọn dẹp: `INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES (4, 4);` rồi F5.

### A9. Mất kết nối
| # | Thao tác | Kết quả |
|---|---|---|
| 1 | Tắt backend (Ctrl+C), đăng nhập | "Không kết nối được máy chủ" |
| 2 | Bật backend, tắt MySQL, đăng nhập | "Không kết nối được cơ sở dữ liệu, vui lòng thử lại sau" (503); thẻ "Cơ sở dữ liệu" ở Tổng quan báo "Mất kết nối" |

### A10. Chống dò mật khẩu
1. Đăng nhập sai `hr` 10 lần liên tiếp → lần thứ 11: "Bạn thử sai quá nhiều lần, vui lòng thử lại sau 15 phút".
2. Trong lúc đó đăng nhập `giamdoc` đúng mật khẩu → vẫn được (đếm theo IP + tài khoản).
3. Gỡ khóa: khởi động lại backend (bộ đếm lưu trong RAM).

---

## Phần B - Test API trực tiếp (curl trong Git Bash, hoặc Postman)

```bash
API=http://localhost:5000/api/v1
# Lấy token và lưu vào biến
TOKEN=$(curl -s -X POST $API/xacThuc/dangNhap -H "Content-Type: application/json" \
  -d '{"tenDangNhap":"nhanvien2","matKhau":"MatKhau@123"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).data.token")
```
Mọi phản hồi có dạng `{ success, code, message, data }`; lỗi luôn có `data: null`.

### B1. `POST /xacThuc/dangNhap`
| # | Body | Mong đợi |
|---|---|---|
| 1 | `{"tenDangNhap":"hr","matKhau":"MatKhau@123"}` | 200, `data.token`, `data.nguoiDung` có `vaiTro: ["HR","nhanVien"]`, `batBuocDoiMatKhau: false`, **không có `matKhauMaHoa`** |
| 2 | `{"tenDangNhap":"hr@smarthrm.local","matKhau":"MatKhau@123"}` | 200 |
| 3 | `{"tenDangNhap":"  hr  ","matKhau":"MatKhau@123"}` | 200 (tự trim) |
| 4 | `{"tenDangNhap":"hr","matKhau":"sai"}` | 401 "Tên đăng nhập hoặc mật khẩu không đúng" |
| 5 | `{"tenDangNhap":"khongco","matKhau":"x"}` | 401, cùng thông báo #4 |
| 6 | `{"matKhau":"x"}` | 400 "Tên đăng nhập không được để trống" |
| 7 | `{"tenDangNhap":"hr"}` | 400 "Mật khẩu không được để trống" |
| 8 | `{"tenDangNhap":"   ","matKhau":"x"}` | 400 |
| 9 | `{"tenDangNhap":123,"matKhau":"x"}` | 400 "... phải là chuỗi ký tự" |
| 10 | `matKhau` dài hơn 72 byte (vd. 30 chữ "ệ") | 400 "... quá dài (tối đa 72 byte)" |
| 11 | Body `{sai` (JSON hỏng) | 400 "Dữ liệu JSON gửi lên không hợp lệ" |
| 12 | Tài khoản bị khóa (xem A7) | 403 |
| 13 | Mật khẩu tạm còn hạn (A6) | 200, `batBuocDoiMatKhau: true` |
| 14 | Mật khẩu tạm quá 24h (A6) | 401 |
| 15 | Sai lần thứ 11 trong 15 phút | 429 |

### B2. `GET /xacThuc/toi`
| # | Header | Mong đợi |
|---|---|---|
| 1 | `Authorization: Bearer $TOKEN` | 200, thông tin + `vaiTro` + `lanDangNhapCuoi`, không có `matKhauMaHoa` |
| 2 | Không có header | 401 "Bạn chưa đăng nhập" |
| 3 | `Authorization: $TOKEN` (thiếu chữ Bearer) | 401 "Bạn chưa đăng nhập" |
| 4 | `Bearer abc` | 401 "Token không hợp lệ" |
| 5 | Token sửa 1 ký tự ở phần chữ ký | 401 "Token không hợp lệ" |
| 6 | Token hết hạn (đặt `JWT_HET_HAN=5s` trong `.env`, khởi động lại, chờ 6 giây) | 401 "Phiên đăng nhập đã hết hạn..." |
| 7 | Token của tài khoản vừa bị khóa | 401 "Tài khoản đã bị khóa hoặc không còn tồn tại" |
| 8 | Token cấp trước lần đổi/reset mật khẩu | 401 "Mật khẩu đã thay đổi, vui lòng đăng nhập lại" |
| 9 | Token đang ở trạng thái mật khẩu tạm | 200, `batBuocDoiMatKhau: true` (route này vẫn cho phép) |

```bash
curl -s $API/xacThuc/toi -H "Authorization: Bearer $TOKEN"
```

### B3. `POST /xacThuc/doiMatKhau` (header `Authorization: Bearer $TOKEN`)
| # | Body | Mong đợi |
|---|---|---|
| 1 | `{"matKhauCu":"MatKhau@123","matKhauMoi":"MatKhau@456"}` | 200, `data.token` mới; nhật ký `DOI_MAT_KHAU` |
| 2 | Gọi `/toi` bằng token cũ (sau #1, chờ >2 giây) | 401 |
| 3 | Gọi `/toi` bằng token mới | 200 |
| 4 | `{"matKhauCu":"sai1234a","matKhauMoi":"MatKhau@789"}` | 400 "Mật khẩu hiện tại không đúng" |
| 5 | `matKhauMoi` = `matKhauCu` | 400 "...phải khác mật khẩu hiện tại" |
| 6 | `matKhauMoi: "abc12"` | 400 "...ít nhất 8 ký tự" |
| 7 | `matKhauMoi: "abcdefgh"` | 400 "...cả chữ và số" |
| 8 | `matKhauMoi: "12345678"` | 400 "...cả chữ và số" |
| 9 | Thiếu `matKhauCu` hoặc `matKhauMoi` | 400 |
| 10 | Không token | 401 |
| 11 | Đang mật khẩu tạm (A6) | 200, sau đó `batBuocDoiMatKhau: false` |
| 12 | Đổi sai `matKhauCu` 10 lần → lần 11 | 429 |
| 13 | **Dọn dẹp:** đổi lại `MatKhau@123` | |

### B4. `POST /xacThuc/dangXuat`
| # | Header | Mong đợi |
|---|---|---|
| 1 | Token hợp lệ | 200 "Đăng xuất thành công"; nhật ký `DANG_XUAT` |
| 2 | Không token | 401 |
| 3 | Token mật khẩu tạm | 200 (vẫn cho đăng xuất) |

Lưu ý: JWT là stateless, sau khi đăng xuất token vẫn dùng được tới khi hết hạn; frontend đã xóa token khỏi trình duyệt.

### B5. Chặn khi đang dùng mật khẩu tạm
Route bảo vệ bằng `xacThucJwt` (mọi module nghiệp vụ sau này) trả **403 "Bạn cần đổi mật khẩu tạm trước khi tiếp tục"**. Hiện chưa có route nghiệp vụ nào; trường hợp này và `phanQuyen` 5 vai trò đã được kiểm bằng test tự động (`backend/tests/xacThuc.test.js`).

### B6. Khác
| # | Request | Mong đợi |
|---|---|---|
| 1 | `GET /api/v1/sucKhoe` | 200, `csdl: "KET_NOI"` |
| 2 | `GET /api/v1/xacThuc/dangNhap` (sai method) | 404 JSON chuẩn |
| 3 | `GET /api/v1/khongTonTai` | 404 JSON chuẩn |

## Test tự động
`cd backend && npm test` → 69 test (3 sucKhoe + 66 xác thực/phân quyền), tự dọn dữ liệu sau khi chạy.
