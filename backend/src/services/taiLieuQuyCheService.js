const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const LoiUngDung = require('../utils/LoiUngDung');
const ghiNhatKy = require('../utils/ghiNhatKy');
const taiLieuQuyCheRepository = require('../repositories/taiLieuQuyCheRepository');
const aiClientService = require('./aiClientService');
const { layDuoiTep } = require('../middlewares/taiTep');

// Thư mục gốc lưu tệp quy chế; cột duongDanTep chỉ lưu đường dẫn tương đối (dấu '/') bên trong thư mục này
// Giá trị tương đối trong .env tính từ thư mục backend/ (không phụ thuộc thư mục đang chạy lệnh),
// cùng quy ước với ai-service (tính từ ai-service/) để hai bên trỏ đúng một thư mục.
const THU_MUC_BACKEND = path.join(__dirname, '..', '..');
function layThuMucTaiLieu() {
  return path.resolve(THU_MUC_BACKEND, process.env.THU_MUC_TAI_LIEU || path.join('uploads', 'quyChe'));
}

// Đường dẫn tuyệt đối của tệp; giá trị trong CSDL trỏ ra ngoài thư mục gốc (../, đường dẫn tuyệt đối) → null.
// Đổi '\' thành '/' trước để giá trị lưu kiểu Windows vẫn đúng khi chạy Linux.
function giaiDuongDanTep(duongDanTep) {
  const thuMuc = layThuMucTaiLieu();
  const tuyetDoi = path.resolve(thuMuc, duongDanTep.replaceAll('\\', '/'));
  const tuongDoi = path.relative(thuMuc, tuyetDoi);
  const raNgoai = tuongDoi === '..' || tuongDoi.startsWith(`..${path.sep}`) || path.isAbsolute(tuongDoi);
  if (!tuongDoi || raNgoai) return null;
  return tuyetDoi;
}

const THU_MUC_TEP_MAU = 'mau/';
function laTepMau(duongDanTep) {
  return duongDanTep.replaceAll('\\', '/').startsWith(THU_MUC_TEP_MAU);
}

async function layKichThuocTep(duongDanTep) {
  const tuyetDoi = giaiDuongDanTep(duongDanTep);
  if (!tuyetDoi) return null;
  try {
    const thongTin = await fs.stat(tuyetDoi);
    return thongTin.isFile() ? thongTin.size : null;
  } catch {
    return null;
  }
}

// Thêm loaiTep, kichThuocTep (null = tệp không còn trên đĩa); không trả đường dẫn lưu trữ ra API
async function dinhDangTaiLieu(taiLieu) {
  const { duongDanTep, ...conLai } = taiLieu;
  return { ...conLai, loaiTep: layDuoiTep(duongDanTep).slice(1), kichThuocTep: await layKichThuocTep(duongDanTep) };
}

// Lập chỉ mục đọc + nhúng toàn bộ tài liệu (lần đầu còn nạp model) nên cho chờ lâu hơn AI_TIMEOUT_MS mặc định
const THOI_GIAN_CHO_LAP_CHI_MUC = 120000;
const THOI_GIAN_CHO_TRANG_THAI = 3000;

// {taiLieuId: soDoan} từ kho vector; ai-service không khả dụng → null (danh sách vẫn hiển thị, trạng thái "không rõ")
async function layTrangThaiChiMuc() {
  try {
    const duLieu = await aiClientService.goiAiService('/noiBo/rag/taiLieu', { thoiGianCho: THOI_GIAN_CHO_TRANG_THAI });
    return new Map((duLieu?.taiLieu || []).map((t) => [t.taiLieuId, t.soDoan]));
  } catch {
    return null;
  }
}

// soDoanChiMuc: số đoạn đã lập chỉ mục (0 = chưa lập), null = không kiểm tra được (ai-service tắt)
async function layDanhSach(boLoc) {
  const [{ items, tongSo }, trangThai] = await Promise.all([taiLieuQuyCheRepository.layDanhSach(boLoc), layTrangThaiChiMuc()]);
  const daDinhDang = await Promise.all(items.map(dinhDangTaiLieu));
  return {
    items: daDinhDang.map((t) => ({ ...t, soDoanChiMuc: trangThai ? (trangThai.get(t.id) ?? 0) : null })),
    phanTrang: { trang: boLoc.trang, kichThuoc: boLoc.kichThuoc, tongSo },
    chiMucKhaDung: trangThai !== null,
  };
}

async function layTaiLieu(id) {
  const taiLieu = await taiLieuQuyCheRepository.layTheoId(id);
  if (!taiLieu) throw new LoiUngDung(404, 'Không tìm thấy tài liệu quy chế');
  return taiLieu;
}

// Thông tin để controller gửi tệp: đường dẫn tuyệt đối + tên tải về (mã tài liệu + đuôi)
async function layTepTaiVe(id) {
  const taiLieu = await layTaiLieu(id);
  const tuyetDoi = giaiDuongDanTep(taiLieu.duongDanTep);
  if (!tuyetDoi || (await layKichThuocTep(taiLieu.duongDanTep)) === null) {
    throw new LoiUngDung(404, 'Tệp của tài liệu không còn trên máy chủ');
  }
  return { duongDan: tuyetDoi, tenTaiVe: `${taiLieu.maTaiLieu}${layDuoiTep(taiLieu.duongDanTep)}` };
}

// Gửi ai-service đọc tệp (cùng thư mục THU_MUC_TAI_LIEU) → chia Điều/Khoản → nhúng → lưu Chroma.
// Kèm danh sách id còn trong CSDL để ai-service dọn vector của tài liệu đã xóa lúc nó tắt.
async function goiLapChiMuc(nguoiDung, taiLieu, diaChiIP) {
  if ((await layKichThuocTep(taiLieu.duongDanTep)) === null) {
    throw new LoiUngDung(404, 'Tệp của tài liệu không còn trên máy chủ');
  }
  const ketQua = await aiClientService.goiAiService('/noiBo/rag/lapChiMuc', {
    method: 'POST',
    body: {
      taiLieuId: taiLieu.id,
      maTaiLieu: taiLieu.maTaiLieu,
      tieuDe: taiLieu.tieuDe,
      duongDanTep: taiLieu.duongDanTep.replaceAll('\\', '/'),
      taiLieuIdsHienCo: await taiLieuQuyCheRepository.layTatCaId(),
    },
    thoiGianCho: THOI_GIAN_CHO_LAP_CHI_MUC,
  });
  await ghiNhatKy(
    nguoiDung.nguoiDungId,
    'LAP_CHI_MUC_TAI_LIEU',
    diaChiIP,
    `${taiLieu.maTaiLieu} (id ${taiLieu.id}): ${ketQua.soDoan} đoạn`,
  );
  return { soDoan: ketQua.soDoan, soDieu: ketQua.soDieu, theoDieuKhoan: ketQua.theoDieuKhoan };
}

// HR lập (lại) chỉ mục: dùng sau khi ai-service tắt lúc tải lên, đổi model embedding hoặc dựng lại kho vector
async function lapChiMuc(nguoiDung, id, diaChiIP) {
  const taiLieu = await layTaiLieu(id);
  return { id, ...(await goiLapChiMuc(nguoiDung, taiLieu, diaChiIP)) };
}

// HR tải lên: ghi tệp tên uuid → INSERT; INSERT lỗi (VD trùng mã khi hai người tải đồng thời) thì xóa tệp vừa ghi
async function taiLen(nguoiDung, { maTaiLieu, tieuDe }, tep, diaChiIP) {
  if (!nguoiDung.nhanVienId) {
    throw new LoiUngDung(403, 'Tài khoản chưa gắn hồ sơ nhân viên nên không thể tải lên tài liệu');
  }
  if (await taiLieuQuyCheRepository.layTheoMa(maTaiLieu)) {
    throw new LoiUngDung(409, `Mã tài liệu ${maTaiLieu} đã tồn tại`);
  }
  const duongDanTep = `${crypto.randomUUID()}${tep.duoiTep}`;
  const tuyetDoi = giaiDuongDanTep(duongDanTep);
  await fs.mkdir(path.dirname(tuyetDoi), { recursive: true });
  await fs.writeFile(tuyetDoi, tep.buffer, { flag: 'wx' });

  let id;
  try {
    id = await taiLieuQuyCheRepository.them({ maTaiLieu, tieuDe, duongDanTep, nguoiTaiLenId: nguoiDung.nhanVienId });
  } catch (loi) {
    await fs.rm(tuyetDoi, { force: true });
    if (loi.code === 'ER_DUP_ENTRY') throw new LoiUngDung(409, `Mã tài liệu ${maTaiLieu} đã tồn tại`);
    throw loi;
  }
  await ghiNhatKy(nguoiDung.nguoiDungId, 'TAI_LEN_TAI_LIEU', diaChiIP, `${maTaiLieu} (id ${id})`);
  const taiLieu = await layTaiLieu(id);

  // Lập chỉ mục ngay; lỗi (ai-service tắt, PDF scan...) vẫn giữ bản ghi, trả cảnh báo để HR lập lại sau
  let chiMuc = null;
  let canhBao = null;
  try {
    chiMuc = await goiLapChiMuc(nguoiDung, taiLieu, diaChiIP);
  } catch (loi) {
    // Bản ghi đã lưu: mọi lỗi ở bước này (kể cả lỗi DB khi lấy id/ghi nhật ký) chỉ thành cảnh báo,
    // tránh client tưởng tải lên thất bại rồi tải lại bị 409 trùng mã
    if (!(loi instanceof LoiUngDung)) console.error(`[taiLieuQuyChe] Lập chỉ mục ${maTaiLieu} lỗi: ${loi.message}`);
    const lyDo = loi instanceof LoiUngDung ? loi.message : 'lỗi hệ thống';
    canhBao = `Đã lưu tài liệu nhưng chưa lập được chỉ mục cho Trợ lý AI: ${lyDo}`;
  }
  return { ...(await dinhDangTaiLieu(taiLieu)), soDoanChiMuc: chiMuc ? chiMuc.soDoan : null, canhBao };
}

// HR xóa: xóa bản ghi trước (nguồn chuẩn), sau đó xóa tệp; tệp đã mất từ trước thì bỏ qua.
// Tệp mẫu seed (mau/) do git quản lý nên chỉ xóa bản ghi, giữ tệp để `npm run khoiTaoCsdl` dựng lại đầy đủ.
// Sau đó xóa vector: ai-service tắt thì chỉ cảnh báo, vector mồ côi được dọn ở lần lập chỉ mục kế tiếp
// (taiLieuIdsHienCo) và trích dẫn của tài liệu không còn bản ghi bị lọc khi hỏi đáp.
async function xoa(nguoiDung, id, diaChiIP) {
  const taiLieu = await layTaiLieu(id);
  if (!(await taiLieuQuyCheRepository.xoa(id))) throw new LoiUngDung(404, 'Không tìm thấy tài liệu quy chế');
  const tuyetDoi = giaiDuongDanTep(taiLieu.duongDanTep);
  if (tuyetDoi && !laTepMau(taiLieu.duongDanTep)) {
    try {
      await fs.rm(tuyetDoi, { force: true });
    } catch (loi) {
      console.error(`[taiLieuQuyChe] Không xóa được tệp ${taiLieu.duongDanTep}: ${loi.message}`);
    }
  }
  let canhBao = null;
  try {
    await aiClientService.goiAiService(`/noiBo/rag/taiLieu/${id}`, { method: 'DELETE' });
  } catch (loi) {
    if (!(loi instanceof LoiUngDung)) throw loi;
    canhBao = 'Đã xóa tài liệu nhưng chưa xóa được chỉ mục của Trợ lý AI; chỉ mục sẽ được dọn ở lần lập chỉ mục tiếp theo';
  }
  await ghiNhatKy(nguoiDung.nguoiDungId, 'XOA_TAI_LIEU', diaChiIP, `${taiLieu.maTaiLieu} (id ${id})`);
  return { id, canhBao };
}

module.exports = { layDanhSach, layTepTaiVe, taiLen, xoa, lapChiMuc, layThuMucTaiLieu, giaiDuongDanTep, laTepMau };
