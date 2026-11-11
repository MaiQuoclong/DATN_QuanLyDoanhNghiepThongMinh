const aiClientService = require('./aiClientService');
const phongBanRepository = require('../repositories/phongBanRepository');
const ghiNhatKy = require('../utils/ghiNhatKy');
const { ngayHomNay } = require('../utils/ngayThang');

// Báo cáo AI (Text-to-SQL, 5.6). Express chỉ quyết định PHẠM VI theo vai trò trong JWT; ai-service sinh, kiểm tra
// (sqlglot) và chạy SQL bằng tài khoản chỉ đọc aiReadonly. Express (tài khoản ghi) không bao giờ chạy SQL do LLM sinh.
const TOAN_CONG_TY = 'TOAN_CONG_TY';
const PHONG_BAN = 'PHONG_BAN';
const LOAI_HOP_LE = new Set(['KET_QUA', 'TU_CHOI', 'DU_PHONG']);
const SO_DONG_TOI_DA = 200;

function layThoiGianChoAi() {
  return Number(process.env.AI_TIMEOUT_MS) || 30000;
}

// giamDoc/HR xem toàn công ty (kiêm quanLy vẫn lấy phạm vi rộng nhất); chỉ quanLy → phòng mình làm trưởng + phòng con
async function tinhPhamVi(nguoiDung) {
  const vaiTro = nguoiDung.vaiTro ?? [];
  if (vaiTro.includes('giamDoc') || vaiTro.includes('HR')) return { cheDoPhamVi: TOAN_CONG_TY, phongBanIds: [] };
  const phongBanIds = nguoiDung.nhanVienId ? await phongBanRepository.layPhongBanQuanLy(nguoiDung.nhanVienId) : [];
  return { cheDoPhamVi: PHONG_BAN, phongBanIds };
}

function phanHoiTuChoi(lyDo) {
  return {
    loaiPhanHoi: 'TU_CHOI',
    sql: null,
    cot: [],
    dong: [],
    soDong: 0,
    biCatBot: false,
    bieuDo: { loai: 'BANG', x: null, y: [] },
    giaiThich: null,
    lyDo,
  };
}

// Chỉ nhận đúng các trường đã biết từ ai-service, cắt số dòng (phòng ai-service lỗi trả quá nhiều)
function chuanHoaKetQua(ketQua) {
  const dong = Array.isArray(ketQua.dong) ? ketQua.dong.slice(0, SO_DONG_TOI_DA) : [];
  return {
    loaiPhanHoi: LOAI_HOP_LE.has(ketQua.loaiPhanHoi) ? ketQua.loaiPhanHoi : 'DU_PHONG',
    sql: ketQua.sql ?? null,
    cot: Array.isArray(ketQua.cot) ? ketQua.cot : [],
    dong,
    soDong: dong.length,
    biCatBot: Boolean(ketQua.biCatBot) || (Array.isArray(ketQua.dong) && ketQua.dong.length > SO_DONG_TOI_DA),
    bieuDo: ketQua.bieuDo ?? { loai: 'BANG', x: null, y: [] },
    giaiThich: ketQua.giaiThich ?? null,
    lyDo: ketQua.lyDo ?? null,
  };
}

async function ghiNhatKyTruyVan(nguoiDung, ip, cauHoi, ketQua, phamVi) {
  const chiTiet = JSON.stringify({
    cauHoi: cauHoi.slice(0, 300),
    phamVi: phamVi.cheDoPhamVi,
    ketQua: ketQua.loaiPhanHoi,
    soDong: ketQua.soDong,
    lyDo: ketQua.lyDo ? String(ketQua.lyDo).slice(0, 200) : undefined,
    sql: ketQua.sql ? String(ketQua.sql).slice(0, 2000) : undefined,
  });
  await ghiNhatKy(nguoiDung.nguoiDungId, 'AI_TEXT_TO_SQL', ip, chiTiet);
}

async function truyVan(nguoiDung, cauHoi, ip) {
  const cauHoiGon = cauHoi.trim();
  const phamVi = await tinhPhamVi(nguoiDung);
  let ketQua;
  if (phamVi.cheDoPhamVi === PHONG_BAN && phamVi.phongBanIds.length === 0) {
    ketQua = phanHoiTuChoi('Bạn chưa phụ trách phòng ban nào nên không có dữ liệu để báo cáo');
  } else {
    try {
      const duLieu = await aiClientService.goiAiService('/noiBo/baoCao/truyVan', {
        method: 'POST',
        body: {
          cauHoi: cauHoiGon,
          cheDoPhamVi: phamVi.cheDoPhamVi,
          phongBanIds: phamVi.phongBanIds,
          ngayHienTai: ngayHomNay(),
          // ai-service bỏ (504 → 503) nếu xử lý xong sau lúc backend ngừng chờ; trừ 2s dự phòng truyền mạng
          hanChot: Date.now() + layThoiGianChoAi() - 2000,
        },
      });
      ketQua = chuanHoaKetQua(duLieu ?? {});
    } catch (loi) {
      await ghiNhatKyTruyVan(nguoiDung, ip, cauHoiGon, { loaiPhanHoi: 'LOI', soDong: 0, lyDo: loi.message }, phamVi);
      throw loi;
    }
  }
  // Ghi cả khi bị từ chối để có vết kiểm toán các câu hỏi cố ý vượt quyền
  await ghiNhatKyTruyVan(nguoiDung, ip, cauHoiGon, ketQua, phamVi);
  return { ...ketQua, phamVi: phamVi.cheDoPhamVi };
}

module.exports = { truyVan, tinhPhamVi, TOAN_CONG_TY, PHONG_BAN };
