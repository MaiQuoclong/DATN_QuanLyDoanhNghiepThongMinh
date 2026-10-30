const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const LoiUngDung = require('../utils/LoiUngDung');
const ghiNhatKy = require('../utils/ghiNhatKy');
const nguoiDungRepository = require('../repositories/nguoiDungRepository');
const { layMocMatKhau, themNhatKy } = require('../repositories/nhatKyRepository');
const { chayTransaction } = require('../config/ketNoiCsdl');

const SO_VONG_BAM = 10;
const HAN_MAT_KHAU_TAM_GIAY = 24 * 60 * 60;
const THUAT_TOAN_JWT = 'HS256';
// Hash giả: vẫn chạy bcrypt.compare khi không có tài khoản để thời gian phản hồi không lộ tên đăng nhập
const HASH_GIA = '$2b$10$S2YqVioREd9xLdhLS6LWzeuQmLUNR2cwgZa0wDBc1WwE/C88T8Fbi';

function layBiMatJwt() {
  const biMat = process.env.JWT_BI_MAT;
  if (!biMat) throw new Error('Thiếu biến môi trường JWT_BI_MAT');
  return biMat;
}

function kyToken(thongTin) {
  return jwt.sign(
    // Chỉ mang danh tính; vai trò, nhanVienId, trạng thái do kiemTraPhien đọc lại từ CSDL
    { nguoiDungId: thongTin.nguoiDungId },
    layBiMatJwt(),
    { algorithm: THUAT_TOAN_JWT, expiresIn: process.env.JWT_HET_HAN || '8h' }
  );
}

// Schema không có cột cờ mật khẩu tạm: suy ra từ nhatkyhethong (docs/phan-quyen.md quy tắc 9).
// RESET_MAT_KHAU_TAM mới hơn DOI_MAT_KHAU -> bắt buộc đổi; quá 24 giờ kể từ lúc reset -> hết hạn.
async function kiemTraMatKhauTam(nguoiDungId) {
  const moc = await layMocMatKhau(nguoiDungId);
  const batBuocDoi = moc.idReset !== null && (moc.idDoi === null || moc.idReset > moc.idDoi);
  const hetHan = batBuocDoi && moc.giayTuReset > HAN_MAT_KHAU_TAM_GIAY;
  return { batBuocDoi, hetHan, giayTuThayDoiGanNhat: moc.giayTuThayDoiGanNhat };
}

// Gọi ở mọi request có token: token chỉ mang danh tính, còn trạng thái tài khoản, vai trò
// và cờ mật khẩu tạm luôn đọc lại từ CSDL để khóa/reset/gán quyền có hiệu lực ngay.
async function kiemTraPhien(token) {
  let noiDung;
  try {
    noiDung = jwt.verify(token, layBiMatJwt(), { algorithms: [THUAT_TOAN_JWT] });
  } catch (loi) {
    if (loi.name === 'TokenExpiredError') {
      throw new LoiUngDung(401, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
    }
    if (loi.name === 'JsonWebTokenError' || loi.name === 'NotBeforeError') {
      throw new LoiUngDung(401, 'Token không hợp lệ');
    }
    throw loi;
  }

  const { nguoiDungId } = noiDung;
  const [thongTin, vaiTro, matKhauTam] = await Promise.all([
    nguoiDungRepository.layThongTin(nguoiDungId),
    nguoiDungRepository.layDanhSachVaiTro(nguoiDungId),
    kiemTraMatKhauTam(nguoiDungId),
  ]);
  if (thongTin?.trangThai !== 'DANG_HOAT_DONG') {
    throw new LoiUngDung(401, 'Tài khoản đã bị khóa hoặc không còn tồn tại');
  }
  // Token phát hành trước lần đổi/reset mật khẩu gần nhất -> thu hồi (so bằng số giây, không phụ thuộc múi giờ).
  // Giả định Node và MySQL chạy cùng máy (đồng hồ khớp); dung sai 1 giây tránh thu hồi nhầm token vừa cấp.
  const tuoiToken = Math.floor(Date.now() / 1000) - noiDung.iat;
  if (matKhauTam.giayTuThayDoiGanNhat !== null && tuoiToken > matKhauTam.giayTuThayDoiGanNhat + 1) {
    throw new LoiUngDung(401, 'Mật khẩu đã thay đổi, vui lòng đăng nhập lại');
  }
  if (matKhauTam.hetHan) {
    throw new LoiUngDung(401, 'Mật khẩu tạm đã hết hạn (quá 24 giờ), vui lòng liên hệ HR hoặc Admin để cấp lại');
  }

  // nhanVienId đọc lại từ CSDL: hồ sơ có thể được liên kết sau khi token đã cấp
  return { nguoiDungId, nhanVienId: thongTin.nhanVienId, vaiTro, batBuocDoiMatKhau: matKhauTam.batBuocDoi };
}

async function dangNhap(tenDangNhap, matKhau, diaChiIP) {
  const taiKhoan = await nguoiDungRepository.timDeDangNhap(tenDangNhap);
  const dungMatKhau = await bcrypt.compare(matKhau, taiKhoan?.matKhauMaHoa ?? HASH_GIA);
  if (!taiKhoan || !dungMatKhau) {
    await ghiNhatKy(taiKhoan?.id ?? null, 'DANG_NHAP_THAT_BAI', diaChiIP, `tenDangNhap=${tenDangNhap}`);
    throw new LoiUngDung(401, 'Tên đăng nhập hoặc mật khẩu không đúng');
  }
  if (taiKhoan.trangThai !== 'DANG_HOAT_DONG') {
    await ghiNhatKy(taiKhoan.id, 'DANG_NHAP_BI_KHOA', diaChiIP);
    throw new LoiUngDung(403, 'Tài khoản đã bị khóa, vui lòng liên hệ quản trị viên');
  }

  const { batBuocDoi, hetHan } = await kiemTraMatKhauTam(taiKhoan.id);
  if (hetHan) {
    await ghiNhatKy(taiKhoan.id, 'DANG_NHAP_MAT_KHAU_TAM_HET_HAN', diaChiIP);
    throw new LoiUngDung(401, 'Mật khẩu tạm đã hết hạn (quá 24 giờ), vui lòng liên hệ HR hoặc Admin để cấp lại');
  }

  const [thongTin, vaiTro] = await Promise.all([
    nguoiDungRepository.layThongTin(taiKhoan.id),
    nguoiDungRepository.layDanhSachVaiTro(taiKhoan.id),
  ]);
  if (vaiTro.length === 0) {
    await ghiNhatKy(taiKhoan.id, 'DANG_NHAP_KHONG_VAI_TRO', diaChiIP);
    throw new LoiUngDung(403, 'Tài khoản chưa được gán vai trò');
  }

  await nguoiDungRepository.capNhatLanDangNhapCuoi(taiKhoan.id);
  await ghiNhatKy(taiKhoan.id, 'DANG_NHAP', diaChiIP);

  return {
    token: kyToken(thongTin),
    nguoiDung: { ...thongTin, vaiTro, batBuocDoiMatKhau: batBuocDoi },
  };
}

async function layThongTinCaNhan(nguoiDungId) {
  const [thongTin, vaiTro, { batBuocDoi }] = await Promise.all([
    nguoiDungRepository.layThongTin(nguoiDungId),
    nguoiDungRepository.layDanhSachVaiTro(nguoiDungId),
    kiemTraMatKhauTam(nguoiDungId),
  ]);
  if (!thongTin) throw new LoiUngDung(404, 'Không tìm thấy tài khoản');
  return { ...thongTin, vaiTro, batBuocDoiMatKhau: batBuocDoi };
}

async function doiMatKhau(nguoiDungId, matKhauCu, matKhauMoi, diaChiIP) {
  const matKhauMaHoa = await nguoiDungRepository.layMatKhauMaHoa(nguoiDungId);
  if (!matKhauMaHoa) throw new LoiUngDung(404, 'Không tìm thấy tài khoản');
  if ((await kiemTraMatKhauTam(nguoiDungId)).hetHan) {
    throw new LoiUngDung(401, 'Mật khẩu tạm đã hết hạn (quá 24 giờ), vui lòng liên hệ HR hoặc Admin để cấp lại');
  }
  if (!(await bcrypt.compare(matKhauCu, matKhauMaHoa))) {
    throw new LoiUngDung(400, 'Mật khẩu hiện tại không đúng');
  }
  if (matKhauCu === matKhauMoi) {
    throw new LoiUngDung(400, 'Mật khẩu mới phải khác mật khẩu hiện tại');
  }

  const matKhauMoiMaHoa = await bcrypt.hash(matKhauMoi, SO_VONG_BAM);
  // Transaction: bản ghi DOI_MAT_KHAU quyết định cờ mật khẩu tạm nên phải ghi cùng lúc với mật khẩu
  await chayTransaction(async (ketNoi) => {
    await nguoiDungRepository.capNhatMatKhau(nguoiDungId, matKhauMoiMaHoa, ketNoi);
    await themNhatKy(nguoiDungId, 'DOI_MAT_KHAU', diaChiIP ?? null, null, ketNoi);
  });

  // Token cũ bị thu hồi theo mốc DOI_MAT_KHAU, cấp token mới cho phiên hiện tại
  const nguoiDung = await layThongTinCaNhan(nguoiDungId);
  return { token: kyToken(nguoiDung), nguoiDung };
}

async function dangXuat(nguoiDungId, diaChiIP) {
  await ghiNhatKy(nguoiDungId, 'DANG_XUAT', diaChiIP);
}

module.exports = { dangNhap, kiemTraPhien, layThongTinCaNhan, doiMatKhau, dangXuat, kiemTraMatKhauTam };
