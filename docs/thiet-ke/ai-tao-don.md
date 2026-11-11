# Thiết kế 5.5 – AI tạo đơn qua chat (Function Calling)

Nhánh `feature/ai-tao-don` (từ `develop`). Không đổi `database/schema.sql`. Người dùng duyệt 2026-11-11.

## Quyết định đã chốt
| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Nơi lưu bản nháp | **SQLite ai-service** (bảng `banNhapDon`), bền khi restart, vẽ lại thẻ trong lịch sử, chống tạo trùng |
| Q2 | Phân loại ý định | **Lọc từ khóa → LLM có tool**; không khớp từ khóa đi thẳng RAG |
| Q3 | Tool `xemQuyPhep` | **Có** (chỉ đọc, `nghiPhepService.layQuyCuaToi`) |
| Q4 | Phạm vi | **Nghỉ phép + điều chỉnh chấm công** |
| Q5 | TTL bản nháp | 30 phút (mặc định khuyến nghị) |

## 1. Mục tiêu và phạm vi
- Chat để tạo **đơn nghỉ phép** (`dondexuatnghiphep`) hoặc **yêu cầu điều chỉnh chấm công** (`yeucaudieuchinhchamcong`) cho **chính mình**. Bản ghi tạo ra luôn ở `CHO_DUYET`; AI không duyệt.
- Cả 5 vai trò, với điều kiện tài khoản có `nhanVienId` (không có thì `canHoSo` trả lỗi sẵn có).
- Ngoài phạm vi: hủy/duyệt đơn qua chat, tạo hộ người khác, Text-to-SQL (5.6).

## 2. Kiến trúc
ai-service **chỉ phân loại ý định và trích tham số** bằng tool use, trả `{yDinh, thamSo, thieu, cauHoiLai}`, **không ghi MySQL**. Express kiểm tra sơ bộ, lưu bản nháp; người dùng bấm Xác nhận thì Express gọi service nghiệp vụ sẵn có (`nghiPhepService.taoDon(nguoiDung, thamSo, 'AI_CHAT')`, `chamCongService.taoYeuCau`). Một nguồn nghiệp vụ: quỹ phép, chồng lấn, ngày lễ, tháng đã chốt, transaction, mã DNP. LLM không bao giờ thấy hay đặt `nhanVienId`/`trangThai`.

Đã loại: ai-service tự INSERT bằng tài khoản DB có quyền ghi (viết lại nghiệp vụ); ai-service gọi ngược REST Express bằng JWT (gọi vòng, khó timeout/idempotency).

Luồng: UI → `POST /api/v1/troLyAi/hoiDap` (giữ endpoint) → Express gửi `ngayHienTai`, `thuHienTai`, `muiGio`, loại phép `DANG_AP_DUNG`, `thamSoDangCo` (bản nháp đang mở), `hanChot` → ai-service `POST /noiBo/troLy/xuLy`:
- Không khớp từ khóa, hoặc LLM không gọi tool tạo đơn → luồng RAG hiện có (`HOI_QUY_CHE`).
- Tạo đơn còn thiếu tham số → `HOI_LAI` kèm `cauHoiLai`.
- Đủ tham số → Express lưu bản nháp, trả `XEM_TRUOC_DON`. Xác nhận → service nghiệp vụ → MySQL.

Lỗi:
- ai-service sập/timeout → 503 thân thiện (`aiClientService` sẵn có).
- `LoiLlm`/thiếu khóa → `DU_PHONG` + gợi ý "tạo tại trang Nghỉ phép / Điều chỉnh công" (UI có link), không 500.
- Lỗi nghiệp vụ khi xác nhận (400/409 từ service) → hiện nguyên message trên thẻ, bản nháp `LOI`, cho sửa/tạo lại.

## 3. Luồng hội thoại
1. **Từ khóa** (chuẩn hóa không dấu, chữ thường): "xin nghi", "nghi phep", "nghi om", "quen cham", "quen check", "dieu chinh cong", "check in/out", "con may ngay phep", "quy phep"... Khớp mới gọi LLM có tool.
2. **Thiếu tham số:** tool có `thieu: string[]`; ngữ cảnh lấy 6 tin gần nhất (`layTinNhan`) + `thamSoDangCo` để gộp với lượt trước.
3. **Ngày tương đối:** Express gửi `ngayHienTai` (YYYY-MM-DD theo `ngayHomNay()`, giờ VN) và `thuHienTai`. LLM phải trả ngày ISO tuyệt đối; Python kiểm `date.fromisoformat` + khoảng ±1 năm; Express kiểm lại bằng validator của service. "Tuần sau" = tuần bắt đầu từ thứ Hai kế tiếp (ghi rõ trong prompt). Múi giờ cố định `Asia/Ho_Chi_Minh`. Thẻ xem trước luôn hiện **thứ + ngày** ("Thứ Sáu, 20/11/2026").
4. **Xác nhận bắt buộc:** không tạo đơn ngay ở lượt chat. Thẻ có nút Xác nhận / Hủy / Sửa trong form (mở form thường điền sẵn).
5. **Idempotency:** bản nháp `id` UUID; xác nhận chuyển nguyên tử `CHO_XAC_NHAN → DANG_TAO` (UPDATE … WHERE trangThai='CHO_XAC_NHAN', kiểm số dòng). Bấm lần 2 → 409 "Đơn này đã được tạo" kèm mã đơn. Thành công → `DA_TAO` + `ketQua {loai, id, maDon}`; lỗi nghiệp vụ → `LOI`; kẹt `DANG_TAO` quá 2 phút coi là `LOI`. (Trạng thái nội bộ SQLite, không phải giá trị MySQL.)
6. TTL 30 phút; quá hạn → 410 "Bản nháp đã hết hạn, vui lòng yêu cầu lại". Mỗi phiên tối đa 1 bản nháp `CHO_XAC_NHAN`; bản mới thay bản cũ (cũ → `HUY`).

## 4. Tool (LLM chỉ được khai báo các trường dưới; không có `nhanVienId`, `trangThai`, `nguoiDuyetId`, `phuongThucTao`)
- `taoDonNghiPhep { maLoaiNghiPhep: enum(mã loại DANG_AP_DUNG do Express gửi), ngayBatDau: date, ngayKetThuc: date, nuaNgay: boolean, lyDo: string(5-1000), thieu: string[] }` — Express ánh xạ `maLoai → loaiNghiPhepId`; mã lạ → 400.
- `taoYeuCauDieuChinhCong { ngayCanDieuChinh: date, gioVaoDeXuat?: "HH:mm", gioRaDeXuat?: "HH:mm", lyDoGiaiTrinh: string(5-1000), thieu: string[] }`
- `xemQuyPhep { nam?: int }` — chỉ đọc, Express trả bằng `nghiPhepService.layQuyCuaToi`, không cần xác nhận.

`tool_choice: auto`. Thêm `goiLlmVoiCongCu(heThong, tinNhan, congCu, thoiGianCho)` vào `llm/claudeClient.py` (tái dùng `_layClient`, quy lỗi `LoiLlm`, `max_retries=0`); trả khối `tool_use` đầu tiên hoặc `None`. Tham số lọc theo danh sách trắng trường của tool.

## 5. API
| Route | Method | Vai trò | Body | Mã |
|---|---|---|---|---|
| `/api/v1/troLyAi/hoiDap` (mở rộng) | POST | TAT_CA, 20/phút sẵn có | `{phienId?, cauHoi}` | 200; `data` thêm `loaiPhanHoi: TRA_LOI \| HOI_LAI \| XEM_TRUOC_DON \| QUY_PHEP`, `banNhap?` |
| `/api/v1/troLyAi/banNhap/:id/xacNhan` | POST | TAT_CA, 10/phút/người | – | 201; 404 (không phải của mình); 409 đã tạo/đang tạo; 410 hết hạn; 400/409 nghiệp vụ |
| `/api/v1/troLyAi/banNhap/:id/huy` | POST | TAT_CA | – | 200; 404; 409 nếu đã tạo |

Nội bộ ai-service (`routerNoiBo`, `X-Khoa-Noi-Bo`): `POST /noiBo/troLy/xuLy`; `POST /noiBo/banNhap`; `GET /noiBo/banNhap/{id}`; `POST /noiBo/banNhap/{id}/chuyenTrangThai {tu, sang, ketQua?}`.

**SQLite (`lichSu/khoLichSu.py`):**
- Bảng `banNhapDon(id TEXT PK, phienId, dauPhien, nguoiDungId, loai, thamSoJson, trangThai, ketQuaJson, hetHan, thoiGian)`. Mọi truy vấn lọc `nguoiDungId` + `dauPhien` do Express gửi.
- `tinNhan` thêm cột `duLieuJson` (`ALTER TABLE ADD COLUMN` có kiểm tra tồn tại); tin trợ lý mang `{loaiPhanHoi, banNhapId}`. `GET .../tinNhan` gắn trạng thái bản nháp mới nhất ("Đã tạo DNP2026-0012 – Chờ duyệt" / "Đã hủy"). Xác nhận xong Express ghi thêm tin hệ thống vào phiên.

**`nhatkyhethong`:** ghi `AI_TAO_DON` (loại + mã đơn) qua `ghiNhatKy`. Lý do: `yeucaudieuchinhchamcong` không có cột nguồn tạo → nhật ký là cách duy nhất biết đơn do AI tạo; đơn nghỉ phép có thêm `phuongThucTao='AI_CHAT'`.

## 6. Tái dùng
- `nghiPhepService.taoDon(nguoiDung, body, 'AI_CHAT')`, `layQuyCuaToi`, `layDanhSachLoai({trangThai:'DANG_AP_DUNG'})`.
- `chamCongService.taoYeuCau` — **lưu ý:** kiểm tra định dạng `ngayCanDieuChinh`, giờ, độ dài `lyDoGiaiTrinh` đang nằm ở `kiemTraDuLieu` trong `routes/chamCongRoutes.js`, gọi thẳng service sẽ bỏ qua. Commit 1 đưa phần kiểm tra vào service (hoặc export luật dùng chung) để form và AI cùng được kiểm.
- `troLyAiService` (`layPhienCuaMinh`, `layDauPhien`, `hanChot`, dọn phiên mới khi lỗi) — mở rộng `hoiDap`.
- `aiClientService.goiAiService`, mẫu `rateLimit`/`TAT_CA` ở `troLyAiRoutes.js`.
- ai-service: `claudeClient.py`, `rag/hoiDap.py` (`hanChot`, `DU_PHONG`), `lichSu/khoLichSu.py`, `main.py`.
- Frontend: `components/troLyAi/*`, `hooks/useTroLyAi.js`, form tạo đơn ở trang Nghỉ phép / Điều chỉnh công (nhận state điền sẵn).

## 7. CSDL
- Ghi qua service: `dondexuatnghiphep` (`phuongThucTao='AI_CHAT'`, `CHO_DUYET`), `yeucaudieuchinhchamcong` (`CHO_DUYET`); transaction sẵn có trong service.
- Đọc: `loainghiphep`, `quyngayphep`, `banghichamcong`, `phientrochuyenai`. Nhật ký `AI_TAO_DON`.
- Schema MySQL không đổi; SQLite thêm `banNhapDon` + cột `duLieuJson`.

## 8. Bảo mật
- Chủ thể chỉ lấy từ JWT (`req.nguoiDung`); tham số LLM lọc danh sách trắng; service tự gán `nhanVienId` và `CHO_DUYET`.
- Prompt injection ("tạo đơn cho anh Nam", "đặt DA_DUYET"): tool không có trường chỉ định người/trạng thái; prompt dặn từ chối; người dùng vẫn phải bấm xác nhận; nội dung tài liệu RAG không đưa vào luồng tool.
- Không có tool hủy/duyệt. Đoán UUID bản nháp người khác → 404.
- Giới hạn: `hoiDap` 20/phút, `xacNhan` 10/phút.
- `lyDo` từ LLM hiện nguyên văn để người dùng sửa; React tự escape.

## 9. UI
- `components/troLyAi/TheXemTruocDon.jsx`: loại đơn, ngày kèm thứ, số ngày dự kiến, quỹ còn lại, lý do; Xác nhận / Hủy / Sửa trong form; khóa nút khi đang gửi; sau khi tạo hiện mã đơn + link "Xem đơn của tôi".
- `components/troLyAi/TheQuyPhep.jsx`.
- `hooks/useTroLyAi.js`: `xacNhanBanNhap`, `huyBanNhap`, render theo `loaiPhanHoi`.
- `TrangTroLyAi.jsx`: gợi ý "Xin nghỉ phép năm thứ 6 tuần sau", "Hôm qua tôi quên check-out lúc 17:30", "Tôi còn mấy ngày phép?".
- Trang Nghỉ phép / Điều chỉnh công: nhận state điền sẵn.

## 10. Seed
- 5 tài khoản demo có `nhanVienId`, quỹ phép năm hiện tại còn ngày, ít nhất 1 ngày quên check-out tháng hiện tại (chưa chốt).
- 1 đơn mẫu `phuongThucTao='AI_CHAT'` `CHO_DUYET` cho `nhanVien` + 1 bản ghi `nhatkyhethong` `AI_TAO_DON`. Không seed bản nháp (SQLite).

## 11. Test
**Jest** (mock `goiAiService`, tự tạo/dọn dữ liệu): `hoiDap` trả `XEM_TRUOC_DON`/`HOI_LAI`/`TRA_LOI`/`QUY_PHEP`; tham số giả `nhanVienId` người khác + `trangThai:'DA_DUYET'` → đơn của mình, `CHO_DUYET`; `maLoai` lạ 400; xác nhận 201 + `phuongThucTao='AI_CHAT'`; xác nhận song song → đúng 1 bản ghi, còn lại 409; bản nháp người khác 404; hết hạn 410; lỗi nghiệp vụ (vượt quỹ, trùng, tháng chốt, ngày tương lai) → message gốc, `LOI`; điều chỉnh công ngày/giờ sai → 400; ai-service timeout 503; thiếu `nhanVienId`; 5 vai trò; nhật ký `AI_TAO_DON`; 429.
**pytest** (mock `goiLlmVoiCongCu`): lọc từ khóa; phân loại; trường lạ bị lọc; ngày sai/ngoài khoảng → `HOI_LAI`; `LoiLlm` → `DU_PHONG`; quá `hanChot` không gọi LLM/không ghi lịch sử; `banNhapDon` chuyển trạng thái nguyên tử (2 luồng → 1 thành công), TTL, lọc `nguoiDungId`/`dauPhien`; migration `duLieuJson` chạy lại không lỗi.

## 12. Chia bước / commit
1. `fix: dua kiem tra du lieu yeu cau dieu chinh cong vao service` + test.
2. `feat: ai-service goi LLM voi cong cu va phan loai y dinh tao don` (`claudeClient.py`, `functionCalling/tuKhoa.py`, `congCu.py`, `trichXuat.py`, `api.py`).
3. `feat: ai-service luu ban nhap don va du lieu tin nhan trong SQLite`.
4. `feat: backend tro ly AI tao don qua chat co xac nhan`.
5. `test: jest va pytest cho AI tao don`.
6. `feat: giao dien the xem truoc don tren tro ly AI`.
7. `chore: seed demo AI tao don va cap nhat progress, phan-quyen`.

## 13. Rủi ro / hạn chế
- LLM hiểu sai ngày tương đối → thẻ hiện thứ + ngày, xác nhận bắt buộc, kiểm tra bằng code.
- `yeucaudieuchinhchamcong` không có cột nguồn tạo → phân biệt đơn AI chỉ qua `nhatkyhethong` (Hạn chế đã biết).
- SQLite và MySQL không chung transaction: INSERT MySQL xong mà cập nhật `DA_TAO` lỗi → kẹt `DANG_TAO`, sau 2 phút coi `LOI`; tạo lại bị service chặn trùng (chồng lấn / đơn chờ duyệt cùng ngày) → rủi ro trùng thấp.
- Bản nháp lọc theo `dauPhien` nên cùng phụ thuộc `dateStrings: true`.
- Prompt dài hơn → độ trễ Haiku tăng; phải nằm trong `AI_TIMEOUT_MS`/`hanChot`.
- Chưa có `ANTHROPIC_API_KEY`: test chỉ mock; smoke thật khi có khóa.
