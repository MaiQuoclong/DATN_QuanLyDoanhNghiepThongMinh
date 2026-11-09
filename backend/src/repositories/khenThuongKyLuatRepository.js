const { pool } = require('../config/ketNoiCsdl');

// Người dùng của nhân viên có vai trò giamDoc (người được ký quyết định)
const SQL_LA_GIAM_DOC = `EXISTS (SELECT 1 FROM nguoidungvaitro ndvt JOIN vaitro vt ON vt.id = ndvt.vaiTroId
  WHERE ndvt.nguoiDungId = nv.nguoiDungId AND vt.maVaiTro = 'giamDoc')`;

const thoatLike = (tuKhoa) => `%${String(tuKhoa).replace(/[\\%_]/g, '\\$&')}%`;

function themDieuKienIn(dieuKien, thamSo, cot, danhSach) {
  if (!danhSach) return;
  if (!danhSach.length) {
    dieuKien.push('1 = 0');
    return;
  }
  dieuKien.push(`${cot} IN (${danhSach.map(() => '?').join(', ')})`);
  thamSo.push(...danhSach);
}

// Nhân viên kèm phòng ban hiện tại và cờ giamDoc (kiểm tra phạm vi, người ký)
async function layNhanVienCoBan(id, ketNoi = pool) {
  const [dong] = await ketNoi.execute(
    `SELECT nv.id, nv.maNhanVien, nv.hoVaTen, nv.trangThaiLamViec, cdpb.phongBanId, ${SQL_LA_GIAM_DOC} AS laGiamDoc,
            nd.trangThai AS trangThaiTaiKhoan
       FROM nhanvien nv LEFT JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId
       LEFT JOIN nguoidung nd ON nd.id = nv.nguoiDungId
      WHERE nv.id = ?`,
    [id],
  );
  return dong[0] ? { ...dong[0], laGiamDoc: Boolean(dong[0].laGiamDoc) } : null;
}

// Giám đốc đang làm việc, tài khoản hoạt động (danh sách người ký)
async function layDanhSachNguoiKy() {
  const [dong] = await pool.execute(
    `SELECT nv.id, nv.maNhanVien, nv.hoVaTen FROM nhanvien nv
       JOIN nguoidung nd ON nd.id = nv.nguoiDungId
      WHERE ${SQL_LA_GIAM_DOC} AND nv.trangThaiLamViec IN ('THU_VIEC', 'CHINH_THUC') AND nd.trangThai = 'DANG_HOAT_DONG'
      ORDER BY nv.maNhanVien`,
  );
  return dong;
}

// Bảng lương của tháng (khóa để chặn chốt lương đồng thời khi ban hành quyết định)
async function khoaBangLuongTheoThang(thang, nam, ketNoi) {
  const [dong] = await ketNoi.execute(
    'SELECT id, maBangLuong, thang, nam, trangThai FROM bangtonghopluong WHERE thang = ? AND nam = ? FOR UPDATE',
    [thang, nam],
  );
  return dong[0] ?? null;
}

// ===================== Đề xuất =====================

const COT_DE_XUAT = `dx.id, dx.nguoiDeXuatId, ndx.maNhanVien AS maNguoiDeXuat, ndx.hoVaTen AS tenNguoiDeXuat,
       dx.nhanVienId, nv.maNhanVien, nv.hoVaTen, pb.tenPhongBan,
       dx.loaiDeXuat, dx.tieuDe, dx.lyDo, dx.soTienDeXuat, dx.trangThai,
       dx.nguoiXuLyId, nxl.hoVaTen AS tenNguoiXuLy, dx.ghiChuXuLy,
       dx.quyetDinhId, qd.soQuyetDinh, dx.ngayTao, dx.ngayCapNhat`;
const NOI_DE_XUAT = `FROM dexuatkhenthuongkyluat dx
       JOIN nhanvien ndx ON ndx.id = dx.nguoiDeXuatId
       JOIN nhanvien nv ON nv.id = dx.nhanVienId
       LEFT JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId
       LEFT JOIN phongban pb ON pb.id = cdpb.phongBanId
       LEFT JOIN nhanvien nxl ON nxl.id = dx.nguoiXuLyId
       LEFT JOIN quyetdinhkhenthuongkyluat qd ON qd.id = dx.quyetDinhId`;

const chuanHoaDeXuat = (d) => d && { ...d, soTienDeXuat: Number(d.soTienDeXuat ?? 0) };

function dieuKienDeXuat({ trangThai, loaiDeXuat, nguoiDeXuatId, tuKhoa }) {
  const dieuKien = [];
  const thamSo = [];
  if (trangThai) {
    dieuKien.push('dx.trangThai = ?');
    thamSo.push(trangThai);
  }
  if (loaiDeXuat) {
    dieuKien.push('dx.loaiDeXuat = ?');
    thamSo.push(loaiDeXuat);
  }
  if (nguoiDeXuatId) {
    dieuKien.push('dx.nguoiDeXuatId = ?');
    thamSo.push(nguoiDeXuatId);
  }
  if (tuKhoa) {
    const mau = thoatLike(tuKhoa);
    dieuKien.push('(nv.maNhanVien LIKE ? OR nv.hoVaTen LIKE ? OR dx.tieuDe LIKE ?)');
    thamSo.push(mau, mau, mau);
  }
  return { where: dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : '', thamSo };
}

async function layDanhSachDeXuat(boLoc, { viTri, soLuong }) {
  const { where, thamSo } = dieuKienDeXuat(boLoc);
  const [dong] = await pool.query(
    `SELECT ${COT_DE_XUAT} ${NOI_DE_XUAT} ${where}
      ORDER BY FIELD(dx.trangThai, 'CHO_DUYET') DESC, dx.ngayTao DESC, dx.id DESC LIMIT ? OFFSET ?`,
    [...thamSo, Number(soLuong), Number(viTri)],
  );
  const [[dem]] = await pool.query(`SELECT COUNT(*) AS tongSo ${NOI_DE_XUAT} ${where}`, thamSo);
  return { items: dong.map(chuanHoaDeXuat), tongSo: Number(dem.tongSo) };
}

async function layDeXuatTheoId(id, ketNoi = pool) {
  const [dong] = await ketNoi.execute(`SELECT ${COT_DE_XUAT} ${NOI_DE_XUAT} WHERE dx.id = ?`, [id]);
  return chuanHoaDeXuat(dong[0]) ?? null;
}

async function khoaDeXuat(id, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT id, nguoiDeXuatId, nhanVienId, loaiDeXuat, tieuDe, lyDo, soTienDeXuat, trangThai
       FROM dexuatkhenthuongkyluat WHERE id = ? FOR UPDATE`,
    [id],
  );
  return dong[0] ? { ...dong[0], soTienDeXuat: Number(dong[0].soTienDeXuat ?? 0) } : null;
}

async function themDeXuat({ nguoiDeXuatId, nhanVienId, loaiDeXuat, tieuDe, lyDo, soTienDeXuat }, ketNoi) {
  const [kq] = await ketNoi.execute(
    `INSERT INTO dexuatkhenthuongkyluat (nguoiDeXuatId, nhanVienId, loaiDeXuat, tieuDe, lyDo, soTienDeXuat, trangThai)
     VALUES (?, ?, ?, ?, ?, ?, 'CHO_DUYET')`,
    [nguoiDeXuatId, nhanVienId, loaiDeXuat, tieuDe, lyDo, soTienDeXuat],
  );
  return kq.insertId;
}

const COT_SUA_DE_XUAT = ['loaiDeXuat', 'tieuDe', 'lyDo', 'soTienDeXuat', 'trangThai', 'nguoiXuLyId', 'ghiChuXuLy', 'quyetDinhId'];

async function capNhatDeXuat(id, thayDoi, ketNoi) {
  const cot = Object.keys(thayDoi).filter((k) => COT_SUA_DE_XUAT.includes(k));
  if (!cot.length) return;
  await ketNoi.execute(`UPDATE dexuatkhenthuongkyluat SET ${cot.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [
    ...cot.map((k) => thayDoi[k]),
    id,
  ]);
}

async function xoaDeXuat(id, ketNoi) {
  await ketNoi.execute('DELETE FROM dexuatkhenthuongkyluat WHERE id = ?', [id]);
}

// ===================== Quyết định =====================

const COT_QUYET_DINH = `qd.id, qd.soQuyetDinh, qd.nhanVienId, nv.maNhanVien, nv.hoVaTen, pb.id AS phongBanId, pb.tenPhongBan,
       qd.loaiQuyetDinh, qd.tieuDe, qd.soTien, qd.lyDo, qd.ngayBanHanh,
       qd.nguoiKyDuyetId, nk.maNhanVien AS maNguoiKy, nk.hoVaTen AS tenNguoiKy,
       (SELECT dx.id FROM dexuatkhenthuongkyluat dx WHERE dx.quyetDinhId = qd.id LIMIT 1) AS deXuatId`;
const NOI_QUYET_DINH = `FROM quyetdinhkhenthuongkyluat qd
       JOIN nhanvien nv ON nv.id = qd.nhanVienId
       LEFT JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId
       LEFT JOIN phongban pb ON pb.id = cdpb.phongBanId
       JOIN nhanvien nk ON nk.id = qd.nguoiKyDuyetId`;

const chuanHoaQuyetDinh = (d) => d && { ...d, soTien: Number(d.soTien ?? 0) };

// phamVi: null = toàn công ty; { phongBanIds, nhanVienId } = phòng ban quản lý + của chính mình
function dieuKienQuyetDinh({ loaiQuyetDinh, nhanVienId, phongBanId, nam, tuKhoa, phamVi }) {
  const dieuKien = [];
  const thamSo = [];
  if (loaiQuyetDinh) {
    dieuKien.push('qd.loaiQuyetDinh = ?');
    thamSo.push(loaiQuyetDinh);
  }
  if (nhanVienId) {
    dieuKien.push('qd.nhanVienId = ?');
    thamSo.push(nhanVienId);
  }
  if (phongBanId) {
    dieuKien.push('cdpb.phongBanId = ?');
    thamSo.push(phongBanId);
  }
  if (nam) {
    dieuKien.push('YEAR(qd.ngayBanHanh) = ?');
    thamSo.push(nam);
  }
  if (tuKhoa) {
    const mau = thoatLike(tuKhoa);
    dieuKien.push('(qd.soQuyetDinh LIKE ? OR nv.maNhanVien LIKE ? OR nv.hoVaTen LIKE ? OR qd.tieuDe LIKE ?)');
    thamSo.push(mau, mau, mau, mau);
  }
  if (phamVi) {
    const trong = [];
    themDieuKienIn(trong, thamSo, 'cdpb.phongBanId', phamVi.phongBanIds);
    dieuKien.push(`(${trong[0]} OR qd.nhanVienId = ?)`);
    thamSo.push(phamVi.nhanVienId ?? 0);
  }
  return { where: dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : '', thamSo };
}

async function layDanhSachQuyetDinh(boLoc, { viTri, soLuong }) {
  const { where, thamSo } = dieuKienQuyetDinh(boLoc);
  const [dong] = await pool.query(
    `SELECT ${COT_QUYET_DINH} ${NOI_QUYET_DINH} ${where}
      ORDER BY qd.ngayBanHanh DESC, qd.id DESC LIMIT ? OFFSET ?`,
    [...thamSo, Number(soLuong), Number(viTri)],
  );
  const [[tong]] = await pool.query(
    `SELECT COUNT(*) AS tongSo,
            COALESCE(SUM(CASE WHEN qd.loaiQuyetDinh = 'KHEN_THUONG' THEN qd.soTien END), 0) AS tongKhenThuong,
            COALESCE(SUM(CASE WHEN qd.loaiQuyetDinh = 'KY_LUAT' THEN qd.soTien END), 0) AS tongKyLuat,
            SUM(qd.loaiQuyetDinh = 'KHEN_THUONG') AS soKhenThuong, SUM(qd.loaiQuyetDinh = 'KY_LUAT') AS soKyLuat
       ${NOI_QUYET_DINH} ${where}`,
    thamSo,
  );
  return {
    items: dong.map(chuanHoaQuyetDinh),
    tongSo: Number(tong.tongSo),
    thongKe: {
      soKhenThuong: Number(tong.soKhenThuong ?? 0),
      soKyLuat: Number(tong.soKyLuat ?? 0),
      tongKhenThuong: Number(tong.tongKhenThuong),
      tongKyLuat: Number(tong.tongKyLuat),
    },
  };
}

async function layQuyetDinhTheoId(id, ketNoi = pool) {
  const [dong] = await ketNoi.execute(`SELECT ${COT_QUYET_DINH} ${NOI_QUYET_DINH} WHERE qd.id = ?`, [id]);
  return chuanHoaQuyetDinh(dong[0]) ?? null;
}

// Số quyết định tự sinh QD<năm>-NNNN: khóa số lớn nhất của năm để hai request không lấy trùng
async function laySoQuyetDinhTiepTheo(nam, ketNoi) {
  const tienTo = `QD${nam}-`;
  const [dong] = await ketNoi.execute(
    `SELECT soQuyetDinh FROM quyetdinhkhenthuongkyluat
      WHERE soQuyetDinh LIKE ? AND soQuyetDinh REGEXP ? ORDER BY CHAR_LENGTH(soQuyetDinh) DESC, soQuyetDinh DESC LIMIT 1 FOR UPDATE`,
    [`${tienTo}%`, `^QD${nam}-[0-9]+$`],
  );
  const so = dong[0] ? Number(dong[0].soQuyetDinh.slice(tienTo.length)) + 1 : 1;
  return `${tienTo}${String(so).padStart(4, '0')}`;
}

async function themQuyetDinh({ soQuyetDinh, nhanVienId, loaiQuyetDinh, tieuDe, soTien, lyDo, ngayBanHanh, nguoiKyDuyetId }, ketNoi) {
  const [kq] = await ketNoi.execute(
    `INSERT INTO quyetdinhkhenthuongkyluat (soQuyetDinh, nhanVienId, loaiQuyetDinh, tieuDe, soTien, lyDo, ngayBanHanh, nguoiKyDuyetId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [soQuyetDinh, nhanVienId, loaiQuyetDinh, tieuDe, soTien, lyDo, ngayBanHanh, nguoiKyDuyetId],
  );
  return kq.insertId;
}

module.exports = {
  layNhanVienCoBan,
  layDanhSachNguoiKy,
  khoaBangLuongTheoThang,
  layDanhSachDeXuat,
  layDeXuatTheoId,
  khoaDeXuat,
  themDeXuat,
  capNhatDeXuat,
  xoaDeXuat,
  layDanhSachQuyetDinh,
  layQuyetDinhTheoId,
  laySoQuyetDinhTiepTheo,
  themQuyetDinh,
};
