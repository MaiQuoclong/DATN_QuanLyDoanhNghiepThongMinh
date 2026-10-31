const LoiUngDung = require('./LoiUngDung');
const { laNgayHopLe } = require('../middlewares/kiemTraDuLieu');

const KICH_THUOC_MAC_DINH = 20;
const KICH_THUOC_TOI_DA = 100;

// Đọc số nguyên dương từ query/params; sai định dạng trả 400
function laySoNguyenDuong(giaTri, macDinh, nhan) {
  if (giaTri === undefined || giaTri === '') return macDinh;
  if (!/^[1-9]\d{0,9}$/.test(String(giaTri))) throw new LoiUngDung(400, `${nhan} phải là số nguyên dương`);
  return Number(giaTri);
}

function layNgay(giaTri, nhan) {
  if (giaTri === undefined || giaTri === '') return undefined;
  if (typeof giaTri !== 'string' || !laNgayHopLe(giaTri)) {
    throw new LoiUngDung(400, `${nhan} phải là ngày hợp lệ dạng YYYY-MM-DD`);
  }
  return giaTri;
}

function layGiaTriTrongDanhSach(giaTri, danhSach, nhan) {
  if (giaTri === undefined || giaTri === '') return undefined;
  if (!danhSach.includes(giaTri)) throw new LoiUngDung(400, `${nhan} không hợp lệ`);
  return giaTri;
}

function layTuKhoa(giaTri) {
  return typeof giaTri === 'string' && giaTri.trim() ? giaTri.trim().slice(0, 100) : undefined;
}

// Phân trang chuẩn: ?trang=1&kichThuoc=20 (tối đa 100)
function layPhanTrang(query) {
  const trang = laySoNguyenDuong(query.trang, 1, 'Trang');
  const kichThuoc = Math.min(laySoNguyenDuong(query.kichThuoc, KICH_THUOC_MAC_DINH, 'Kích thước trang'), KICH_THUOC_TOI_DA);
  return { trang, kichThuoc, viTri: (trang - 1) * kichThuoc, soLuong: kichThuoc };
}

module.exports = { laySoNguyenDuong, layNgay, layGiaTriTrongDanhSach, layTuKhoa, layPhanTrang };
