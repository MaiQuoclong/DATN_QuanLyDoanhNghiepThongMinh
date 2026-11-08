const LoiUngDung = require('../utils/LoiUngDung');
const { chayTransaction } = require('../config/ketNoiCsdl');
const { THAM_SO_KPI } = require('../config/thamSoNghiepVu');
const kpiRepository = require('../repositories/kpiRepository');
const phongBanRepository = require('../repositories/phongBanRepository');
const nhanVienRepository = require('../repositories/nhanVienRepository');
const nhatKyRepository = require('../repositories/nhatKyRepository');
const { laNgayHopLe } = require('../middlewares/kiemTraDuLieu');

// Quyền theo docs/phan-quyen.md mục 8 (Đánh giá KPI)
const TRANG_THAI_DUOC_DANH_GIA = ['THU_VIEC', 'CHINH_THUC'];

const laHR = (nd) => nd.vaiTro.includes('HR');
const laGiamDoc = (nd) => nd.vaiTro.includes('giamDoc');
const laQuanLy = (nd) => nd.vaiTro.includes('quanLy');

// null = toàn công ty (HR, giamDoc); mảng = phòng quanLy phụ trách (kể cả phòng con); [] = không thấy gì
async function layPhamViXem(nguoiDung, ketNoi) {
  if (laHR(nguoiDung) || laGiamDoc(nguoiDung)) return null;
  if (laQuanLy(nguoiDung)) return phongBanRepository.layPhongBanQuanLy(nguoiDung.nhanVienId ?? 0, ketNoi);
  return [];
}

// Phạm vi quản trị chỉ tiêu / tạo phiếu: HR toàn công ty, quanLy phòng mình (giamDoc chỉ xem)
async function layPhamViQuanTri(nguoiDung, ketNoi) {
  if (laHR(nguoiDung)) return null;
  if (laQuanLy(nguoiDung)) return phongBanRepository.layPhongBanQuanLy(nguoiDung.nhanVienId ?? 0, ketNoi);
  return [];
}

const trongPhamVi = (phamVi, phongBanId) => phamVi === null || (phongBanId != null && phamVi.includes(phongBanId));

function layChuoi(giaTri, nhan, { batBuoc = false, toiDa = 255, toiThieu = 0 } = {}) {
  if (giaTri === undefined || giaTri === null || (typeof giaTri === 'string' && giaTri.trim() === '')) {
    if (batBuoc) throw new LoiUngDung(400, `${nhan} không được để trống`);
    return null;
  }
  if (typeof giaTri !== 'string') throw new LoiUngDung(400, `${nhan} phải là chuỗi ký tự`);
  const kq = giaTri.trim();
  if (kq.length < toiThieu) throw new LoiUngDung(400, `${nhan} phải có ít nhất ${toiThieu} ký tự`);
  if (kq.length > toiDa) throw new LoiUngDung(400, `${nhan} không được vượt quá ${toiDa} ký tự`);
  return kq;
}

// Số thập phân tối đa 2 chữ số trong [toiThieu, toiDa] (DECIMAL(4,2) điểm, DECIMAL(5,2) trọng số)
function laySoThapPhan(giaTri, nhan, toiThieu, toiDa) {
  const so = typeof giaTri === 'string' && giaTri.trim() !== '' ? Number(giaTri) : giaTri;
  if (typeof so !== 'number' || !Number.isFinite(so) || so < toiThieu || so > toiDa || Math.round(so * 100) !== so * 100) {
    throw new LoiUngDung(400, `${nhan} phải là số từ ${toiThieu} đến ${toiDa}, tối đa 2 chữ số thập phân`);
  }
  return so;
}
const layDiem = (giaTri, nhan) => laySoThapPhan(giaTri, nhan, 0, THAM_SO_KPI.diemToiDa);
const layTrongSo = (giaTri, nhan = 'Trọng số') => laySoThapPhan(giaTri, nhan, 0.01, THAM_SO_KPI.trongSoToiDa);

function xepLoaiTheoDiem(diem) {
  return THAM_SO_KPI.nguongXepLoai.find(([nguong]) => diem >= nguong)[1];
}

function canHoSo(nguoiDung) {
  if (!nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Tài khoản chưa có hồ sơ nhân viên nên không thể dùng chức năng KPI');
}

async function thoiGianHienTai(ketNoi) {
  const [[d]] = await ketNoi.query('SELECT NOW() AS bayGio');
  return d.bayGio;
}

// ===================== Kỳ đánh giá (HR mở/đóng) =====================

function kiemTraKhoangNgay(ngayBatDau, ngayKetThuc) {
  if (!laNgayHopLe(ngayBatDau) || !laNgayHopLe(ngayKetThuc)) throw new LoiUngDung(400, 'Ngày phải là ngày hợp lệ dạng YYYY-MM-DD');
  if (ngayKetThuc <= ngayBatDau) throw new LoiUngDung(400, 'Ngày kết thúc phải sau ngày bắt đầu');
}

function layDanhSachKy(boLoc) {
  return kpiRepository.layDanhSachKy(boLoc);
}

async function layChiTietKy(id) {
  const ky = await kpiRepository.layKyTheoId(id);
  if (!ky) throw new LoiUngDung(404, 'Không tìm thấy kỳ đánh giá');
  return ky;
}

async function themKy(nguoiDung, body, diaChiIP) {
  const tenKyDanhGia = layChuoi(body.tenKyDanhGia, 'Tên kỳ đánh giá', { batBuoc: true, toiDa: 100, toiThieu: 3 });
  kiemTraKhoangNgay(body.ngayBatDau, body.ngayKetThuc);
  return chayTransaction(async (ketNoi) => {
    if (await kpiRepository.timKyTheoTen(tenKyDanhGia, 0, ketNoi)) throw new LoiUngDung(409, 'Tên kỳ đánh giá đã tồn tại');
    const id = await kpiRepository.themKy({ tenKyDanhGia, ngayBatDau: body.ngayBatDau, ngayKetThuc: body.ngayKetThuc }, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'MO_KY_KPI', diaChiIP, tenKyDanhGia, ketNoi);
    return kpiRepository.layKyTheoId(id, ketNoi);
  });
}

async function suaKy(nguoiDung, id, body, diaChiIP) {
  return chayTransaction(async (ketNoi) => {
    const ky = await kpiRepository.khoaKy(id, ketNoi);
    if (!ky) throw new LoiUngDung(404, 'Không tìm thấy kỳ đánh giá');
    if (ky.trangThai !== 'DANG_MO') throw new LoiUngDung(409, 'Kỳ đánh giá đã đóng, mở lại kỳ trước khi sửa');
    const moi = {};
    if (body.tenKyDanhGia !== undefined) moi.tenKyDanhGia = layChuoi(body.tenKyDanhGia, 'Tên kỳ đánh giá', { batBuoc: true, toiDa: 100, toiThieu: 3 });
    if (body.ngayBatDau !== undefined) moi.ngayBatDau = body.ngayBatDau;
    if (body.ngayKetThuc !== undefined) moi.ngayKetThuc = body.ngayKetThuc;
    const thayDoi = Object.fromEntries(Object.entries(moi).filter(([k, v]) => v !== ky[k]));
    if (!Object.keys(thayDoi).length) throw new LoiUngDung(400, 'Không có thông tin nào thay đổi');
    kiemTraKhoangNgay(thayDoi.ngayBatDau ?? ky.ngayBatDau, thayDoi.ngayKetThuc ?? ky.ngayKetThuc);
    if (thayDoi.tenKyDanhGia && await kpiRepository.timKyTheoTen(thayDoi.tenKyDanhGia, id, ketNoi)) {
      throw new LoiUngDung(409, 'Tên kỳ đánh giá đã tồn tại');
    }
    await kpiRepository.capNhatKy(id, thayDoi, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'SUA_KY_KPI', diaChiIP, `${id}: ${Object.keys(thayDoi).join(', ')}`, ketNoi);
    return kpiRepository.layKyTheoId(id, ketNoi);
  });
}

// Đóng kỳ: không còn phiếu chờ nghiệm thu (tránh treo phiếu đã gửi). Phiếu nháp giữ nguyên, không chấm tiếp được.
async function dongKy(nguoiDung, id, diaChiIP) {
  return chayTransaction(async (ketNoi) => {
    const ky = await kpiRepository.khoaKy(id, ketNoi);
    if (!ky) throw new LoiUngDung(404, 'Không tìm thấy kỳ đánh giá');
    if (ky.trangThai === 'DA_DONG') throw new LoiUngDung(409, 'Kỳ đánh giá đã đóng');
    const soChoDuyet = await kpiRepository.demPhieuTheoTrangThai(id, 'CHO_DUYET', ketNoi);
    if (soChoDuyet) throw new LoiUngDung(409, `Còn ${soChoDuyet} phiếu chờ nghiệm thu, cần nghiệm thu hoặc trả lại trước khi đóng kỳ`);
    await kpiRepository.capNhatKy(id, { trangThai: 'DA_DONG' }, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'DONG_KY_KPI', diaChiIP, ky.tenKyDanhGia, ketNoi);
    return kpiRepository.layKyTheoId(id, ketNoi);
  });
}

async function moLaiKy(nguoiDung, id, diaChiIP) {
  return chayTransaction(async (ketNoi) => {
    const ky = await kpiRepository.khoaKy(id, ketNoi);
    if (!ky) throw new LoiUngDung(404, 'Không tìm thấy kỳ đánh giá');
    if (ky.trangThai === 'DANG_MO') throw new LoiUngDung(409, 'Kỳ đánh giá đang mở');
    await kpiRepository.capNhatKy(id, { trangThai: 'DANG_MO' }, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'MO_LAI_KY_KPI', diaChiIP, ky.tenKyDanhGia, ketNoi);
    return kpiRepository.layKyTheoId(id, ketNoi);
  });
}

// Chỉ xóa kỳ chưa có phiếu nào (tạo nhầm)
async function xoaKy(nguoiDung, id, diaChiIP) {
  return chayTransaction(async (ketNoi) => {
    const ky = await kpiRepository.khoaKy(id, ketNoi);
    if (!ky) throw new LoiUngDung(404, 'Không tìm thấy kỳ đánh giá');
    if (await kpiRepository.demPhieuCuaKy(id, ketNoi)) throw new LoiUngDung(409, 'Kỳ đã có phiếu đánh giá, không thể xóa (có thể đóng kỳ)');
    await kpiRepository.xoaKy(id, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'XOA_KY_KPI', diaChiIP, ky.tenKyDanhGia, ketNoi);
  });
}

// ===================== Chỉ tiêu KPI (HR toàn công ty, quanLy phòng mình) =====================

async function layDanhSachChiTieu(nguoiDung, boLoc) {
  return kpiRepository.layDanhSachChiTieu({ ...boLoc, phamViPhongBanIds: await layPhamViXem(nguoiDung) });
}

async function layViTriGanChiTieu(nguoiDung) {
  return kpiRepository.layViTriGanChiTieu(await layPhamViQuanTri(nguoiDung));
}

// Vị trí của chỉ tiêu: null = chỉ tiêu chung (chỉ HR); quanLy bắt buộc chọn vị trí thuộc phòng mình
async function kiemTraViTriChiTieu(nguoiDung, chucDanhPhongBanId, phamVi, ketNoi) {
  if (chucDanhPhongBanId === null) {
    if (phamVi !== null) throw new LoiUngDung(403, 'Chỉ HR được định nghĩa chỉ tiêu chung toàn công ty');
    return;
  }
  const viTri = await phongBanRepository.khoaViTri(chucDanhPhongBanId, ketNoi);
  if (!viTri) throw new LoiUngDung(404, 'Không tìm thấy vị trí (chức danh trong phòng ban)');
  if (!trongPhamVi(phamVi, viTri.phongBanId)) throw new LoiUngDung(403, 'Vị trí không thuộc phòng ban bạn phụ trách');
  if (viTri.trangThai !== 'DANG_AP_DUNG') throw new LoiUngDung(400, 'Vị trí đã ngừng áp dụng');
}

function layViTriTuBody(giaTri) {
  if (giaTri === undefined || giaTri === null || giaTri === '') return null;
  if (!/^[1-9]\d{0,9}$/.test(String(giaTri))) throw new LoiUngDung(400, 'Vị trí phải là số nguyên dương');
  return Number(giaTri);
}

async function themChiTieu(nguoiDung, body, diaChiIP) {
  const maChiTieu = layChuoi(body.maChiTieu, 'Mã chỉ tiêu', { batBuoc: true, toiDa: 30 }).toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(maChiTieu)) throw new LoiUngDung(400, 'Mã chỉ tiêu chỉ gồm chữ, số, dấu gạch ngang và gạch dưới');
  const chiTieu = {
    maChiTieu,
    tenChiTieu: layChuoi(body.tenChiTieu, 'Tên chỉ tiêu', { batBuoc: true, toiDa: 150 }),
    moTa: layChuoi(body.moTa, 'Mô tả', { toiDa: 2000 }),
    donViDo: layChuoi(body.donViDo, 'Đơn vị đo', { toiDa: 50 }),
    trongSoMacDinh: body.trongSoMacDinh === undefined || body.trongSoMacDinh === '' ? 1 : layTrongSo(body.trongSoMacDinh, 'Trọng số mặc định'),
    chucDanhPhongBanId: layViTriTuBody(body.chucDanhPhongBanId),
  };
  return chayTransaction(async (ketNoi) => {
    const phamVi = await layPhamViQuanTri(nguoiDung, ketNoi);
    await kiemTraViTriChiTieu(nguoiDung, chiTieu.chucDanhPhongBanId, phamVi, ketNoi);
    let id;
    try {
      id = await kpiRepository.themChiTieu(chiTieu, ketNoi);
    } catch (loi) {
      if (loi.code === 'ER_DUP_ENTRY') throw new LoiUngDung(409, `Mã chỉ tiêu ${maChiTieu} đã tồn tại`);
      throw loi;
    }
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'THEM_CHI_TIEU_KPI', diaChiIP, maChiTieu, ketNoi);
    return kpiRepository.layChiTieuTheoId(id, ketNoi);
  });
}

// Kiểm tra quyền trên chỉ tiêu hiện có (không thuộc phạm vi -> 404 như các module khác)
async function kiemTraQuyenChiTieu(nguoiDung, id, ketNoi) {
  if (!await kpiRepository.khoaChiTieu(id, ketNoi)) throw new LoiUngDung(404, 'Không tìm thấy chỉ tiêu KPI');
  const chiTieu = await kpiRepository.layChiTieuTheoId(id, ketNoi);
  const phamVi = await layPhamViQuanTri(nguoiDung, ketNoi);
  if (chiTieu.chucDanhPhongBanId === null) {
    if (phamVi !== null) throw new LoiUngDung(403, 'Chỉ HR được sửa chỉ tiêu chung toàn công ty');
  } else if (!trongPhamVi(phamVi, chiTieu.phongBanId)) {
    throw new LoiUngDung(404, 'Không tìm thấy chỉ tiêu KPI');
  }
  return { chiTieu, phamVi };
}

// Sửa không ảnh hưởng phiếu đã tạo (trọng số đã chép vào chitietdanhgiakpi); đổi vị trí chỉ khi chưa dùng
async function suaChiTieu(nguoiDung, id, body, diaChiIP) {
  return chayTransaction(async (ketNoi) => {
    const { chiTieu, phamVi } = await kiemTraQuyenChiTieu(nguoiDung, id, ketNoi);
    const moi = {};
    if (body.tenChiTieu !== undefined) moi.tenChiTieu = layChuoi(body.tenChiTieu, 'Tên chỉ tiêu', { batBuoc: true, toiDa: 150 });
    if (body.moTa !== undefined) moi.moTa = layChuoi(body.moTa, 'Mô tả', { toiDa: 2000 });
    if (body.donViDo !== undefined) moi.donViDo = layChuoi(body.donViDo, 'Đơn vị đo', { toiDa: 50 });
    if (body.trongSoMacDinh !== undefined) moi.trongSoMacDinh = layTrongSo(body.trongSoMacDinh, 'Trọng số mặc định');
    if (body.chucDanhPhongBanId !== undefined) moi.chucDanhPhongBanId = layViTriTuBody(body.chucDanhPhongBanId);
    const thayDoi = Object.fromEntries(Object.entries(moi).filter(([k, v]) => (k === 'trongSoMacDinh' ? v !== Number(chiTieu[k]) : v !== chiTieu[k])));
    if (!Object.keys(thayDoi).length) throw new LoiUngDung(400, 'Không có thông tin nào thay đổi');
    if (thayDoi.chucDanhPhongBanId !== undefined) {
      if (chiTieu.soLanSuDung > 0) throw new LoiUngDung(409, 'Chỉ tiêu đã được dùng trong phiếu đánh giá, không thể đổi vị trí');
      await kiemTraViTriChiTieu(nguoiDung, thayDoi.chucDanhPhongBanId, phamVi, ketNoi);
    }
    await kpiRepository.capNhatChiTieu(id, thayDoi, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'SUA_CHI_TIEU_KPI', diaChiIP,
      `${chiTieu.maChiTieu}: ${Object.keys(thayDoi).join(', ')}`, ketNoi);
    return kpiRepository.layChiTieuTheoId(id, ketNoi);
  });
}

async function xoaChiTieu(nguoiDung, id, diaChiIP) {
  return chayTransaction(async (ketNoi) => {
    const { chiTieu } = await kiemTraQuyenChiTieu(nguoiDung, id, ketNoi);
    if (await kpiRepository.demLanSuDungChiTieu(id, ketNoi)) {
      throw new LoiUngDung(409, 'Chỉ tiêu đã được dùng trong phiếu đánh giá, không thể xóa');
    }
    await kpiRepository.xoaChiTieu(id, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'XOA_CHI_TIEU_KPI', diaChiIP, chiTieu.maChiTieu, ketNoi);
  });
}

// ===================== Phiếu đánh giá =====================

// Người nghiệm thu (docs/phan-quyen.md mục 8, quy tắc 1):
// - Không ai nghiệm thu phiếu của chính mình.
// - giamDoc: nghiệm thu trưởng bộ phận và mọi phiếu khác (cấp cao nhất, kể cả phòng không có quản lý).
// - quanLy: nhân viên thuộc phòng mình phụ trách (kể cả phòng con), trừ người đang làm trưởng bộ phận.
function duocNghiemThu(nguoiDung, phieu, phamViQuanLy) {
  if (!nguoiDung.nhanVienId || phieu.nhanVienId === nguoiDung.nhanVienId) return false;
  if (laGiamDoc(nguoiDung)) return true;
  return laQuanLy(nguoiDung) && !phieu.laTruongBoPhan && Array.isArray(phamViQuanLy) && phamViQuanLy.includes(phieu.phongBanId);
}

async function layPhamViQuanLy(nguoiDung, ketNoi) {
  return laQuanLy(nguoiDung) ? phongBanRepository.layPhongBanQuanLy(nguoiDung.nhanVienId ?? 0, ketNoi) : [];
}

// Quyền tạo/sửa/xóa phiếu nháp: HR toàn công ty, quanLy phòng mình; không thao tác phiếu của chính mình
function duocQuanTriPhieu(nguoiDung, phieu, phamViQuanTri) {
  if (phieu.nhanVienId === nguoiDung.nhanVienId) return false;
  return phamViQuanTri === null || (Array.isArray(phamViQuanTri) && phamViQuanTri.includes(phieu.phongBanId));
}

async function themQuyen(nguoiDung, phieu, ketNoi) {
  const [phamViQuanLy, phamViQuanTri] = await Promise.all([layPhamViQuanLy(nguoiDung, ketNoi), layPhamViQuanTri(nguoiDung, ketNoi)]);
  const kyMo = phieu.trangThaiKy === 'DANG_MO';
  return {
    ...phieu,
    quyen: {
      tuCham: kyMo && phieu.trangThai === 'BAN_NHAP' && phieu.nhanVienId === nguoiDung.nhanVienId,
      nghiemThu: kyMo && phieu.trangThai === 'CHO_DUYET' && duocNghiemThu(nguoiDung, phieu, phamViQuanLy),
      quanTri: kyMo && phieu.trangThai === 'BAN_NHAP' && duocQuanTriPhieu(nguoiDung, phieu, phamViQuanTri),
    },
  };
}

async function layDanhSachPhieu(nguoiDung, boLoc) {
  const phamViPhongBanIds = await layPhamViXem(nguoiDung);
  const { items, tongSo } = await kpiRepository.layDanhSachPhieu({ ...boLoc, phamViPhongBanIds });
  const phamViQuanLy = await layPhamViQuanLy(nguoiDung);
  return {
    items: items.map((p) => ({ ...p, duocNghiemThu: p.trangThaiKy === 'DANG_MO' && p.trangThai === 'CHO_DUYET' && duocNghiemThu(nguoiDung, p, phamViQuanLy) })),
    phanTrang: { trang: boLoc.trang, kichThuoc: boLoc.kichThuoc, tongSo },
  };
}

async function layPhieuCuaToi(nguoiDung, boLoc) {
  canHoSo(nguoiDung);
  const { items } = await kpiRepository.layDanhSachPhieu({ ...boLoc, nhanVienId: nguoiDung.nhanVienId });
  return items;
}

// Xem chi tiết: chính mình, HR/giamDoc toàn bộ, quanLy phòng mình; ngoài phạm vi trả 404 (không lộ sự tồn tại)
async function layPhieuDuocXem(nguoiDung, id, ketNoi) {
  const phieu = await kpiRepository.layPhieuTheoId(id, ketNoi);
  if (!phieu) throw new LoiUngDung(404, 'Không tìm thấy phiếu đánh giá KPI');
  if (phieu.nhanVienId !== nguoiDung.nhanVienId && !trongPhamVi(await layPhamViXem(nguoiDung, ketNoi), phieu.phongBanId)) {
    throw new LoiUngDung(404, 'Không tìm thấy phiếu đánh giá KPI');
  }
  return phieu;
}

async function layChiTietPhieu(nguoiDung, id, ketNoi) {
  const phieu = await layPhieuDuocXem(nguoiDung, id, ketNoi);
  const chiTiet = await kpiRepository.layChiTietPhieu(id, ketNoi);
  return themQuyen(nguoiDung, { ...phieu, chiTiet }, ketNoi);
}

// Khóa kỳ (chia sẻ) rồi phiếu, kiểm tra kỳ đang mở và trạng thái phiếu mong đợi
async function khoaPhieuTrongKyMo(nguoiDung, id, trangThaiMongDoi, ketNoi) {
  const phieuGoc = await layPhieuDuocXem(nguoiDung, id, ketNoi);
  const ky = await kpiRepository.khoaKy(phieuGoc.kyDanhGiaId, ketNoi, 'SHARE');
  const khoa = await kpiRepository.khoaPhieu(id, ketNoi);
  if (!khoa) throw new LoiUngDung(404, 'Không tìm thấy phiếu đánh giá KPI');
  if (ky.trangThai !== 'DANG_MO') throw new LoiUngDung(409, 'Kỳ đánh giá đã đóng, không thể thay đổi phiếu');
  if (khoa.trangThai !== trangThaiMongDoi) {
    const nhan = { BAN_NHAP: 'bản nháp', CHO_DUYET: 'chờ nghiệm thu', DA_DUYET: 'đã nghiệm thu' };
    throw new LoiUngDung(409, `Phiếu đang ở trạng thái ${nhan[khoa.trangThai] ?? khoa.trangThai}, không thể thực hiện thao tác này`);
  }
  const phieu = await kpiRepository.layPhieuTheoId(id, ketNoi);
  return { phieu, chiTiet: await kpiRepository.layChiTietPhieu(id, ketNoi) };
}

// Đọc mảng chiTiet [{ id, ...}] và đối chiếu với chi tiết của phiếu
function layDanhSachChiTietBody(body, chiTietPhieu, { batBuocDu = false } = {}) {
  const ds = body?.chiTiet;
  if (!Array.isArray(ds) || !ds.length) throw new LoiUngDung(400, 'Danh sách chỉ tiêu (chiTiet) không được để trống');
  const theoId = new Map(chiTietPhieu.map((c) => [c.id, c]));
  const daGap = new Set();
  for (const muc of ds) {
    if (!muc || typeof muc !== 'object' || !theoId.has(muc.id)) throw new LoiUngDung(400, 'Chỉ tiêu không thuộc phiếu đánh giá này');
    if (daGap.has(muc.id)) throw new LoiUngDung(400, 'Một chỉ tiêu bị gửi lặp lại');
    daGap.add(muc.id);
  }
  if (batBuocDu && daGap.size !== chiTietPhieu.length) throw new LoiUngDung(400, 'Cần chấm đủ tất cả chỉ tiêu của phiếu');
  return ds.map((muc) => ({ muc, goc: theoId.get(muc.id) }));
}

async function kiemTraNhanVienDuocDanhGia(nhanVienId, phamVi, nguoiDung, ketNoi) {
  if (nhanVienId === nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Không được tự tạo phiếu đánh giá cho chính mình');
  const nv = await nhanVienRepository.layTheoId(nhanVienId, ketNoi);
  if (!nv) throw new LoiUngDung(404, 'Không tìm thấy nhân viên');
  const phongBanId = nv.chucDanhPhongBanId ? await phongBanRepository.layPhongBanCuaViTri(nv.chucDanhPhongBanId, ketNoi) : null;
  if (!trongPhamVi(phamVi, phongBanId)) throw new LoiUngDung(404, 'Không tìm thấy nhân viên');
  if (!TRANG_THAI_DUOC_DANH_GIA.includes(nv.trangThaiLamViec)) throw new LoiUngDung(400, 'Chỉ đánh giá nhân viên đang thử việc hoặc chính thức');
  if (!nv.chucDanhPhongBanId) throw new LoiUngDung(400, 'Nhân viên chưa được gán vị trí nên chưa có chỉ tiêu KPI');
  // giamDoc là cấp nghiệm thu cao nhất, không có ai trong hệ thống nghiệm thu phiếu của giamDoc -> không đánh giá
  if (await kpiRepository.laGiamDoc(nhanVienId, ketNoi)) throw new LoiUngDung(400, 'Không đánh giá KPI cho Ban Giám đốc (không có cấp nghiệm thu)');
  return nv;
}

// Phiếu sinh ở BAN_NHAP, chi tiết chép từ chỉ tiêu của vị trí + chỉ tiêu chung (trọng số mặc định)
async function taoPhieu(nguoiDung, body, diaChiIP) {
  canHoSo(nguoiDung);
  const kyDanhGiaId = Number(body.kyDanhGiaId);
  const nhanVienId = Number(body.nhanVienId);
  return chayTransaction(async (ketNoi) => {
    const ky = await kpiRepository.khoaKy(kyDanhGiaId, ketNoi, 'SHARE');
    if (!ky) throw new LoiUngDung(404, 'Không tìm thấy kỳ đánh giá');
    if (ky.trangThai !== 'DANG_MO') throw new LoiUngDung(409, 'Kỳ đánh giá đã đóng');
    const phamVi = await layPhamViQuanTri(nguoiDung, ketNoi);
    const nv = await kiemTraNhanVienDuocDanhGia(nhanVienId, phamVi, nguoiDung, ketNoi);
    const cacChiTieu = await kpiRepository.layChiTieuChoViTri(nv.chucDanhPhongBanId, ketNoi);
    if (!cacChiTieu.length) throw new LoiUngDung(400, 'Vị trí của nhân viên chưa có chỉ tiêu KPI nào, cần định nghĩa chỉ tiêu trước');
    let id;
    try {
      id = await kpiRepository.themPhieu(kyDanhGiaId, nhanVienId, ketNoi);
    } catch (loi) {
      if (loi.code === 'ER_DUP_ENTRY') throw new LoiUngDung(409, 'Nhân viên đã có phiếu đánh giá trong kỳ này');
      throw loi;
    }
    await kpiRepository.themChiTietPhieu(id, cacChiTieu, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'TAO_PHIEU_KPI', diaChiIP, `${ky.tenKyDanhGia}: ${nv.maNhanVien}`, ketNoi);
    return layChiTietPhieu(nguoiDung, id, ketNoi);
  });
}

// Tạo hàng loạt cho mọi nhân viên trong phạm vi chưa có phiếu (bỏ qua chính mình và người chưa có chỉ tiêu)
async function taoPhieuHangLoat(nguoiDung, body, diaChiIP) {
  canHoSo(nguoiDung);
  const kyDanhGiaId = Number(body.kyDanhGiaId);
  const phongBanId = body.phongBanId ? Number(body.phongBanId) : undefined;
  return chayTransaction(async (ketNoi) => {
    const ky = await kpiRepository.khoaKy(kyDanhGiaId, ketNoi, 'SHARE');
    if (!ky) throw new LoiUngDung(404, 'Không tìm thấy kỳ đánh giá');
    if (ky.trangThai !== 'DANG_MO') throw new LoiUngDung(409, 'Kỳ đánh giá đã đóng');
    const phamVi = await layPhamViQuanTri(nguoiDung, ketNoi);
    if (phongBanId && !trongPhamVi(phamVi, phongBanId)) throw new LoiUngDung(403, 'Phòng ban không thuộc phạm vi bạn phụ trách');
    const dsNhanVien = await kpiRepository.layNhanVienChuaCoPhieu(kyDanhGiaId,
      { phongBanId, phamViPhongBanIds: phamVi, boQuaNhanVienId: nguoiDung.nhanVienId }, ketNoi);
    const chiTieuTheoViTri = new Map();
    let soPhieuTao = 0;
    let soBoQua = 0;
    for (const nv of dsNhanVien) {
      if (!chiTieuTheoViTri.has(nv.chucDanhPhongBanId)) {
        chiTieuTheoViTri.set(nv.chucDanhPhongBanId, await kpiRepository.layChiTieuChoViTri(nv.chucDanhPhongBanId, ketNoi));
      }
      const cacChiTieu = chiTieuTheoViTri.get(nv.chucDanhPhongBanId);
      if (!cacChiTieu.length) { soBoQua += 1; continue; }
      let id;
      try {
        id = await kpiRepository.themPhieu(kyDanhGiaId, nv.id, ketNoi);
      } catch (loi) {
        // Người khác vừa tạo phiếu cho cùng nhân viên (kỳ chỉ khóa chia sẻ) -> rollback cả lô, báo thử lại
        if (loi.code === 'ER_DUP_ENTRY') throw new LoiUngDung(409, 'Một số nhân viên vừa được tạo phiếu, vui lòng thử lại');
        throw loi;
      }
      await kpiRepository.themChiTietPhieu(id, cacChiTieu, ketNoi);
      soPhieuTao += 1;
    }
    if (soPhieuTao) {
      await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'TAO_PHIEU_KPI', diaChiIP, `${ky.tenKyDanhGia}: ${soPhieuTao} phiếu`, ketNoi);
    }
    return { soPhieuTao, soBoQuaChuaCoChiTieu: soBoQua };
  });
}

// Người tạo (HR/quanLy) chỉnh mục tiêu và trọng số khi phiếu còn nháp
async function suaPhieu(nguoiDung, id, body, diaChiIP) {
  return chayTransaction(async (ketNoi) => {
    const { phieu, chiTiet } = await khoaPhieuTrongKyMo(nguoiDung, id, 'BAN_NHAP', ketNoi);
    if (!duocQuanTriPhieu(nguoiDung, phieu, await layPhamViQuanTri(nguoiDung, ketNoi))) {
      throw new LoiUngDung(403, 'Bạn không có quyền sửa mục tiêu của phiếu này');
    }
    let soMucThayDoi = 0;
    for (const { muc } of layDanhSachChiTietBody(body, chiTiet)) {
      const thayDoi = {};
      if (muc.mucTieu !== undefined) thayDoi.mucTieu = layChuoi(muc.mucTieu, 'Mục tiêu');
      if (muc.trongSo !== undefined) thayDoi.trongSo = layTrongSo(muc.trongSo);
      if (!Object.keys(thayDoi).length) continue;
      soMucThayDoi += 1;
      await kpiRepository.capNhatChiTiet(id, muc.id, thayDoi, ketNoi);
    }
    if (!soMucThayDoi) throw new LoiUngDung(400, 'Không có thông tin nào thay đổi');
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'SUA_PHIEU_KPI', diaChiIP, `${phieu.tenKyDanhGia}: ${phieu.maNhanVien}`, ketNoi);
    return layChiTietPhieu(nguoiDung, id, ketNoi);
  });
}

async function xoaPhieu(nguoiDung, id, diaChiIP) {
  return chayTransaction(async (ketNoi) => {
    const { phieu } = await khoaPhieuTrongKyMo(nguoiDung, id, 'BAN_NHAP', ketNoi);
    if (!duocQuanTriPhieu(nguoiDung, phieu, await layPhamViQuanTri(nguoiDung, ketNoi))) {
      throw new LoiUngDung(403, 'Bạn không có quyền xóa phiếu này');
    }
    await kpiRepository.xoaPhieu(id, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'XOA_PHIEU_KPI', diaChiIP, `${phieu.tenKyDanhGia}: ${phieu.maNhanVien}`, ketNoi);
  });
}

function kiemTraChinhChu(nguoiDung, phieu) {
  if (phieu.nhanVienId !== nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Chỉ nhân viên được đánh giá mới tự chấm phiếu này');
}

// Nhân viên lưu nháp tự chấm: kết quả thực tế, điểm tự chấm, giải trình
async function tuCham(nguoiDung, id, body) {
  canHoSo(nguoiDung);
  return chayTransaction(async (ketNoi) => {
    const { phieu, chiTiet } = await khoaPhieuTrongKyMo(nguoiDung, id, 'BAN_NHAP', ketNoi);
    kiemTraChinhChu(nguoiDung, phieu);
    if (body?.giaiTrinhNhanVien !== undefined) {
      await kpiRepository.capNhatPhieu(id, { giaiTrinhNhanVien: layChuoi(body.giaiTrinhNhanVien, 'Giải trình', { toiDa: 5000 }) }, ketNoi);
    }
    if (body?.chiTiet !== undefined) {
      for (const { muc } of layDanhSachChiTietBody(body, chiTiet)) {
        const thayDoi = {};
        if (muc.ketQuaThucTe !== undefined) thayDoi.ketQuaThucTe = layChuoi(muc.ketQuaThucTe, 'Kết quả thực tế');
        if (muc.diemTuCham !== undefined) {
          thayDoi.diemTuCham = muc.diemTuCham === null || muc.diemTuCham === '' ? null : layDiem(muc.diemTuCham, 'Điểm tự chấm');
        }
        await kpiRepository.capNhatChiTiet(id, muc.id, thayDoi, ketNoi);
      }
    } else if (body?.giaiTrinhNhanVien === undefined) {
      throw new LoiUngDung(400, 'Không có thông tin nào thay đổi');
    }
    return layChiTietPhieu(nguoiDung, id, ketNoi);
  });
}

async function guiDuyet(nguoiDung, id, diaChiIP) {
  canHoSo(nguoiDung);
  return chayTransaction(async (ketNoi) => {
    const { phieu, chiTiet } = await khoaPhieuTrongKyMo(nguoiDung, id, 'BAN_NHAP', ketNoi);
    kiemTraChinhChu(nguoiDung, phieu);
    const thieu = chiTiet.filter((c) => c.diemTuCham === null);
    if (thieu.length) throw new LoiUngDung(400, `Còn ${thieu.length} chỉ tiêu chưa tự chấm điểm`);
    await kpiRepository.capNhatPhieu(id, { trangThai: 'CHO_DUYET' }, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'GUI_PHIEU_KPI', diaChiIP, phieu.tenKyDanhGia, ketNoi);
    return layChiTietPhieu(nguoiDung, id, ketNoi);
  });
}

async function kiemTraNguoiNghiemThu(nguoiDung, phieu, ketNoi) {
  if (!nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Tài khoản chưa có hồ sơ nhân viên nên không thể nghiệm thu');
  if (phieu.nhanVienId === nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Bạn không được tự nghiệm thu phiếu KPI của chính mình');
  if (!duocNghiemThu(nguoiDung, phieu, await layPhamViQuanLy(nguoiDung, ketNoi))) {
    throw new LoiUngDung(403, phieu.laTruongBoPhan ? 'Phiếu của trưởng bộ phận do Ban Giám đốc nghiệm thu' : 'Bạn không có quyền nghiệm thu phiếu này');
  }
}

// Nghiệm thu: chấm đủ mọi chỉ tiêu -> điểm tổng theo trọng số -> xếp loại -> DA_DUYET (một transaction)
async function nghiemThu(nguoiDung, id, body, diaChiIP) {
  return chayTransaction(async (ketNoi) => {
    const { phieu, chiTiet } = await khoaPhieuTrongKyMo(nguoiDung, id, 'CHO_DUYET', ketNoi);
    await kiemTraNguoiNghiemThu(nguoiDung, phieu, ketNoi);
    const capNhat = layDanhSachChiTietBody(body, chiTiet, { batBuocDu: true }).map(({ muc, goc }) => ({
      id: muc.id,
      trongSo: goc.trongSo,
      diemNghiemThu: layDiem(muc.diemNghiemThu, 'Điểm nghiệm thu'),
      nhanXet: layChuoi(muc.nhanXet, 'Nhận xét', { toiDa: 2000 }),
    }));
    for (const c of capNhat) await kpiRepository.capNhatChiTiet(id, c.id, { diemNghiemThu: c.diemNghiemThu, nhanXet: c.nhanXet }, ketNoi);
    // Đọc điểm tổng do SQL tính (DECIMAL) để xếp loại khớp đúng điểm hiển thị, tránh lệch làm tròn số thực JS
    const { diemTong } = await kpiRepository.layPhieuTheoId(id, ketNoi);
    const xepLoaiChung = xepLoaiTheoDiem(diemTong);
    await kpiRepository.capNhatPhieu(id, {
      nhanXetQuanLy: layChuoi(body.nhanXetQuanLy, 'Nhận xét chung', { toiDa: 5000 }),
      xepLoaiChung,
      nguoiDanhGiaId: nguoiDung.nhanVienId,
      ngayNghiemThu: await thoiGianHienTai(ketNoi),
      trangThai: 'DA_DUYET',
    }, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'NGHIEM_THU_KPI', diaChiIP,
      `${phieu.tenKyDanhGia}: ${phieu.maNhanVien} ${diemTong} ${xepLoaiChung}`, ketNoi);
    return layChiTietPhieu(nguoiDung, id, ketNoi);
  });
}

// Trả lại cho nhân viên chấm lại: lý do ghi vào nhận xét chung để nhân viên đọc được
async function traLai(nguoiDung, id, body, diaChiIP) {
  const lyDo = layChuoi(body?.lyDo, 'Lý do trả lại', { batBuoc: true, toiDa: 1000 });
  return chayTransaction(async (ketNoi) => {
    const { phieu } = await khoaPhieuTrongKyMo(nguoiDung, id, 'CHO_DUYET', ketNoi);
    await kiemTraNguoiNghiemThu(nguoiDung, phieu, ketNoi);
    await kpiRepository.capNhatPhieu(id, { trangThai: 'BAN_NHAP', nhanXetQuanLy: `Trả lại: ${lyDo}` }, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'TRA_LAI_PHIEU_KPI', diaChiIP, `${phieu.tenKyDanhGia}: ${phieu.maNhanVien}`, ketNoi);
    return layChiTietPhieu(nguoiDung, id, ketNoi);
  });
}

// Báo cáo xếp loại theo kỳ: tổng hợp theo phòng ban (phạm vi như danh sách phiếu)
async function layBaoCao(nguoiDung, { kyDanhGiaId, phongBanId }) {
  const ky = await kpiRepository.layKyTheoId(kyDanhGiaId);
  if (!ky) throw new LoiUngDung(404, 'Không tìm thấy kỳ đánh giá');
  const { items } = await kpiRepository.layDanhSachPhieu({ kyDanhGiaId, phongBanId, phamViPhongBanIds: await layPhamViXem(nguoiDung) });
  const taoNhom = () => ({
    soPhieu: 0, theoTrangThai: { BAN_NHAP: 0, CHO_DUYET: 0, DA_DUYET: 0 },
    theoXepLoai: Object.fromEntries(THAM_SO_KPI.nguongXepLoai.map(([, x]) => [x, 0])), tongDiem: 0,
  });
  const tong = taoNhom();
  const theoPhong = new Map();
  for (const p of items) {
    const khoa = p.phongBanId ?? 0;
    if (!theoPhong.has(khoa)) theoPhong.set(khoa, { phongBanId: p.phongBanId, tenPhongBan: p.tenPhongBan ?? 'Chưa có phòng ban', ...taoNhom() });
    for (const nhom of [tong, theoPhong.get(khoa)]) {
      nhom.soPhieu += 1;
      nhom.theoTrangThai[p.trangThai] = (nhom.theoTrangThai[p.trangThai] ?? 0) + 1;
      if (p.trangThai === 'DA_DUYET' && p.xepLoaiChung) {
        nhom.theoXepLoai[p.xepLoaiChung] = (nhom.theoXepLoai[p.xepLoaiChung] ?? 0) + 1;
        nhom.tongDiem += p.diemTong ?? 0;
      }
    }
  }
  const ketThuc = ({ tongDiem, ...nhom }) => ({
    ...nhom,
    diemTrungBinh: nhom.theoTrangThai.DA_DUYET ? Math.round((tongDiem / nhom.theoTrangThai.DA_DUYET) * 100) / 100 : null,
  });
  return { kyDanhGia: ky, tongHop: ketThuc(tong), theoPhongBan: [...theoPhong.values()].map(ketThuc) };
}

module.exports = {
  xepLoaiTheoDiem,
  layDanhSachKy, layChiTietKy, themKy, suaKy, dongKy, moLaiKy, xoaKy,
  layDanhSachChiTieu, layViTriGanChiTieu, themChiTieu, suaChiTieu, xoaChiTieu,
  layDanhSachPhieu, layPhieuCuaToi, layChiTietPhieu, taoPhieu, taoPhieuHangLoat, suaPhieu, xoaPhieu,
  tuCham, guiDuyet, nghiemThu, traLai, layBaoCao,
};
