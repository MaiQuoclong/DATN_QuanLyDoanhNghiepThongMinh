# Thiết kế Đề xuất 6 — `feature/dong-bo-chi-so-tong-quan`

Duyệt: 2026-11-25. Schema giữ nguyên 25 bảng (chỉ đọc).

## Mục tiêu
- (a) Commit bản cập nhật `docs/progress.md` sau phát hành PR #45.
- (b) Thẻ "việc cần xử lý" trên trang Tổng quan và chuông dùng **một nguồn duy nhất** `GET /api/v1/viecCanChuY`, một lần gọi, số khớp tuyệt đối cho 5 vai trò.

## Hiện trạng lệch (TrangTongQuan.jsx so với viecCanChuYService.js)
| Thẻ | Tổng quan | Chuông | Lệch |
|---|---|---|---|
| Đơn nghỉ phép chờ duyệt | `tongSo` mọi đơn CHO_DUYET trong phạm vi | chỉ đơn `duocDuyet` | quanLy, giamDoc |
| Điều chỉnh công chờ duyệt | `tongSo` không lọc | bỏ yêu cầu của chính mình | quanLy, HR, giamDoc |
| Hợp đồng sắp/quá hạn 30 ngày | `items.length` | HR thuần bỏ hợp đồng của mình | HR |
| Đề xuất KTKL | HR: CHO_DUYET kể cả về mình; giamDoc: mọi CHO_KY | HR bỏ đề xuất về mình; giamDoc CHO_KY có `nguoiXuLyId` = mình | HR, giamDoc, người kiêm giamDoc+HR |

## Phương án chọn (B)
- Backend: response `/viecCanChuY` bổ sung (tương thích ngược, giữ `tongSo`, `items`, `nguonLoi`):
  ```
  theoLoai: { <loai>: số | null }   // mọi nguồn áp dụng cho vai trò; 0 nếu không có việc; null nếu nguồn lỗi
  vuotTran: [<loai>, ...]           // nguồn đếm qua danh sách vượt 1000
  ```
- Frontend: context `NguCanhViecCanChuY` (provider trong `BoCucChinh`, bọc hook `useViecCanChuY`); chuông và Tổng quan cùng đọc `useViecCanChuYChung()`. Thẻ chỉ hiện khi loại có trong `theoLoai` (backend quyết định quyền); `null` → "—", có trong `vuotTran` → "1000+".

## Quyết định của người dùng
1. Thẻ quanLy "Đề xuất KTKL đã gửi chờ xử lý": **giữ là thẻ thông tin**, ghi rõ không tính vào chuông.
2. Trần 1000: **COUNT** bằng SQL cho điều chỉnh công (`chamCongRepository.demYeuCau`, lọc `boQuaNhanVienId`) và KTKL (`khenThuongKyLuatRepository.demDeXuat`, `boQuaNhanVienId` trong `dieuKienDeXuat`); nghỉ phép và KPI nghiệm thu (phụ thuộc chuỗi phòng ban) giữ đếm qua danh sách, cờ `vuotTran` khi `phanTrang.tongSo > 1000`.
3. **Thêm thẻ "KPI cần nghiệm thu"** cho quanLy/giamDoc trên Tổng quan.

## File sửa/thêm
- Backend: `services/viecCanChuYService.js`, `services/chamCongService.js` (`demYeuCauChoDuyet`), `repositories/chamCongRepository.js` (tách WHERE dùng chung + `demYeuCau`), `services/khenThuongKyLuatService.js` (`demDeXuat`), `repositories/khenThuongKyLuatRepository.js`. Route/controller không đổi.
- Frontend: mới `context/NguCanhViecCanChuY.jsx`, `utils/viecCanChuY.js` (`layHienThiSoViec`); sửa `layouts/BoCucChinh.jsx`, `components/thanhDieuHuong/ChuongViecCanChuY.jsx`, `pages/TrangTongQuan.jsx` (bỏ lời gọi chỉ để đếm; khung "Đơn từ đang chờ duyệt" lấy `kichThuoc` 20 và lọc `duocDuyet`; giamDoc+HR thấy 2 thẻ KTKL riêng).
- Tài liệu: `docs/phan-quyen.md` mục 10, `docs/progress.md` (bỏ hạn chế Đề xuất 2).

## RBAC
Giữ `apDung` của từng nguồn; hàm COUNT bắt buộc nhận phạm vi từ `layPhamVi` (quanLy gồm phòng con) như bản danh sách. Thao tác chỉ đọc: không transaction, không ghi nhật ký.

## Test (`backend/tests/viecCanChuY.test.js`, tự tạo/tự dọn)
- Khóa `theoLoai` theo vai trò: admin rỗng; nhanvien chỉ `KPI_CAN_TU_CHAM`; quanly nghỉ phép + điều chỉnh công + KPI x2; hr điều chỉnh công + đề xuất chờ xử lý + KPI + hợp đồng; giamdoc đủ trừ `DE_XUAT_CHO_XU_LY`.
- Loại có 0 vẫn có trong `theoLoai`, không có trong `items`; nguồn lỗi → `null` + `nguonLoi`.
- COUNT = cách đếm danh sách cũ (bỏ của mình; quanly2 không thấy phòng khác; giamDoc khác không thấy CHO_KY không trình cho mình).
- `vuotTran` (mock `tongSo: 1001`); bất biến `tongSo === Σ items.soLuong`.
- Hồi quy `chamCong`, `khenThuongKyLuat`; lint, `vite build`.

## Kịch bản test tay
`npm run khoiTaoCsdl`, mật khẩu seed `MatKhau@123`. Badge seed: giamdoc 14, quanly 4, quanly2 3, hr 8, hr2 6, admin 1, nhanvien2 1, nhanvien 0. Kiểm: thẻ khớp từng dòng chuông; duyệt 1 đơn → thẻ và badge cùng giảm; Network chỉ 1 request `/viecCanChuY`; tắt MariaDB → "—", trang không trắng.

## Rủi ro
- Tách WHERE repository có thể đổi danh sách cũ → chạy test hồi quy.
- Sau thao tác duyệt, số cập nhật trễ ~1s (vẫn khớp nhau); gọi `taiLai()` sau duyệt để Đề xuất 7.
