const LoiUngDung = require('../utils/LoiUngDung');
const { chayTransaction } = require('../config/ketNoiCsdl');
const { THAM_SO_CHAM_CONG } = require('../config/thamSoNghiepVu');
const chamCongRepository = require('../repositories/chamCongRepository');
const nhanVienRepository = require('../repositories/nhanVienRepository');
const phongBanRepository = require('../repositories/phongBanRepository');
const nhatKyRepository = require('../repositories/nhatKyRepository');
const { tinhChiSoCong, laCuoiTuan } = require('../utils/tinhCong');

const TRANG_THAI_KHONG_CHAM_CONG = ['TAM_NGHI', 'DA_NGHI_VIEC'];

// Ngày/giờ theo giờ máy chủ (không nhận từ client để nhân viên không tự sửa giờ chấm)
function ngayHomNay() {
  return new Date().toLocaleDateString('sv-SE');
}
function gioHienTai() {
  return new Date().toTimeString().slice(0, 8);
}
const thangCua = (ngay) => ngay.slice(0, 7);
const chuanHoaGio = (gio) => (gio ? `${gio.slice(0, 5)}:00` : null);

function khoangNgayCuaThang(thang) {
  const [nam, soThang] = thang.split('-').map(Number);
  const ngayCuoi = new Date(Date.UTC(nam, soThang, 0)).getUTCDate();
  return { tuNgay: `${thang}-01`, denNgay: `${thang}-${String(ngayCuoi).padStart(2, '0')}`, ngayCuoi };
}

// Số ngày công chuẩn = số ngày thứ 2 - thứ 6 trong tháng (chưa trừ ngày lễ)
function demNgayCongChuan(thang) {
  const { ngayCuoi } = khoangNgayCuaThang(thang);
  let dem = 0;
  for (let ngay = 1; ngay <= ngayCuoi; ngay += 1) {
    if (!laCuoiTuan(`${thang}-${String(ngay).padStart(2, '0')}`)) dem += 1;
  }
  return dem;
}

function tongHopCong(banGhi) {
  const lamTron = (so) => Math.round(so * 100) / 100;
  return {
    soNgayChamCong: banGhi.length,
    soNgayThieuCheckOut: banGhi.filter((b) => !b.gioRa && b.ngayChamCong < ngayHomNay()).length,
    tongGioLamThucTe: lamTron(banGhi.reduce((tong, b) => tong + b.soGioLamThucTe, 0)),
    tongGioLamThem: lamTron(banGhi.reduce((tong, b) => tong + b.soGioLamThemOT, 0)),
    soLanDiMuon: banGhi.filter((b) => b.diMuon).length,
    soLanVeSom: banGhi.filter((b) => b.veSom).length,
  };
}

function xemToanCongTy(vaiTro) {
  return vaiTro.includes('HR') || vaiTro.includes('giamDoc');
}

// null = toàn công ty (HR, giamDoc); mảng = phòng ban quanLy phụ trách (docs/phan-quyen.md quy tắc 4)
async function layPhamVi(nguoiDung) {
  if (xemToanCongTy(nguoiDung.vaiTro)) return null;
  return phongBanRepository.layPhongBanQuanLy(nguoiDung.nhanVienId ?? 0);
}

async function chanThangDaChot(ngay, ketNoi) {
  const thang = thangCua(ngay);
  if (await chamCongRepository.layThongTinChot(thang, ketNoi)) {
    throw new LoiUngDung(409, `Công tháng ${thang} đã chốt, không thể chấm công hoặc điều chỉnh`);
  }
}

// Khóa dòng nhân viên (thứ tự khóa: nhanvien -> banghichamcong -> yeucaudieuchinhchamcong, giống thao tác chốt công)
// rồi kiểm tra người đó còn được chấm công
function canHoSo(nguoiDung) {
  if (!nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Tài khoản chưa có hồ sơ nhân viên nên không thể chấm công');
}

async function khoaNhanVienTonTai(nhanVienId, ketNoi) {
  await nhanVienRepository.khoaNhanVien(nhanVienId, ketNoi);
  const hoSo = await nhanVienRepository.layTheoId(nhanVienId, ketNoi);
  if (!hoSo) throw new LoiUngDung(404, 'Không tìm thấy hồ sơ nhân viên');
  return hoSo;
}

// Check-in/out: chặn thêm người tạm nghỉ/đã nghỉ việc (gửi điều chỉnh cho ngày đã làm thì vẫn được)
async function khoaHoSoChamCong(nhanVienId, ketNoi) {
  if (!nhanVienId) throw new LoiUngDung(403, 'Tài khoản chưa có hồ sơ nhân viên nên không thể chấm công');
  const hoSo = await khoaNhanVienTonTai(nhanVienId, ketNoi);
  if (TRANG_THAI_KHONG_CHAM_CONG.includes(hoSo.trangThaiLamViec)) {
    throw new LoiUngDung(409, 'Nhân viên đang tạm nghỉ hoặc đã nghỉ việc nên không thể chấm công');
  }
  return hoSo;
}

// ===================== Chấm công cá nhân =====================

async function layHomNay(nguoiDung) {
  canHoSo(nguoiDung);
  const ngay = ngayHomNay();
  const banGhi = await chamCongRepository.layBanGhiTheoNgay(nguoiDung.nhanVienId, ngay);
  return { ngay, gioMayChu: gioHienTai(), banGhi, thamSo: THAM_SO_CHAM_CONG };
}

async function checkIn(nguoiDung) {
  return chayTransaction(async (ketNoi) => {
    const hoSo = await khoaHoSoChamCong(nguoiDung.nhanVienId, ketNoi);
    const ngay = ngayHomNay();
    if (ngay < hoSo.ngayVaoLam) throw new LoiUngDung(409, 'Chưa đến ngày vào làm nên chưa thể chấm công');
    await chanThangDaChot(ngay, ketNoi);
    const daCo = await chamCongRepository.layBanGhiTheoNgay(hoSo.id, ngay, ketNoi, true);
    if (daCo) throw new LoiUngDung(409, `Hôm nay bạn đã check-in lúc ${daCo.gioVao.slice(0, 5)}`);
    const gioVao = gioHienTai();
    const id = await chamCongRepository.themBanGhi({
      nhanVienId: hoSo.id, ngayChamCong: ngay, gioVao, gioRa: null, ...tinhChiSoCong(ngay, gioVao, null), trangThai: 'HOP_LE',
    }, ketNoi);
    return chamCongRepository.layBanGhiTheoId(id, ketNoi);
  });
}

async function checkOut(nguoiDung) {
  return chayTransaction(async (ketNoi) => {
    const hoSo = await khoaHoSoChamCong(nguoiDung.nhanVienId, ketNoi);
    const ngay = ngayHomNay();
    await chanThangDaChot(ngay, ketNoi);
    const banGhi = await chamCongRepository.layBanGhiTheoNgay(hoSo.id, ngay, ketNoi, true);
    if (!banGhi) throw new LoiUngDung(409, 'Hôm nay bạn chưa check-in');
    if (banGhi.gioRa) throw new LoiUngDung(409, `Hôm nay bạn đã check-out lúc ${banGhi.gioRa.slice(0, 5)}, cần sửa giờ thì gửi yêu cầu điều chỉnh`);
    const gioRa = gioHienTai();
    await chamCongRepository.capNhatBanGhi(banGhi.id, { gioRa, ...tinhChiSoCong(ngay, banGhi.gioVao, gioRa) }, ketNoi);
    return chamCongRepository.layBanGhiTheoId(banGhi.id, ketNoi);
  });
}

async function layCongTheoThang(nhanVienId, thang) {
  const { tuNgay, denNgay } = khoangNgayCuaThang(thang);
  const items = await chamCongRepository.layBanGhiTrongKhoang(nhanVienId, tuNgay, denNgay);
  const chot = await chamCongRepository.layThongTinChot(thang);
  return {
    thang, soNgayCongChuan: demNgayCongChuan(thang), daChot: Boolean(chot), chot, items, tongHop: tongHopCong(items),
  };
}

async function layCuaToi(nguoiDung, thang = thangCua(ngayHomNay())) {
  canHoSo(nguoiDung);
  return layCongTheoThang(nguoiDung.nhanVienId, thang);
}

// ===================== Bảng công tháng & chốt công =====================

async function layBangCong(nguoiDung, { thang = thangCua(ngayHomNay()), phongBanId, tuKhoa, trang, kichThuoc }) {
  const { tuNgay, denNgay } = khoangNgayCuaThang(thang);
  const { items, tongSo } = await chamCongRepository.layBangCongThang({
    tuNgay, denNgay, phamViPhongBanIds: await layPhamVi(nguoiDung), phongBanId, tuKhoa,
    viTri: (trang - 1) * kichThuoc, soLuong: kichThuoc,
  });
  const chot = await chamCongRepository.layThongTinChot(thang);
  return {
    thang, soNgayCongChuan: demNgayCongChuan(thang), daChot: Boolean(chot), chot,
    items, phanTrang: { trang, kichThuoc, tongSo },
  };
}

// Chi tiết công từng ngày của một nhân viên: chính chủ, HR, giamDoc, quanLy (PM)
async function layCongNhanVien(nguoiDung, nhanVienId, thang = thangCua(ngayHomNay())) {
  const hoSo = await nhanVienRepository.layTheoId(nhanVienId);
  if (!hoSo) throw new LoiUngDung(404, 'Không tìm thấy nhân viên');
  let duocXem = nguoiDung.nhanVienId === hoSo.id || xemToanCongTy(nguoiDung.vaiTro);
  if (!duocXem && nguoiDung.vaiTro.includes('quanLy')) {
    duocXem = (await layPhamVi(nguoiDung)).includes(hoSo.phongBanId);
  }
  if (!duocXem) throw new LoiUngDung(403, 'Bạn không có quyền xem bảng công của nhân viên này');
  return {
    nhanVien: { id: hoSo.id, maNhanVien: hoSo.maNhanVien, hoVaTen: hoSo.hoVaTen, tenPhongBan: hoSo.tenPhongBan },
    ...(await layCongTheoThang(hoSo.id, thang)),
  };
}

function layDanhSachThangDaChot() {
  return chamCongRepository.layDanhSachThangDaChot();
}

// Chốt công tháng (HR): chỉ tháng đã kết thúc, không còn yêu cầu điều chỉnh chờ duyệt.
// Sau khi chốt, tháng đó bị chặn chấm công/gửi/duyệt điều chỉnh (409) và là điều kiện để lập bảng lương.
async function chotCong(nguoiDung, thang, diaChiIP) {
  if (thang >= thangCua(ngayHomNay())) throw new LoiUngDung(409, 'Chỉ được chốt công tháng đã kết thúc');
  const ngayVaoLamSomNhat = await chamCongRepository.layNgayVaoLamSomNhat();
  if (!ngayVaoLamSomNhat || thang < thangCua(ngayVaoLamSomNhat)) {
    throw new LoiUngDung(409, 'Tháng này trước khi công ty có nhân viên, không cần chốt công');
  }
  const { tuNgay, denNgay } = khoangNgayCuaThang(thang);
  await chayTransaction(async (ketNoi) => {
    await chamCongRepository.khoaTatCaNhanVien(ketNoi);
    if (await chamCongRepository.layThongTinChot(thang, ketNoi)) throw new LoiUngDung(409, `Công tháng ${thang} đã được chốt trước đó`);
    const soChoDuyet = await chamCongRepository.demYeuCauChoDuyetTrongKhoang(tuNgay, denNgay, ketNoi);
    if (soChoDuyet > 0) {
      throw new LoiUngDung(409, `Tháng ${thang} còn ${soChoDuyet} yêu cầu điều chỉnh công chờ duyệt, cần xử lý trước khi chốt`);
    }
    // Ngày thiếu check-out bị khóa ở 0 giờ công sau khi chốt -> lương sai, bắt buộc xử lý trước
    const soThieuCheckOut = await chamCongRepository.demNgayThieuCheckOutTrongKhoang(tuNgay, denNgay, ketNoi);
    if (soThieuCheckOut > 0) {
      throw new LoiUngDung(409, `Tháng ${thang} còn ${soThieuCheckOut} ngày công thiếu check-out, cần nhân viên gửi điều chỉnh trước khi chốt`);
    }
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'CHOT_CONG_THANG', diaChiIP ?? null, thang, ketNoi);
  });
  return { thang, chot: await chamCongRepository.layThongTinChot(thang) };
}

// ===================== Yêu cầu điều chỉnh công =====================

async function taoYeuCau(nguoiDung, { ngayCanDieuChinh, gioVaoDeXuat, gioRaDeXuat, lyDoGiaiTrinh }) {
  const gioVao = chuanHoaGio(gioVaoDeXuat);
  const gioRa = chuanHoaGio(gioRaDeXuat);
  if (!gioVao && !gioRa) throw new LoiUngDung(400, 'Cần đề xuất ít nhất giờ vào hoặc giờ ra');
  const homNay = ngayHomNay();
  if (ngayCanDieuChinh > homNay) throw new LoiUngDung(400, 'Không thể điều chỉnh công cho ngày trong tương lai');
  if (ngayCanDieuChinh === homNay && [gioVao, gioRa].some((gio) => gio && gio > gioHienTai())) {
    throw new LoiUngDung(400, 'Giờ đề xuất không được sau thời điểm hiện tại');
  }

  const id = await chayTransaction(async (ketNoi) => {
    canHoSo(nguoiDung);
    const hoSo = await khoaNhanVienTonTai(nguoiDung.nhanVienId, ketNoi);
    if (ngayCanDieuChinh < hoSo.ngayVaoLam) throw new LoiUngDung(400, 'Ngày cần điều chỉnh trước ngày vào làm');
    await chanThangDaChot(ngayCanDieuChinh, ketNoi);
    if (await chamCongRepository.timYeuCauChoDuyetTheoNgay(hoSo.id, ngayCanDieuChinh, ketNoi)) {
      throw new LoiUngDung(409, 'Ngày này đã có yêu cầu điều chỉnh đang chờ duyệt');
    }
    const banGhi = await chamCongRepository.layBanGhiTheoNgay(hoSo.id, ngayCanDieuChinh, ketNoi, true);
    const gioVaoMoi = gioVao ?? banGhi?.gioVao;
    const gioRaMoi = gioRa ?? banGhi?.gioRa;
    if (!gioVaoMoi) throw new LoiUngDung(400, 'Ngày này chưa có bản ghi chấm công nên cần đề xuất giờ vào');
    if (gioRaMoi && gioRaMoi <= gioVaoMoi) throw new LoiUngDung(400, 'Giờ ra phải sau giờ vào');
    if (banGhi && gioVaoMoi === banGhi.gioVao && gioRaMoi === banGhi.gioRa) {
      throw new LoiUngDung(400, 'Giờ đề xuất trùng với bản ghi chấm công hiện tại');
    }
    return chamCongRepository.themYeuCau({
      banGhiChamCongId: banGhi?.id, nhanVienId: hoSo.id, ngayCanDieuChinh,
      gioVaoDeXuat: gioVao, gioRaDeXuat: gioRa, lyDoGiaiTrinh: lyDoGiaiTrinh.trim(),
    }, ketNoi);
  });
  return chamCongRepository.layYeuCauTheoId(id);
}

function themQuyenDuyet(nguoiDung, yeuCau) {
  return { ...yeuCau, duocDuyet: yeuCau.trangThai === 'CHO_DUYET' && yeuCau.nhanVienId !== nguoiDung.nhanVienId };
}

async function layYeuCauCuaToi(nguoiDung, boLoc) {
  canHoSo(nguoiDung);
  return layDanhSachYeuCauTheoBoLoc({ ...boLoc, nhanVienId: nguoiDung.nhanVienId }, (yc) => ({ ...yc, duocDuyet: false }));
}

async function layDanhSachYeuCau(nguoiDung, boLoc) {
  const phamViPhongBanIds = await layPhamVi(nguoiDung);
  return layDanhSachYeuCauTheoBoLoc({ ...boLoc, phamViPhongBanIds }, (yc) => themQuyenDuyet(nguoiDung, yc));
}

async function layDanhSachYeuCauTheoBoLoc({ thang, trang, kichThuoc, ...boLoc }, chuyenDoi) {
  const khoang = thang ? khoangNgayCuaThang(thang) : {};
  const { items, tongSo } = await chamCongRepository.layDanhSachYeuCau({
    ...boLoc, tuNgay: khoang.tuNgay, denNgay: khoang.denNgay, viTri: (trang - 1) * kichThuoc, soLuong: kichThuoc,
  });
  return { items: items.map(chuyenDoi), phanTrang: { trang, kichThuoc, tongSo } };
}

// Quyền duyệt (docs/phan-quyen.md mục 5): giamDoc, HR toàn công ty; quanLy phòng mình; không ai tự duyệt
async function kiemTraQuyenDuyet(nguoiDung, id) {
  const yeuCau = await chamCongRepository.layYeuCauTheoId(id);
  if (!yeuCau) throw new LoiUngDung(404, 'Không tìm thấy yêu cầu điều chỉnh công');
  if (!nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Tài khoản chưa có hồ sơ nhân viên nên không thể duyệt');
  if (yeuCau.nhanVienId === nguoiDung.nhanVienId) {
    throw new LoiUngDung(403, 'Bạn không được tự duyệt yêu cầu điều chỉnh công của chính mình');
  }
  const phamVi = await layPhamVi(nguoiDung);
  if (phamVi && !phamVi.includes(yeuCau.phongBanId)) {
    throw new LoiUngDung(403, 'Bạn chỉ được duyệt yêu cầu của nhân viên thuộc phòng ban mình phụ trách');
  }
  return yeuCau;
}

// Kiểm tra lại phạm vi trên hồ sơ đã khóa: nhân viên có thể vừa bị điều chuyển sau lần kiểm tra ngoài transaction
async function khoaYeuCauChoDuyet(nguoiDung, id, nhanVienId, ketNoi) {
  const hoSo = await khoaNhanVienTonTai(nhanVienId, ketNoi);
  const phamVi = await layPhamVi(nguoiDung);
  if (phamVi && !phamVi.includes(hoSo.phongBanId)) {
    throw new LoiUngDung(403, 'Bạn chỉ được duyệt yêu cầu của nhân viên thuộc phòng ban mình phụ trách');
  }
  const yeuCau = await chamCongRepository.khoaYeuCau(id, ketNoi);
  if (!yeuCau) throw new LoiUngDung(404, 'Không tìm thấy yêu cầu điều chỉnh công');
  if (yeuCau.trangThai !== 'CHO_DUYET') throw new LoiUngDung(409, 'Yêu cầu này đã được xử lý trước đó');
  return yeuCau;
}

// Duyệt: transaction cập nhật/tạo banghichamcong theo giờ đề xuất (tính lại chỉ số) + chuyển yêu cầu DA_DUYET
async function duyetYeuCau(nguoiDung, id, diaChiIP) {
  const { nhanVienId, maNhanVien } = await kiemTraQuyenDuyet(nguoiDung, id);
  await chayTransaction(async (ketNoi) => {
    const yeuCau = await khoaYeuCauChoDuyet(nguoiDung, id, nhanVienId, ketNoi);
    await chanThangDaChot(yeuCau.ngayCanDieuChinh, ketNoi);
    const banGhi = await chamCongRepository.layBanGhiTheoNgay(nhanVienId, yeuCau.ngayCanDieuChinh, ketNoi, true);
    // Bản ghi có thể đã thay đổi sau khi gửi yêu cầu (vd. đã check-out) nên kiểm tra lại trên dữ liệu đã khóa
    const gioVao = yeuCau.gioVaoDeXuat ?? banGhi?.gioVao;
    const gioRa = yeuCau.gioRaDeXuat ?? banGhi?.gioRa ?? null;
    if (!gioVao) throw new LoiUngDung(409, 'Ngày này không có giờ vào, không thể duyệt yêu cầu chỉ sửa giờ ra');
    if (gioRa && gioRa <= gioVao) throw new LoiUngDung(409, 'Sau khi điều chỉnh giờ ra không sau giờ vào, không thể duyệt');
    const truong = { gioVao, gioRa, ...tinhChiSoCong(yeuCau.ngayCanDieuChinh, gioVao, gioRa), trangThai: 'DA_DIEU_CHINH' };
    let banGhiId = banGhi?.id;
    if (banGhi) {
      await chamCongRepository.capNhatBanGhi(banGhi.id, truong, ketNoi);
    } else {
      banGhiId = await chamCongRepository.themBanGhi({ nhanVienId, ngayChamCong: yeuCau.ngayCanDieuChinh, ...truong }, ketNoi);
    }
    await chamCongRepository.capNhatKetQuaDuyet(id, {
      trangThai: 'DA_DUYET', nguoiDuyetId: nguoiDung.nhanVienId, banGhiChamCongId: banGhiId,
    }, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'DUYET_DIEU_CHINH_CONG', diaChiIP ?? null, `Yêu cầu #${id} của ${maNhanVien}`, ketNoi);
  });
  return themQuyenDuyet(nguoiDung, await chamCongRepository.layYeuCauTheoId(id));
}

async function tuChoiYeuCau(nguoiDung, id, { lyDoTuChoi }, diaChiIP) {
  const { nhanVienId, maNhanVien } = await kiemTraQuyenDuyet(nguoiDung, id);
  await chayTransaction(async (ketNoi) => {
    await khoaYeuCauChoDuyet(nguoiDung, id, nhanVienId, ketNoi);
    await chamCongRepository.capNhatKetQuaDuyet(id, {
      trangThai: 'TU_CHOI', nguoiDuyetId: nguoiDung.nhanVienId, lyDoTuChoi: lyDoTuChoi.trim(),
    }, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'TU_CHOI_DIEU_CHINH_CONG', diaChiIP ?? null, `Yêu cầu #${id} của ${maNhanVien}`, ketNoi);
  });
  return themQuyenDuyet(nguoiDung, await chamCongRepository.layYeuCauTheoId(id));
}

module.exports = {
  layHomNay,
  checkIn,
  checkOut,
  layCuaToi,
  layBangCong,
  layCongNhanVien,
  layDanhSachThangDaChot,
  chotCong,
  taoYeuCau,
  layYeuCauCuaToi,
  layDanhSachYeuCau,
  duyetYeuCau,
  tuChoiYeuCau,
};
