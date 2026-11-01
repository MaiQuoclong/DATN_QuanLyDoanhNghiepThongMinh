const LoiUngDung = require('../utils/LoiUngDung');
const { chayTransaction } = require('../config/ketNoiCsdl');
const phongBanRepository = require('../repositories/phongBanRepository');
const nhanVienRepository = require('../repositories/nhanVienRepository');
const nguoiDungRepository = require('../repositories/nguoiDungRepository');
const { themNhatKy, layHanhDongGanNhat } = require('../repositories/nhatKyRepository');
const { TRANG_THAI_PHONG_BAN, TRANG_THAI_CHUC_DANH, TRANG_THAI_VI_TRI } = require('../utils/trangThai');

const DINH_BIEN_TOI_DA = 1000;
// Định biên, chỗ trống, ghi chú là dữ liệu phục vụ tuyển dụng: chỉ HR, giamDoc xem
const COT_CHI_HR = ['dinhBien', 'conTrong', 'ghiChu'];

function xemDinhBien(vaiTro) {
  return vaiTro.includes('HR') || vaiTro.includes('giamDoc');
}

function locViTri(viTri, vaiTro) {
  if (xemDinhBien(vaiTro)) return viTri;
  return viTri.map((vt) => {
    const ketQua = { ...vt };
    COT_CHI_HR.forEach((cot) => delete ketQua[cot]);
    return ketQua;
  });
}

// tongQuanSo = quân số trực tiếp + toàn bộ phòng ban con cháu
function congDonQuanSo(dsPhongBan) {
  const theoCha = new Map();
  dsPhongBan.forEach((pb) => {
    const con = theoCha.get(pb.phongBanChaId) ?? [];
    con.push(pb);
    theoCha.set(pb.phongBanChaId, con);
  });
  const daTinh = new Map();
  const tinh = (pb, dangXet = new Set()) => {
    if (daTinh.has(pb.id)) return daTinh.get(pb.id);
    if (dangXet.has(pb.id)) return 0; // dữ liệu lỗi có vòng: không lặp vô hạn
    dangXet.add(pb.id);
    const tong = pb.soNhanVien + (theoCha.get(pb.id) ?? []).reduce((s, con) => s + tinh(con, dangXet), 0);
    daTinh.set(pb.id, tong);
    return tong;
  };
  return dsPhongBan.map((pb) => ({ ...pb, tongQuanSo: tinh(pb) }));
}

// ===================== Đọc =====================

async function layDanhSachPhongBan(boLoc) {
  // Cộng dồn trên toàn bộ cây rồi mới lọc, để phòng đang hoạt động vẫn tính đúng con cháu
  const tatCa = congDonQuanSo(await phongBanRepository.layDanhSachPhongBan({}));
  return boLoc.trangThai ? tatCa.filter((pb) => pb.trangThai === boLoc.trangThai) : tatCa;
}

async function layChiTietPhongBan(vaiTro, id) {
  const phongBan = await phongBanRepository.layPhongBanTheoId(id);
  if (!phongBan) throw new LoiUngDung(404, 'Không tìm thấy phòng ban');
  const tongQuanSo = await phongBanRepository.layTongQuanSo(id);
  const viTri = await phongBanRepository.layDanhSachViTri({ phongBanId: id });
  return { ...phongBan, tongQuanSo, viTri: locViTri(viTri, vaiTro) };
}

function layDanhSachChucDanh(boLoc) {
  return phongBanRepository.layDanhSachChucDanh(boLoc);
}

function layDanhSachViTri(boLoc) {
  return phongBanRepository.layDanhSachViTri(boLoc);
}

// ===================== Phòng ban (HR) =====================

async function khoaPhongBanHoacLoi(id, ketNoi) {
  const phongBan = await phongBanRepository.khoaPhongBan(id, ketNoi);
  if (!phongBan) throw new LoiUngDung(404, 'Không tìm thấy phòng ban');
  return phongBan;
}

async function kiemTraPhongBanCha(phongBanChaId, ketNoi) {
  const cha = await khoaPhongBanHoacLoi(phongBanChaId, ketNoi).catch((loi) => {
    if (loi.code === 404) throw new LoiUngDung(404, 'Không tìm thấy phòng ban cha');
    throw loi;
  });
  if (cha.trangThai !== 'DANG_HOAT_DONG') throw new LoiUngDung(409, 'Phòng ban cha đã ngừng hoạt động');
  return cha;
}

async function themPhongBan(nguoiDung, { maPhongBan, tenPhongBan, phongBanChaId }, diaChiIP) {
  const id = await chayTransaction(async (ketNoi) => {
    const chaId = phongBanChaId ? Number(phongBanChaId) : null;
    if (chaId) await kiemTraPhongBanCha(chaId, ketNoi);
    const ma = maPhongBan.trim().toUpperCase();
    const idMoi = await phongBanRepository.themPhongBan({ maPhongBan: ma, tenPhongBan: tenPhongBan.trim(), phongBanChaId: chaId }, ketNoi);
    await themNhatKy(nguoiDung.nguoiDungId, 'THEM_PHONG_BAN', diaChiIP, `${ma} - ${tenPhongBan.trim()}`, ketNoi);
    return idMoi;
  });
  return layChiTietPhongBan(nguoiDung.vaiTro, id);
}

// Sửa tên / đổi phòng ban cha (phongBanChaId = null -> thành phòng ban gốc). Mã phòng ban cố định.
async function suaPhongBan(nguoiDung, id, body, diaChiIP) {
  const truong = {};
  if (body.tenPhongBan !== undefined) truong.tenPhongBan = String(body.tenPhongBan).trim();
  if (body.phongBanChaId !== undefined) truong.phongBanChaId = body.phongBanChaId === null || body.phongBanChaId === '' ? null : Number(body.phongBanChaId);
  if (Object.keys(truong).length === 0) throw new LoiUngDung(400, 'Không có thông tin nào để cập nhật');
  if (truong.tenPhongBan === '') throw new LoiUngDung(400, 'Tên phòng ban không được để trống');

  await chayTransaction(async (ketNoi) => {
    const phongBan = await khoaPhongBanHoacLoi(id, ketNoi);
    // Chỉ kiểm tra khi thật sự đổi phòng cha (phòng cha cũ có thể đã ngừng hoạt động)
    if (truong.phongBanChaId && truong.phongBanChaId !== phongBan.phongBanChaId) {
      // Chống vòng: phòng ban cha mới không được là chính nó hoặc con cháu của nó
      const conChau = await phongBanRepository.layPhongBanConChau(id, ketNoi);
      if (truong.phongBanChaId === id || conChau.includes(truong.phongBanChaId)) {
        throw new LoiUngDung(409, 'Phòng ban cha không được là chính nó hoặc phòng ban con của nó');
      }
      await kiemTraPhongBanCha(truong.phongBanChaId, ketNoi);
    }
    await phongBanRepository.capNhatPhongBan(id, truong, ketNoi);
    const thayDoi = Object.keys(truong).map((cot) => `${cot}: ${phongBan[cot] ?? 'trống'} -> ${truong[cot] ?? 'trống'}`).join('; ');
    await themNhatKy(nguoiDung.nguoiDungId, 'SUA_PHONG_BAN', diaChiIP, `${phongBan.maPhongBan}: ${thayDoi}`, ketNoi);
  });
  return layChiTietPhongBan(nguoiDung.vaiTro, id);
}

// Ngừng: không còn nhân viên đang làm và không còn phòng con hoạt động; tự miễn nhiệm trưởng bộ phận.
// Kích hoạt lại: phòng ban cha (nếu có) phải đang hoạt động.
async function doiTrangThaiPhongBan(nguoiDung, id, trangThai, diaChiIP) {
  await chayTransaction(async (ketNoi) => {
    const phongBan = await khoaPhongBanHoacLoi(id, ketNoi);
    if (phongBan.trangThai === trangThai) throw new LoiUngDung(400, 'Phòng ban đã ở trạng thái này');
    const truong = { trangThai };
    if (trangThai === 'NGUNG_HOAT_DONG') {
      if (await phongBanRepository.demPhongBanConHoatDong(id, ketNoi)) {
        throw new LoiUngDung(409, 'Cần ngừng hoặc chuyển các phòng ban con đang hoạt động trước');
      }
      const soNhanVien = await phongBanRepository.demNhanVienTrongPhong(id, ketNoi);
      if (soNhanVien) throw new LoiUngDung(409, `Phòng ban còn ${soNhanVien} nhân viên đang làm việc, cần điều chuyển trước`);
      if (phongBan.truongBoPhanId) {
        truong.truongBoPhanId = null;
        await thuHoiQuanLyNeuHetPhong(nguoiDung, phongBan.truongBoPhanId, id, diaChiIP, ketNoi);
        await themNhatKy(nguoiDung.nguoiDungId, 'MIEN_NHIEM_TRUONG_BO_PHAN', diaChiIP,
          `${phongBan.maPhongBan}: nhanVienId=${phongBan.truongBoPhanId} (tự động khi ngừng phòng ban)`, ketNoi);
      }
    } else if (phongBan.phongBanChaId) {
      await kiemTraPhongBanCha(phongBan.phongBanChaId, ketNoi);
    }
    await phongBanRepository.capNhatPhongBan(id, truong, ketNoi);
    const hanhDong = trangThai === 'NGUNG_HOAT_DONG' ? 'NGUNG_PHONG_BAN' : 'KICH_HOAT_PHONG_BAN';
    await themNhatKy(nguoiDung.nguoiDungId, hanhDong, diaChiIP, phongBan.maPhongBan, ketNoi);
  });
  return layChiTietPhongBan(nguoiDung.vaiTro, id);
}

// ===================== Bổ nhiệm trưởng bộ phận (giamDoc) =====================

// Phạm vi quanLy tính theo truongBoPhanId nhưng API danh sách cần vai trò quanLy:
// bổ nhiệm tự gán quanLy, miễn nhiệm tự gỡ nếu người đó không còn làm trưởng phòng nào.
// Chỉ gỡ khi lần thay đổi vai trò gần nhất của tài khoản là do hệ thống tự gán (TU_DONG_GAN_QUAN_LY);
// quanLy do Admin gán tay (DUOC_PHAN_QUYEN) hoặc có sẵn từ dữ liệu mẫu thì giữ nguyên.
// Các hành động này ghi theo người BỊ tác động, giống KHOA_TAI_KHOAN.
const HANH_DONG_VAI_TRO = ['TU_DONG_GAN_QUAN_LY', 'TU_DONG_GO_QUAN_LY', 'DUOC_PHAN_QUYEN'];

async function ganQuanLyNeuChuaCo(nguoiDung, nhanVien, diaChiIP, ketNoi) {
  if (!nhanVien.nguoiDungId) return;
  const vaiTro = await nguoiDungRepository.layDanhSachVaiTro(nhanVien.nguoiDungId, ketNoi);
  if (vaiTro.includes('quanLy') || vaiTro.includes('giamDoc')) return;
  await nguoiDungRepository.ganVaiTro(nhanVien.nguoiDungId, 'quanLy', ketNoi);
  await themNhatKy(nhanVien.nguoiDungId, 'TU_DONG_GAN_QUAN_LY', diaChiIP, `${nhanVien.maNhanVien}: bổ nhiệm bởi nguoiDungId=${nguoiDung.nguoiDungId}`, ketNoi);
}

async function thuHoiQuanLyNeuHetPhong(nguoiDung, nhanVienId, phongBanBoQuaId, diaChiIP, ketNoi) {
  const conLamTruong = (await phongBanRepository.layPhongBanLamTruong(nhanVienId, ketNoi)).filter((p) => p.id !== phongBanBoQuaId);
  if (conLamTruong.length) return;
  const nhanVien = await nhanVienRepository.layTheoId(nhanVienId, ketNoi);
  if (!nhanVien?.nguoiDungId) return;
  if ((await layHanhDongGanNhat(nhanVien.nguoiDungId, HANH_DONG_VAI_TRO, ketNoi)) !== 'TU_DONG_GAN_QUAN_LY') return;
  if (await nguoiDungRepository.goVaiTro(nhanVien.nguoiDungId, 'quanLy', ketNoi)) {
    await themNhatKy(nhanVien.nguoiDungId, 'TU_DONG_GO_QUAN_LY', diaChiIP, `${nhanVien.maNhanVien}: miễn nhiệm bởi nguoiDungId=${nguoiDung.nguoiDungId}`, ketNoi);
  }
}

// Người được bổ nhiệm phải đang làm việc trong chính phòng ban đó; không tự bổ nhiệm mình
async function boNhiemTruongBoPhan(nguoiDung, phongBanId, nhanVienId, diaChiIP) {
  const nvId = Number(nhanVienId);
  if (nguoiDung.nhanVienId === nvId) throw new LoiUngDung(403, 'Không được tự bổ nhiệm chính mình');
  await chayTransaction(async (ketNoi) => {
    const phongBan = await khoaPhongBanHoacLoi(phongBanId, ketNoi);
    if (phongBan.trangThai !== 'DANG_HOAT_DONG') throw new LoiUngDung(409, 'Phòng ban đã ngừng hoạt động');
    if (phongBan.truongBoPhanId === nvId) throw new LoiUngDung(400, 'Nhân viên đã là trưởng bộ phận này');
    if (!(await nhanVienRepository.khoaNhanVien(nvId, ketNoi))) throw new LoiUngDung(404, 'Không tìm thấy nhân viên');
    const nhanVien = await nhanVienRepository.layTheoId(nvId, ketNoi);
    if (nhanVien.trangThaiLamViec === 'DA_NGHI_VIEC' || nhanVien.trangThaiLamViec === 'TAM_NGHI') {
      throw new LoiUngDung(409, 'Chỉ bổ nhiệm nhân viên đang làm việc');
    }
    if (nhanVien.trangThaiTaiKhoan === 'KHOA') {
      throw new LoiUngDung(409, 'Tài khoản của nhân viên đang bị khóa, cần Admin mở khóa trước khi bổ nhiệm');
    }
    if (nhanVien.phongBanId !== phongBanId) {
      throw new LoiUngDung(409, `Nhân viên thuộc ${nhanVien.tenPhongBan}, cần điều chuyển vào ${phongBan.tenPhongBan} trước khi bổ nhiệm`);
    }

    if (phongBan.truongBoPhanId) await thuHoiQuanLyNeuHetPhong(nguoiDung, phongBan.truongBoPhanId, phongBanId, diaChiIP, ketNoi);
    await phongBanRepository.capNhatPhongBan(phongBanId, { truongBoPhanId: nvId }, ketNoi);
    await ganQuanLyNeuChuaCo(nguoiDung, nhanVien, diaChiIP, ketNoi);
    const chiTiet = `${phongBan.maPhongBan}: ${nhanVien.maNhanVien} - ${nhanVien.hoVaTen}${phongBan.truongBoPhanId ? ` (thay nhanVienId=${phongBan.truongBoPhanId})` : ''}`;
    await themNhatKy(nguoiDung.nguoiDungId, 'BO_NHIEM_TRUONG_BO_PHAN', diaChiIP, chiTiet, ketNoi);
  });
  return layChiTietPhongBan(nguoiDung.vaiTro, phongBanId);
}

async function mienNhiemTruongBoPhan(nguoiDung, phongBanId, diaChiIP) {
  await chayTransaction(async (ketNoi) => {
    const phongBan = await khoaPhongBanHoacLoi(phongBanId, ketNoi);
    if (!phongBan.truongBoPhanId) throw new LoiUngDung(400, 'Phòng ban chưa có trưởng bộ phận');
    if (nguoiDung.nhanVienId === phongBan.truongBoPhanId) throw new LoiUngDung(403, 'Không được tự miễn nhiệm chính mình');
    await thuHoiQuanLyNeuHetPhong(nguoiDung, phongBan.truongBoPhanId, phongBanId, diaChiIP, ketNoi);
    await phongBanRepository.capNhatPhongBan(phongBanId, { truongBoPhanId: null }, ketNoi);
    await themNhatKy(nguoiDung.nguoiDungId, 'MIEN_NHIEM_TRUONG_BO_PHAN', diaChiIP, `${phongBan.maPhongBan}: nhanVienId=${phongBan.truongBoPhanId}`, ketNoi);
  });
  return layChiTietPhongBan(nguoiDung.vaiTro, phongBanId);
}

// ===================== Chức danh (HR) =====================

async function khoaChucDanhHoacLoi(id, ketNoi) {
  const chucDanh = await phongBanRepository.khoaChucDanh(id, ketNoi);
  if (!chucDanh) throw new LoiUngDung(404, 'Không tìm thấy chức danh');
  return chucDanh;
}

async function themChucDanh(nguoiDung, { maChucDanh, tenChucDanh, capBac }, diaChiIP) {
  const ma = maChucDanh.trim().toUpperCase();
  const id = await chayTransaction(async (ketNoi) => {
    const idMoi = await phongBanRepository.themChucDanh({ maChucDanh: ma, tenChucDanh: tenChucDanh.trim(), capBac: capBac.trim() }, ketNoi);
    await themNhatKy(nguoiDung.nguoiDungId, 'THEM_CHUC_DANH', diaChiIP, `${ma} - ${tenChucDanh.trim()}`, ketNoi);
    return idMoi;
  });
  return (await phongBanRepository.layDanhSachChucDanh({ id }))[0];
}

async function suaChucDanh(nguoiDung, id, body, diaChiIP) {
  const truong = {};
  ['tenChucDanh', 'capBac'].forEach((cot) => {
    if (body[cot] === undefined) return;
    truong[cot] = String(body[cot]).trim();
    if (!truong[cot]) throw new LoiUngDung(400, `Trường ${cot} không được để trống`);
  });
  if (Object.keys(truong).length === 0) throw new LoiUngDung(400, 'Không có thông tin nào để cập nhật');
  await chayTransaction(async (ketNoi) => {
    const chucDanh = await khoaChucDanhHoacLoi(id, ketNoi);
    await phongBanRepository.capNhatChucDanh(id, truong, ketNoi);
    const thayDoi = Object.keys(truong).map((cot) => `${cot}: ${chucDanh[cot]} -> ${truong[cot]}`).join('; ');
    await themNhatKy(nguoiDung.nguoiDungId, 'SUA_CHUC_DANH', diaChiIP, `${chucDanh.maChucDanh}: ${thayDoi}`, ketNoi);
  });
  return (await phongBanRepository.layDanhSachChucDanh({ id }))[0];
}

// Ngừng chức danh khi không còn vị trí nào đang áp dụng chức danh đó
async function doiTrangThaiChucDanh(nguoiDung, id, trangThai, diaChiIP) {
  await chayTransaction(async (ketNoi) => {
    const chucDanh = await khoaChucDanhHoacLoi(id, ketNoi);
    if (chucDanh.trangThai === trangThai) throw new LoiUngDung(400, 'Chức danh đã ở trạng thái này');
    if (trangThai === 'NGUNG_HOAT_DONG' && (await phongBanRepository.demViTriApDungCuaChucDanh(id, ketNoi))) {
      throw new LoiUngDung(409, 'Chức danh còn được dùng ở vị trí đang áp dụng, cần ngừng các vị trí đó trước');
    }
    await phongBanRepository.capNhatChucDanh(id, { trangThai }, ketNoi);
    const hanhDong = trangThai === 'NGUNG_HOAT_DONG' ? 'NGUNG_CHUC_DANH' : 'KICH_HOAT_CHUC_DANH';
    await themNhatKy(nguoiDung.nguoiDungId, hanhDong, diaChiIP, chucDanh.maChucDanh, ketNoi);
  });
  return (await phongBanRepository.layDanhSachChucDanh({ id }))[0];
}

// ===================== Vị trí = chức danh trong phòng ban (HR) =====================

function kiemTraDinhBien(dinhBien) {
  const so = Number(dinhBien);
  if (!Number.isInteger(so) || so < 1 || so > DINH_BIEN_TOI_DA) {
    throw new LoiUngDung(400, `Định biên phải là số nguyên từ 1 đến ${DINH_BIEN_TOI_DA}`);
  }
  return so;
}

async function khoaViTriHoacLoi(id, ketNoi) {
  const viTri = await phongBanRepository.khoaViTri(id, ketNoi);
  if (!viTri) throw new LoiUngDung(404, 'Không tìm thấy vị trí');
  return viTri;
}

async function layViTri(id) {
  return (await phongBanRepository.layDanhSachViTri({ id }))[0];
}

async function themViTri(nguoiDung, { phongBanId, chucDanhId, dinhBien, ghiChu }, diaChiIP) {
  const so = kiemTraDinhBien(dinhBien);
  const id = await chayTransaction(async (ketNoi) => {
    const phongBan = await khoaPhongBanHoacLoi(Number(phongBanId), ketNoi);
    const chucDanh = await khoaChucDanhHoacLoi(Number(chucDanhId), ketNoi);
    if (phongBan.trangThai !== 'DANG_HOAT_DONG' || chucDanh.trangThai !== 'DANG_HOAT_DONG') {
      throw new LoiUngDung(409, 'Phòng ban hoặc chức danh đã ngừng hoạt động');
    }
    // Trùng (phongBanId, chucDanhId) bị khóa UNIQUE chặn -> middleware lỗi trả 409
    const idMoi = await phongBanRepository.themViTri({
      phongBanId: phongBan.id, chucDanhId: chucDanh.id, dinhBien: so, ghiChu: ghiChu?.trim() || null,
    }, ketNoi);
    await themNhatKy(nguoiDung.nguoiDungId, 'THEM_VI_TRI', diaChiIP, `${chucDanh.maChucDanh} - ${phongBan.maPhongBan}, định biên ${so}`, ketNoi);
    return idMoi;
  });
  return layViTri(id);
}

// Không giảm định biên xuống dưới số người đang giữ vị trí
async function suaViTri(nguoiDung, id, body, diaChiIP) {
  const truong = {};
  if (body.dinhBien !== undefined) truong.dinhBien = kiemTraDinhBien(body.dinhBien);
  if (body.ghiChu !== undefined) truong.ghiChu = body.ghiChu === null ? null : String(body.ghiChu).trim() || null;
  if (Object.keys(truong).length === 0) throw new LoiUngDung(400, 'Không có thông tin nào để cập nhật');
  await chayTransaction(async (ketNoi) => {
    const viTri = await khoaViTriHoacLoi(id, ketNoi);
    if (truong.dinhBien !== undefined) {
      const soDangGiu = await nhanVienRepository.demTheoViTri(id, null, ketNoi);
      if (truong.dinhBien < soDangGiu) {
        throw new LoiUngDung(409, `Định biên không được nhỏ hơn số người đang giữ vị trí (${soDangGiu})`);
      }
    }
    await phongBanRepository.capNhatViTri(id, truong, ketNoi);
    const thayDoi = Object.keys(truong).map((cot) => `${cot}: ${viTri[cot] ?? 'trống'} -> ${truong[cot] ?? 'trống'}`).join('; ');
    await themNhatKy(nguoiDung.nguoiDungId, 'SUA_VI_TRI', diaChiIP, `${viTri.tenChucDanh} - ${viTri.tenPhongBan}: ${thayDoi}`, ketNoi);
  });
  return layViTri(id);
}

// Ngừng vị trí khi không còn ai giữ; áp dụng lại khi phòng ban và chức danh đang hoạt động
async function doiTrangThaiViTri(nguoiDung, id, trangThai, diaChiIP) {
  await chayTransaction(async (ketNoi) => {
    const viTri = await khoaViTriHoacLoi(id, ketNoi);
    if (viTri.trangThai === trangThai) throw new LoiUngDung(400, 'Vị trí đã ở trạng thái này');
    if (trangThai === 'NGUNG_AP_DUNG') {
      const soDangGiu = await nhanVienRepository.demTheoViTri(id, null, ketNoi);
      if (soDangGiu) throw new LoiUngDung(409, `Vị trí còn ${soDangGiu} người đang giữ, cần điều chuyển trước`);
    } else if (viTri.trangThaiPhongBan !== 'DANG_HOAT_DONG' || viTri.trangThaiChucDanh !== 'DANG_HOAT_DONG') {
      throw new LoiUngDung(409, 'Phòng ban hoặc chức danh của vị trí đã ngừng hoạt động');
    }
    await phongBanRepository.capNhatViTri(id, { trangThai }, ketNoi);
    const hanhDong = trangThai === 'NGUNG_AP_DUNG' ? 'NGUNG_VI_TRI' : 'AP_DUNG_VI_TRI';
    await themNhatKy(nguoiDung.nguoiDungId, hanhDong, diaChiIP, `${viTri.tenChucDanh} - ${viTri.tenPhongBan}`, ketNoi);
  });
  return layViTri(id);
}

module.exports = {
  TRANG_THAI_PHONG_BAN,
  TRANG_THAI_CHUC_DANH,
  TRANG_THAI_VI_TRI,
  layDanhSachPhongBan,
  layChiTietPhongBan,
  layDanhSachChucDanh,
  layDanhSachViTri,
  themPhongBan,
  suaPhongBan,
  doiTrangThaiPhongBan,
  boNhiemTruongBoPhan,
  mienNhiemTruongBoPhan,
  themChucDanh,
  suaChucDanh,
  doiTrangThaiChucDanh,
  themViTri,
  suaViTri,
  doiTrangThaiViTri,
};
