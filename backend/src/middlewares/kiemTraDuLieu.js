const LoiUngDung = require('../utils/LoiUngDung');

const MAU_NGAY = /^\d{4}-\d{2}-\d{2}$/;
const MAU_GIO = /^([01]\d|2[0-3]):[0-5]\d$/;

// Ngày dạng YYYY-MM-DD và có thật trên lịch (loại 2026-02-30)
function laNgayHopLe(giaTri) {
  if (!MAU_NGAY.test(giaTri)) return false;
  const ngay = new Date(`${giaTri}T00:00:00Z`);
  return !Number.isNaN(ngay.getTime()) && ngay.toISOString().slice(0, 10) === giaTri;
}

// Kiểm tra req.body theo luật đơn giản, lỗi đầu tiên trả 400.
// luat: { tenTruong: { nhan, batBuoc, toiThieu, toiDa, toiDaByte, mauKiemTra: RegExp, thongBaoMau,
//                      kieu: 'soNguyenDuong' | 'ngay' | 'gio' | 'soTien', cacGiaTri: [...] } }
function kiemTraDuLieu(luat) {
  return (req, res, next) => {
    const body = req.body ?? {};
    for (const [truong, quyTac] of Object.entries(luat)) {
      const nhan = quyTac.nhan ?? truong;
      let giaTri = body[truong];
      const rong = giaTri === undefined || giaTri === null || String(giaTri).trim() === '';
      if (rong) {
        if (quyTac.batBuoc) throw new LoiUngDung(400, `${nhan} không được để trống`);
        continue;
      }
      if (quyTac.kieu === 'soNguyenDuong') {
        if (!/^[1-9]\d{0,9}$/.test(String(giaTri)) || (typeof giaTri !== 'number' && typeof giaTri !== 'string')) {
          throw new LoiUngDung(400, `${nhan} phải là số nguyên dương`);
        }
        continue;
      }
      // Tiền tệ DECIMAL(15,2): số không âm, tối đa 2 chữ số thập phân, nhận cả number lẫn chuỗi số
      if (quyTac.kieu === 'soTien') {
        if ((typeof giaTri !== 'number' && typeof giaTri !== 'string') || !/^\d{1,13}(\.\d{1,2})?$/.test(String(giaTri))) {
          throw new LoiUngDung(400, `${nhan} phải là số tiền không âm, tối đa 2 chữ số thập phân`);
        }
        if (quyTac.duong && Number(giaTri) <= 0) throw new LoiUngDung(400, `${nhan} phải lớn hơn 0`);
        continue;
      }
      if (typeof giaTri !== 'string') {
        throw new LoiUngDung(400, `${nhan} phải là chuỗi ký tự`);
      }
      // Kiểm tra trên giá trị đã trim và ghi lại vào body để service nhận đúng giá trị đã kiểm tra
      // (khongTrim: mật khẩu giữ nguyên văn vì được băm nguyên văn)
      const giaTriGoc = giaTri;
      giaTri = quyTac.khongTrim ? giaTriGoc : giaTriGoc.trim();
      if (!quyTac.khongTrim) body[truong] = giaTri;
      if (quyTac.kieu === 'ngay' && !laNgayHopLe(giaTri)) {
        throw new LoiUngDung(400, `${nhan} phải là ngày hợp lệ dạng YYYY-MM-DD`);
      }
      if (quyTac.kieu === 'gio' && !MAU_GIO.test(giaTri)) {
        throw new LoiUngDung(400, `${nhan} phải là giờ hợp lệ dạng HH:MM`);
      }
      if (quyTac.cacGiaTri && !quyTac.cacGiaTri.includes(giaTri)) {
        throw new LoiUngDung(400, `${nhan} chỉ nhận một trong các giá trị: ${quyTac.cacGiaTri.join(', ')}`);
      }
      const doDai = giaTri.length;
      if (quyTac.toiThieu && doDai < quyTac.toiThieu) {
        throw new LoiUngDung(400, `${nhan} phải có ít nhất ${quyTac.toiThieu} ký tự`);
      }
      if (quyTac.toiDa && doDai > quyTac.toiDa) {
        throw new LoiUngDung(400, `${nhan} không được vượt quá ${quyTac.toiDa} ký tự`);
      }
      if (quyTac.toiDaByte && Buffer.byteLength(giaTri, 'utf8') > quyTac.toiDaByte) {
        throw new LoiUngDung(400, `${nhan} quá dài (tối đa ${quyTac.toiDaByte} byte)`);
      }
      if (quyTac.mauKiemTra && !quyTac.mauKiemTra.test(giaTri)) {
        throw new LoiUngDung(400, quyTac.thongBaoMau ?? `${nhan} không hợp lệ`);
      }
    }
    next();
  };
}

module.exports = kiemTraDuLieu;
module.exports.laNgayHopLe = laNgayHopLe;
