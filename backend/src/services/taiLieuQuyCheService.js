const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const LoiUngDung = require('../utils/LoiUngDung');
const ghiNhatKy = require('../utils/ghiNhatKy');
const taiLieuQuyCheRepository = require('../repositories/taiLieuQuyCheRepository');
const { layDuoiTep } = require('../middlewares/taiTep');

// Thư mục gốc lưu tệp quy chế; cột duongDanTep chỉ lưu đường dẫn tương đối (dấu '/') bên trong thư mục này
function layThuMucTaiLieu() {
  return path.resolve(process.env.THU_MUC_TAI_LIEU || path.join(__dirname, '..', '..', 'uploads', 'quyChe'));
}

// Đường dẫn tuyệt đối của tệp; giá trị trong CSDL trỏ ra ngoài thư mục gốc (../, đường dẫn tuyệt đối) → null
function giaiDuongDanTep(duongDanTep) {
  const thuMuc = layThuMucTaiLieu();
  const tuyetDoi = path.resolve(thuMuc, duongDanTep);
  const tuongDoi = path.relative(thuMuc, tuyetDoi);
  if (!tuongDoi || tuongDoi.startsWith('..') || path.isAbsolute(tuongDoi)) return null;
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

async function layDanhSach(boLoc) {
  const { items, tongSo } = await taiLieuQuyCheRepository.layDanhSach(boLoc);
  return {
    items: await Promise.all(items.map(dinhDangTaiLieu)),
    phanTrang: { trang: boLoc.trang, kichThuoc: boLoc.kichThuoc, tongSo },
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
  return dinhDangTaiLieu(await layTaiLieu(id));
}

// HR xóa: xóa bản ghi trước (nguồn chuẩn), sau đó xóa tệp; tệp đã mất từ trước thì bỏ qua.
// Tệp mẫu seed (mau/) do git quản lý nên chỉ xóa bản ghi, giữ tệp để `npm run khoiTaoCsdl` dựng lại đầy đủ.
// Xóa vector chỉ mục bổ sung ở chức năng lập chỉ mục RAG (5.3).
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
  await ghiNhatKy(nguoiDung.nguoiDungId, 'XOA_TAI_LIEU', diaChiIP, `${taiLieu.maTaiLieu} (id ${id})`);
  return { id };
}

module.exports = { layDanhSach, layTepTaiVe, taiLen, xoa, layThuMucTaiLieu, giaiDuongDanTep, laTepMau };
