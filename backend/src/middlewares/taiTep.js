const multer = require('multer');
const LoiUngDung = require('../utils/LoiUngDung');

// Tải tệp tài liệu quy chế (multipart, trường `tep`): giữ trong bộ nhớ để kiểm tra nội dung trước khi ghi đĩa.
// Tên tệp lưu do service sinh (uuid) nên tên gốc của người dùng không bao giờ thành đường dẫn (chống path traversal).
const KICH_THUOC_TOI_DA = 10 * 1024 * 1024;
const DUOI_TEP_HOP_LE = ['.pdf', '.docx', '.md'];

const boTaiTep = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: KICH_THUOC_TOI_DA, files: 1, fields: 10 },
}).single('tep');

const THONG_BAO_LOI_MULTER = {
  LIMIT_FILE_SIZE: 'Tệp vượt quá dung lượng cho phép (tối đa 10MB)',
  LIMIT_FILE_COUNT: 'Chỉ được gửi một tệp trong trường "tep"',
  LIMIT_UNEXPECTED_FILE: 'Chỉ được gửi một tệp trong trường "tep"',
};

// Đuôi tệp viết thường lấy từ tên gốc ('' nếu không có)
function layDuoiTep(tenGoc = '') {
  const viTri = tenGoc.lastIndexOf('.');
  return viTri < 0 ? '' : tenGoc.slice(viTri).toLowerCase();
}

// Kiểm tra magic bytes khớp đuôi tệp: không tin đuôi/Content-Type do client gửi
function noiDungKhopDuoi(duoi, boDem) {
  if (duoi === '.pdf') return boDem.subarray(0, 5).toString('latin1') === '%PDF-';
  // .docx là gói ZIP (PK\x03\x04) chứa thư mục word/
  if (duoi === '.docx') {
    return boDem.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) && boDem.includes('word/');
  }
  if (duoi === '.md') {
    if (boDem.includes(0)) return false;
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(boDem);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// Middleware: chuyển lỗi multer thành 400 tiếng Việt, kiểm tra có tệp, đúng định dạng và nội dung
function taiTepTaiLieu(req, res, next) {
  boTaiTep(req, res, (loi) => {
    if (loi) {
      const thongBao = (loi instanceof multer.MulterError && THONG_BAO_LOI_MULTER[loi.code]) || 'Dữ liệu tải lên không hợp lệ';
      return next(new LoiUngDung(400, thongBao));
    }
    if (!req.file) return next(new LoiUngDung(400, 'Vui lòng chọn tệp tài liệu'));
    const duoi = layDuoiTep(req.file.originalname);
    if (!DUOI_TEP_HOP_LE.includes(duoi)) {
      return next(new LoiUngDung(400, 'Chỉ nhận tệp .pdf, .docx hoặc .md'));
    }
    if (req.file.size === 0) return next(new LoiUngDung(400, 'Tệp tài liệu rỗng'));
    if (!noiDungKhopDuoi(duoi, req.file.buffer)) {
      return next(new LoiUngDung(400, `Nội dung tệp không đúng định dạng ${duoi}`));
    }
    req.file.duoiTep = duoi;
    return next();
  });
}

module.exports = { taiTepTaiLieu, layDuoiTep, noiDungKhopDuoi, DUOI_TEP_HOP_LE, KICH_THUOC_TOI_DA };
