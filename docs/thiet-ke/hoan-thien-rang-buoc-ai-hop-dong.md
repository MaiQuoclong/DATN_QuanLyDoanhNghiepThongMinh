# Thiết kế: Hoàn thiện ràng buộc AI Text-to-SQL & hợp đồng – lương (`feature/hoan-thien-rang-buoc-ai-hop-dong`)

Người dùng duyệt 2026-11-25. Không đổi schema.

## Phương án đã chốt
1. (4a) Che cột ID người ngay trong truy vấn con thay bảng (không viết lại từng tham chiếu cột, không từ chối câu nào).
2. (4b) Đổi hợp đồng: chỉ **cảnh báo** (`data.canhBao` + ghép vào `message`), không tự tính lại phiếu, không chặn.
   **Chặn ở bước gửi duyệt**: bảng nháp cũ hơn thay đổi hợp đồng → 409, bấm "Tính lại" rồi mới gửi được.
3. Cảnh báo chính xác: tháng giao khoảng ảnh hưởng **và** nhân viên có phiếu trong bảng hoặc nay đủ điều kiện tính lương.
4. Bảng `CHO_DUYET` / `DA_DUYET` bị ảnh hưởng: thêm câu cảnh báo (chờ duyệt → giám đốc trả lại để tính lại; đã duyệt → điều chỉnh kỳ sau).

## (4a) ai-service
- `moTaSchema.COT_THAM_CHIEU_NGUOI`: `nguoiDuyetId`, `nguoiDanhGiaId`, `nguoiDeXuatId`, `nguoiXuLyId`, `nguoiKyDuyetId`, `truongBoPhanId`, `nguoiLapId`, `nguoiThucHienId`, `nguoiTaiLenId`.
- `kiemTraSql._danhSachCotDaChe`: với `quanLy`, truy vấn con thay bảng liệt kê cột theo `BANG`; cột người → `CASE WHEN c IN (<nhân viên trong phạm vi>) THEN c ELSE NULL END AS c`.
  Áp cho bảng có `nhanVienId` (đơn nghỉ, điều chỉnh công, phiếu KPI, quyết định/đề xuất KTKL) và `phongban` (vẫn trả mọi phòng, chỉ che `truongBoPhanId`). Bảng không có cột người giữ `SELECT *`.
- `bangtonghopluong`, `lichsuhopdong` (bị cấm với quanLy) và `tailieuquyche` (bảng hệ thống) không cần che.
- `giamDoc`/`HR` (toàn công ty) không đổi.

## (4b) backend
- `luongRepository.khoaHopDongTrongThang`: `SELECT ... FROM hopdonglaodong ... LOCK IN SHARE MODE` các hợp đồng giao với tháng; gọi **trước mọi câu đọc thường** của transaction lập bảng / tính lại (REPEATABLE READ chốt snapshot ở câu đọc thường đầu tiên) và trong gửi duyệt.
- Khoảng ảnh hưởng (`hopDongService.khoangAnhHuong`, khớp `luongRepository.layThayDoiHopDongSauMoc`):

| Thao tác | Tháng ảnh hưởng |
|---|---|
| Tạo mới | cả thời hạn hợp đồng |
| Điều chỉnh lương/phụ cấp (chỉ đổi file: không) | cả thời hạn (schema không có ngày hiệu lực phụ lục) |
| Gia hạn | các tháng sau tháng chứa ngày kết thúc cũ → ngày kết thúc mới |
| Chấm dứt | các tháng sau tháng chứa ngày chấm dứt → ngày kết thúc cũ |

- `luongService.canhBaoBangLuongAnhHuong`: gọi cuối transaction hợp đồng (chỉ đọc, không khóa bảng lương).
- `luongService.chanBangCuHonHopDong` (trong `guiDuyet`): mốc lần tính = nhật ký `LAP_BANG_LUONG`/`TINH_LAI_BANG_LUONG` mới nhất của bảng (không có → `ngayTao` bảng); thay đổi hợp đồng ghi sau mốc (quyết định bằng id nhật ký của thao tác hợp đồng > id nhật ký lần tính; cho phép lệch 1 giây giữa lịch sử và nhật ký) và ảnh hưởng tháng → 409 nêu mã nhân viên.
- Controller hợp đồng: `message = "<thành công>. <canhBao>"`.
- Frontend: `HopThoaiChiTietHopDong` hiện `thongBao canhBao` sau gia hạn/điều chỉnh/chấm dứt; lập hợp đồng truyền `canhBaoBanDau` khi mở chi tiết (`TrangHopDong`, `TrangChiTietNhanVien`). Lỗi 409 gửi duyệt hiện qua thông báo lỗi sẵn có của trang Bảng lương.

## Test
- pytest `tests/test_textToSql.py`: che cột theo 7 cặp (bảng, cột), toàn công ty không che, bí danh/JOIN/WHERE/GROUP BY, bảng danh mục khác không bọc, cột `BANG` khớp `schema.sql`.
- Jest `tests/dongBoHopDongLuong.test.js`: cảnh báo theo trạng thái bảng, chỉ đổi file, chấm dứt (tháng chứa ngày chấm dứt không cảnh báo), lập lùi ngày, nhân viên không liên quan, gia hạn; chặn gửi duyệt + mở lại sau tính lại; đổi trước lần tính cùng giây không chặn; gửi duyệt có khóa đọc.

## Hạn chế đã biết
- (4a) quanLy thấy người duyệt/đánh giá ngoài phòng (HR, giám đốc) là trống; đếm số dòng NULL vẫn suy ra "người ngoài phạm vi" (không lộ là ai).
- (4b) Khóa đọc theo khoảng ngày có thể khóa phần lớn bảng hợp đồng trong lúc lập lương: HR sửa hợp đồng phải chờ (quá `innodb_lock_wait_timeout` → 409 "thử lại" của middleware lỗi sẵn có). Lập hợp đồng mới cùng lúc lập lương có thể deadlock (khóa khoảng): `chayTransaction` tự chạy lại khi `ER_LOCK_DEADLOCK`, quá số lần → 409.
- Test chèn thẳng bảng lương các tháng 2019 / tương lai: nếu seed sau này thêm bảng các tháng đó sẽ trùng UNIQUE (thang, nam).
- (4b) Điều chỉnh lương áp ngược cả kỳ hợp đồng nên cảnh báo cả các bảng đã duyệt trong thời hạn hợp đồng.
