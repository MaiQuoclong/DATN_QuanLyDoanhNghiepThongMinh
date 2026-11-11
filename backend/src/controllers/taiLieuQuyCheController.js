const taiLieuQuyCheService = require('../services/taiLieuQuyCheService');
const { thanhCong } = require('../utils/phanHoi');
const { laySoNguyenDuong, layTuKhoa, layPhanTrang } = require('../utils/thamSoTruyVan');

function layId(req) {
  return laySoNguyenDuong(req.params.id, undefined, 'Mã tài liệu');
}

async function layDanhSach(req, res) {
  const ketQua = await taiLieuQuyCheService.layDanhSach({ tuKhoa: layTuKhoa(req.query.tuKhoa), ...layPhanTrang(req.query) });
  return thanhCong(res, ketQua, 'Lấy danh sách tài liệu quy chế thành công');
}

// Gửi tệp dạng đính kèm; lỗi khi đang gửi (client ngắt) chỉ ghi log vì header đã gửi đi
async function taiTep(req, res) {
  const { duongDan, tenTaiVe } = await taiLieuQuyCheService.layTepTaiVe(layId(req));
  await new Promise((xong, thatBai) => {
    res.download(duongDan, tenTaiVe, (loi) => {
      if (!loi) return xong();
      if (res.headersSent) {
        console.error(`[taiLieuQuyChe] Gửi tệp ${tenTaiVe} bị gián đoạn: ${loi.message}`);
        return xong();
      }
      return thatBai(loi);
    });
  });
}

async function taiLen(req, res) {
  const taiLieu = await taiLieuQuyCheService.taiLen(req.nguoiDung, req.body, req.file, req.ip);
  return thanhCong(res, taiLieu, 'Tải lên tài liệu quy chế thành công', 201);
}

async function xoa(req, res) {
  const ketQua = await taiLieuQuyCheService.xoa(req.nguoiDung, layId(req), req.ip);
  return thanhCong(res, ketQua, 'Xóa tài liệu quy chế thành công');
}

async function lapChiMuc(req, res) {
  const ketQua = await taiLieuQuyCheService.lapChiMuc(req.nguoiDung, layId(req), req.ip);
  return thanhCong(res, ketQua, `Lập chỉ mục tài liệu thành công (${ketQua.soDoan} đoạn)`);
}

module.exports = { layDanhSach, taiTep, taiLen, xoa, lapChiMuc };
