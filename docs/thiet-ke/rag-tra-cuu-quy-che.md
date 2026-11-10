# Thiết kế Module 5 – AI Agent (chức năng 1: RAG tra cứu quy chế)

Người dùng duyệt 2026-11-10. Schema MariaDB giữ nguyên 25 bảng.

## Lựa chọn đã chốt
| Hạng mục | Chọn |
|---|---|
| LLM | Claude Haiku 5.5 (`claude-haiku-5-5`), cấu hình `.env` `MO_HINH_LLM` (Text-to-SQL đổi riêng được) |
| Embedding | `intfloat/multilingual-e5-base` local (sentence-transformers); CI/test mock |
| Vector DB | Chroma persistent (`ai-service/duLieu/chroma/`) |
| Lịch sử chat | SQLite `ai-service/duLieu/lichSu.db`, bảng `tinNhan(phienId, vaiTro, noiDung, nguonJson, thoiGian)`, khóa theo `phientrochuyenai.id` |
| Giao diện | Trang riêng `/troLyAi` (danh sách phiên + khung chat + thẻ trích dẫn); HR có trang quản lý tài liệu |
| Trả lời | Trả một lần (không streaming) |

## Kiến trúc
Frontend → Express `/api/v1/troLyAi/*`, `/api/v1/taiLieuQuyChe/*` (xacThucJwt, phanQuyen, kiemTraDuLieu, giới hạn ~20 lượt/phút/người) → `aiClientService` (fetch + AbortController ~30s, lỗi/timeout → `LoiUngDung(503, 'Trợ lý AI tạm thời không khả dụng, vui lòng thử lại sau')`) → FastAPI `/noiBo/*` (bind 127.0.0.1, header `X-Khoa-Noi-Bo` = `AI_SERVICE_KEY`, `hmac.compare_digest`).
- Express gửi ngữ cảnh đã xác thực `{nguoiDungId, nhanVienId, vaiTro[], phamViPhongBanIds}`.
- Function Calling (chức năng 2): ai-service trả `{yDinh, thamSo}`; Express ép người dùng hiện tại, UI xác nhận, gọi `nghiPhepService.taoDon(req.nguoiDung, thamSo, 'AI_CHAT')` → `CHO_DUYET`. ai-service không ghi CSDL.
- Text-to-SQL (chức năng 3): `aiReadonly`, sqlglot 1 câu `Select`, LIMIT ≤ 200, `SET STATEMENT max_statement_time=5 FOR`, quanLy lọc theo `phamViPhongBanIds` do Express tính (`phongBanRepository.layPhongBanQuanLy`).

## API
Express:
| Method | Route | Vai trò |
|---|---|---|
| GET | `/api/v1/taiLieuQuyChe?tuKhoa&trang&kichThuoc` | 5 vai trò |
| GET | `/api/v1/taiLieuQuyChe/:id/tep` | 5 vai trò |
| POST | `/api/v1/taiLieuQuyChe` (multipart `tep`, `maTaiLieu`, `tieuDe`; .pdf/.docx/.md ≤ 10MB; 201; trùng mã 409) | HR |
| DELETE | `/api/v1/taiLieuQuyChe/:id` (xóa file + DB + vector) | HR |
| POST | `/api/v1/taiLieuQuyChe/:id/lapChiMuc` | HR |
| GET/POST | `/api/v1/troLyAi/phien` | 5 vai trò, chỉ của mình |
| PATCH/DELETE | `/api/v1/troLyAi/phien/:id` (không phải của mình → 404) | 5 vai trò |
| GET | `/api/v1/troLyAi/phien/:id/tinNhan` | 5 vai trò |
| POST | `/api/v1/troLyAi/hoiDap` `{phienId?, cauHoi 1–1000}` → `{phienId, traLoi, nguonTrichDan:[{taiLieuId, maTaiLieu, tieuDe, dieu, khoan, doanTrich, diem}]}` | 5 vai trò |

FastAPI: `POST /noiBo/rag/lapChiMuc`, `DELETE /noiBo/rag/taiLieu/{id}`, `POST /noiBo/rag/hoiDap`, `GET/POST/DELETE /noiBo/lichSu/{phienId}`, `GET /suKhoe`.

## File
- Backend: `routes/taiLieuQuyCheRoutes.js`, `routes/troLyAiRoutes.js`, `middlewares/taiTep.js` (multer, uuid tên file, kiểm magic bytes, chống path traversal), `controllers/taiLieuQuyCheController.js`, `troLyAiController.js`, `services/taiLieuQuyCheService.js`, `troLyAiService.js`, `aiClientService.js`, `repositories/taiLieuQuyCheRepository.js`, `phienTroChuyenRepository.js`; env `AI_SERVICE_URL`, `AI_SERVICE_KEY`, `AI_TIMEOUT_MS`, `THU_MUC_TAI_LIEU` (mặc định `backend/uploads/quyChe/`).
- ai-service: `main.py`, `cauHinh.py`, `baoMat.py`, `llm/claudeClient.py`, `rag/docTaiLieu.py`, `rag/chiaDoan.py` (chunk theo Điều/Khoản, Khoản dài tách ~800 token chồng ~100; dự phòng "đoạn k"), `rag/nhung.py`, `rag/khoVector.py`, `rag/hoiDap.py` (chỉ dùng ngữ cảnh; dưới ngưỡng điểm → "không tìm thấy" không gọi LLM; hậu kiểm chỉ giữ trích dẫn có trong chunk đã truy hồi; LLM lỗi → trả đoạn trích dự phòng), `lichSu/khoLichSu.py`, khung `functionCalling/`, `textToSql/`, `scripts/lapChiMucMau.py`, `tests/`. requirements: anthropic, chromadb, sentence-transformers, pypdf, python-docx, httpx, pytest.
- Frontend: `pages/troLyAi/TrangTroLyAi.jsx`, `components/troLyAi/KhungChat.jsx`, `TinNhan.jsx`, `TheTrichDan.jsx`, `pages/troLyAi/TrangTaiLieuQuyChe.jsx` (HR), `hooks/useTroLyAi.js`, menu `config/danhSachMenu.js`.

## CSDL & nhật ký
- `tailieuquyche`: lưu file → INSERT (`nguoiTaiLenId` = nhanVienId HR, `duongDanTep` tương đối) → lập chỉ mục; lỗi lập chỉ mục vẫn giữ bản ghi, trả cảnh báo.
- `nhatkyhethong`: `TAI_LEN_TAI_LIEU`, `XOA_TAI_LIEU`, `LAP_CHI_MUC_TAI_LIEU` (sau: `AI_TAO_DON`, `AI_TEXT_TO_SQL`).
- Seed: 3 tài liệu QC-NOIQUY, QC-NGHIPHEP, QC-LUONG (.md có "Điều n"/khoản, khớp tham số nghiệp vụ thật) trong `backend/uploads/quyChe/mau/`; 1–2 phiên mỗi vai trò; script index mẫu. Cân nhắc đưa `taoTaiKhoanChiDoc.sql` vào `khoiTaoCsdl` (mật khẩu từ env) — hỏi người dùng khi làm Text-to-SQL.

## Test
- Jest (mock `aiClientService`): RBAC upload HR 201 / khác 403; 409 trùng mã; 400 sai định dạng; hoiDap có trích dẫn; timeout/ECONNREFUSED → 503 không sập; phiên người khác → 404; tự dọn file/bản ghi.
- pytest: chiaDoan Điều/Khoản; khóa nội bộ sai → 401; dưới ngưỡng không gọi LLM; trích dẫn (mock Claude); Chroma tạm `tmp_path`; embedding mock.

## Rủi ro
Tài liệu không theo "Điều n"; PDF scan không OCR (400); tải model lần đầu cần mạng; Chroma/SQLite ngoài `khoiTaoCsdl` (cần script index lại); phụ thuộc API key + mạng khi demo; LLM bịa số điều (hậu kiểm).
