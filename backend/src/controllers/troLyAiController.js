const troLyAiService = require('../services/troLyAiService');
const { thanhCong } = require('../utils/phanHoi');
const { laySoNguyenDuong } = require('../utils/thamSoTruyVan');

function layId(req) {
  return laySoNguyenDuong(req.params.id, undefined, 'Mã phiên trò chuyện');
}

async function layDanhSachPhien(req, res) {
  return thanhCong(res, await troLyAiService.layDanhSachPhien(req.nguoiDung), 'Lấy danh sách phiên trò chuyện thành công');
}

async function taoPhien(req, res) {
  const phien = await troLyAiService.taoPhien(req.nguoiDung, req.body ?? {});
  return thanhCong(res, phien, 'Tạo phiên trò chuyện thành công', 201);
}

async function doiTieuDe(req, res) {
  const phien = await troLyAiService.doiTieuDe(req.nguoiDung, layId(req), req.body.tieuDePhien);
  return thanhCong(res, phien, 'Đổi tên phiên trò chuyện thành công');
}

async function xoaPhien(req, res) {
  return thanhCong(res, await troLyAiService.xoaPhien(req.nguoiDung, layId(req)), 'Xóa phiên trò chuyện thành công');
}

async function layTinNhan(req, res) {
  return thanhCong(res, await troLyAiService.layTinNhan(req.nguoiDung, layId(req)), 'Lấy tin nhắn thành công');
}

async function hoiDap(req, res) {
  const { phienId, cauHoi } = req.body;
  const ketQua = await troLyAiService.hoiDap(req.nguoiDung, { phienId: phienId ? Number(phienId) : undefined, cauHoi });
  return thanhCong(res, ketQua, 'Trợ lý AI đã trả lời');
}

module.exports = { layDanhSachPhien, taoPhien, doiTieuDe, xoaPhien, layTinNhan, hoiDap };
