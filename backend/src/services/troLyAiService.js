const LoiUngDung = require('../utils/LoiUngDung');
const aiClientService = require('./aiClientService');
const phienTroChuyenRepository = require('../repositories/phienTroChuyenRepository');
const taiLieuQuyCheRepository = require('../repositories/taiLieuQuyCheRepository');

// Trợ lý AI hỏi đáp quy chế (RAG). MySQL giữ phiên (chủ sở hữu, tiêu đề); nội dung tin nhắn ở SQLite của ai-service.
const TIEU_DE_MAC_DINH = 'Cuộc trò chuyện mới';
const DO_DAI_TIEU_DE = 150;

// Khóa phụ của phiên bên ai-service: id phiên bị dùng lại sau `npm run khoiTaoCsdl` (AUTO_INCREMENT đếm lại)
// thì nguoiDungId/thoiGianTao khác → không đọc nhầm lịch sử của phiên cũ cùng id.
// Ràng buộc: thoiGianTao là chuỗi 'YYYY-MM-DD HH:mm:ss' nhờ `dateStrings: true` (config/ketNoiCsdl.js).
// Bỏ cấu hình đó thì giá trị thành Date (chuỗi phụ thuộc múi giờ) → dauPhien đổi, mất toàn bộ lịch sử cũ.
function layDauPhien(phien) {
  return `${phien.nguoiDungId}|${String(phien.thoiGianTao).slice(0, 19)}`;
}

// Khóa so khớp tài liệu theo cả id và mã (id có thể bị cấp lại cho tài liệu khác sau khoiTaoCsdl)
const khoaTaiLieu = (id, maTaiLieu) => `${id}|${maTaiLieu}`;

// Cùng giá trị aiClientService dùng làm thời gian chờ mặc định
function layThoiGianChoAi() {
  return Number(process.env.AI_TIMEOUT_MS) || 30000;
}

function dinhDangPhien({ id, tieuDePhien, thoiGianTao }) {
  return { id, tieuDePhien, thoiGianTao };
}

// Phiên của người khác trả 404 (không lộ phiên đó tồn tại)
async function layPhienCuaMinh(nguoiDung, id) {
  const phien = await phienTroChuyenRepository.layCuaNguoiDung(id, nguoiDung.nguoiDungId);
  if (!phien) throw new LoiUngDung(404, 'Không tìm thấy phiên trò chuyện');
  return phien;
}

// Tiêu đề tự đặt từ câu hỏi đầu tiên: gọn một dòng, cắt theo ký tự (không cắt đôi cặp surrogate)
function taoTieuDeTuCauHoi(cauHoi) {
  const motDong = cauHoi.replace(/\s+/g, ' ').trim();
  const kyTu = Array.from(motDong);
  return kyTu.length <= DO_DAI_TIEU_DE ? motDong : `${kyTu.slice(0, DO_DAI_TIEU_DE - 1).join('')}…`;
}

async function layDanhSachPhien(nguoiDung) {
  return (await phienTroChuyenRepository.layTheoNguoiDung(nguoiDung.nguoiDungId)).map(dinhDangPhien);
}

async function taoPhien(nguoiDung, { tieuDePhien } = {}) {
  const id = await phienTroChuyenRepository.them(nguoiDung.nguoiDungId, tieuDePhien || TIEU_DE_MAC_DINH);
  return dinhDangPhien(await layPhienCuaMinh(nguoiDung, id));
}

async function doiTieuDe(nguoiDung, id, tieuDePhien) {
  await layPhienCuaMinh(nguoiDung, id);
  await phienTroChuyenRepository.doiTieuDe(id, nguoiDung.nguoiDungId, tieuDePhien);
  return dinhDangPhien(await layPhienCuaMinh(nguoiDung, id));
}

// Xóa phiên MySQL trước (nguồn chuẩn); xóa lịch sử SQLite sau. ai-service tắt thì chỉ ghi log: tin sót lại
// không hiển thị được nữa vì phiên mới trùng id có dauPhien khác.
async function xoaPhien(nguoiDung, id) {
  await layPhienCuaMinh(nguoiDung, id);
  await phienTroChuyenRepository.xoa(id, nguoiDung.nguoiDungId);
  try {
    await aiClientService.goiAiService(`/noiBo/lichSu/${id}`, { method: 'DELETE' });
  } catch (loi) {
    console.error(`[troLyAi] Chưa xóa được lịch sử phiên ${id}: ${loi.message}`);
  }
  return { id };
}

async function layTinNhan(nguoiDung, id) {
  const phien = await layPhienCuaMinh(nguoiDung, id);
  const duLieu = await aiClientService.goiAiService(`/noiBo/lichSu/${id}?dauPhien=${encodeURIComponent(layDauPhien(phien))}`);
  return { phien: dinhDangPhien(phien), tinNhan: duLieu?.tinNhan ?? [] };
}

// Hỏi đáp: không có phienId thì tạo phiên mới (tiêu đề = câu hỏi). Phiên vừa tạo mà ai-service lỗi thì xóa lại
// để không sinh phiên rỗng; phiên đang có giữ nguyên.
async function hoiDap(nguoiDung, { phienId, cauHoi }) {
  let phien;
  let phienMoi = false;
  if (phienId) {
    phien = await layPhienCuaMinh(nguoiDung, phienId);
  } else {
    const id = await phienTroChuyenRepository.them(nguoiDung.nguoiDungId, taoTieuDeTuCauHoi(cauHoi));
    phien = await layPhienCuaMinh(nguoiDung, id);
    phienMoi = true;
  }

  let ketQua;
  let taiLieuHienCo;
  try {
    taiLieuHienCo = await taiLieuQuyCheRepository.layTatCaIdVaMa();
    ketQua = await aiClientService.goiAiService('/noiBo/rag/hoiDap', {
      method: 'POST',
      body: {
        phienId: phien.id,
        dauPhien: layDauPhien(phien),
        cauHoi,
        taiLieuIdsHienCo: taiLieuHienCo.map((t) => t.id),
        taiLieuHienCo,
        // ai-service bỏ (không gọi LLM, không ghi lịch sử) nếu xử lý xong sau lúc backend đã ngừng chờ:
        // tránh câu hỏi người dùng thấy là lỗi lại xuất hiện trong lịch sử. Trừ 2s dự phòng truyền mạng.
        hanChot: Date.now() + layThoiGianChoAi() - 2000,
      },
    });
  } catch (loi) {
    if (phienMoi) {
      // Dọn phiên rỗng; dọn lỗi chỉ ghi log để không che mất lỗi gốc (503 thân thiện)
      try {
        await phienTroChuyenRepository.xoa(phien.id, nguoiDung.nguoiDungId);
      } catch (loiDon) {
        console.error(`[troLyAi] Không dọn được phiên ${phien.id}: ${loiDon.message}`);
      }
    }
    throw loi;
  }

  // Từ đây ai-service ĐÃ ghi lịch sử: lỗi CSDL ở các bước phụ chỉ ghi log, vẫn trả câu trả lời
  // (trả 500 thì màn hình gỡ câu hỏi trong khi mở lại phiên vẫn thấy → lệch lịch sử).
  // Phiên tạo trống (tiêu đề mặc định) đổi tiêu đề theo câu hỏi đầu tiên
  if (!phienMoi && phien.tieuDePhien === TIEU_DE_MAC_DINH) {
    try {
      await phienTroChuyenRepository.doiTieuDe(phien.id, nguoiDung.nguoiDungId, taoTieuDeTuCauHoi(cauHoi));
      phien = await layPhienCuaMinh(nguoiDung, phien.id);
    } catch (loi) {
      console.error(`[troLyAi] Không đổi được tiêu đề phiên ${phien.id}: ${loi.message}`);
    }
  }

  // Lọc lại nguồn theo CSDL: tài liệu bị xóa trong lúc đang hỏi không được trích dẫn
  try {
    taiLieuHienCo = await taiLieuQuyCheRepository.layTatCaIdVaMa();
  } catch (loi) {
    console.error(`[troLyAi] Không đọc lại được danh sách tài liệu: ${loi.message}`);
  }
  const conLai = new Set(taiLieuHienCo.map((t) => khoaTaiLieu(t.id, t.maTaiLieu)));
  return {
    phien: dinhDangPhien(phien),
    traLoi: ketQua.traLoi,
    nguonTrichDan: (ketQua.nguonTrichDan ?? []).filter((n) => conLai.has(khoaTaiLieu(n.taiLieuId, n.maTaiLieu))),
    cheDo: ketQua.cheDo,
    thoiGian: ketQua.thoiGian,
  };
}

module.exports = { layDanhSachPhien, taoPhien, doiTieuDe, xoaPhien, layTinNhan, hoiDap, TIEU_DE_MAC_DINH, layDauPhien };
