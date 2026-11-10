const { pool } = require('../config/ketNoiCsdl');

// Thứ tự khóa (theo quy ước ở chamCongRepository): nhanvien -> loainghiphep (khóa chia sẻ) -> dondexuatnghiphep -> quyngayphep.
// Chưa khóa phongban khi duyệt: miễn nhiệm trưởng đúng lúc đang duyệt vẫn có thể commit theo cây cũ (rủi ro thấp, đã ghi Hạn chế đã biết)

function chuanHoaSo(dong, cacCot) {
  if (!dong) return null;
  const ketQua = { ...dong };
  for (const cot of cacCot) if (ketQua[cot] !== null && ketQua[cot] !== undefined) ketQua[cot] = Number(ketQua[cot]);
  return ketQua;
}

function themDieuKienPhamVi(dieuKien, thamSo, { phamViPhongBanIds, phongBanId, tuKhoa }) {
  if (phamViPhongBanIds) {
    dieuKien.push(`cdpb.phongBanId IN (${phamViPhongBanIds.map(() => '?').join(', ')})`);
    thamSo.push(...phamViPhongBanIds);
  }
  if (phongBanId) {
    dieuKien.push('cdpb.phongBanId = ?');
    thamSo.push(phongBanId);
  }
  if (tuKhoa) {
    dieuKien.push('(nv.maNhanVien LIKE ? OR nv.hoVaTen LIKE ?)');
    const mau = `%${tuKhoa.replace(/[\\%_]/g, '\\$&')}%`;
    thamSo.push(mau, mau);
  }
}

// ===================== Loại nghỉ phép =====================

const COT_LOAI = 'id, maLoai, tenLoai, soNgayToiDa, coLuong, truVaoQuyPhepNam, moTa, trangThai';
const COT_CAP_NHAT_LOAI = ['tenLoai', 'soNgayToiDa', 'coLuong', 'truVaoQuyPhepNam', 'moTa', 'trangThai'];

function chuanHoaLoai(dong) {
  if (!dong) return null;
  return {
    ...chuanHoaSo(dong, ['soNgayToiDa']),
    coLuong: Boolean(dong.coLuong),
    truVaoQuyPhepNam: Boolean(dong.truVaoQuyPhepNam),
  };
}

async function layDanhSachLoai({ trangThai }) {
  const [dong] = await pool.query(
    `SELECT ${COT_LOAI}, (SELECT COUNT(*) FROM dondexuatnghiphep d WHERE d.loaiNghiPhepId = l.id) AS soDon
       FROM loainghiphep l ${trangThai ? 'WHERE trangThai = ?' : ''} ORDER BY id`,
    trangThai ? [trangThai] : [],
  );
  return dong.map((d) => ({ ...chuanHoaLoai(d), soDon: Number(d.soDon) }));
}

// khoa: 'FOR UPDATE' khi sửa loại; 'LOCK IN SHARE MODE' khi tạo đơn (chặn đổi cờ trừ quỹ đúng lúc đơn đang tạo)
async function layLoaiTheoId(id, ketNoi = pool, khoa = '') {
  const [dong] = await ketNoi.execute(`SELECT ${COT_LOAI} FROM loainghiphep WHERE id = ? ${khoa}`, [id]);
  return chuanHoaLoai(dong[0]);
}

async function themLoai(loai, ketNoi) {
  const [ketQua] = await ketNoi.execute(
    `INSERT INTO loainghiphep (maLoai, tenLoai, soNgayToiDa, coLuong, truVaoQuyPhepNam, moTa)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [loai.maLoai, loai.tenLoai, loai.soNgayToiDa ?? null, loai.coLuong ? 1 : 0, loai.truVaoQuyPhepNam ? 1 : 0, loai.moTa ?? null],
  );
  return ketQua.insertId;
}

async function capNhatLoai(id, truong, ketNoi) {
  const cot = Object.keys(truong).filter((c) => COT_CAP_NHAT_LOAI.includes(c));
  if (!cot.length) return;
  const giaTri = cot.map((c) => (typeof truong[c] === 'boolean' ? Number(truong[c]) : truong[c]));
  await ketNoi.execute(`UPDATE loainghiphep SET ${cot.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...giaTri, id]);
}

async function demDonTheoLoai(loaiNghiPhepId, ketNoi) {
  const [[dong]] = await ketNoi.execute('SELECT COUNT(*) AS soLuong FROM dondexuatnghiphep WHERE loaiNghiPhepId = ?', [loaiNghiPhepId]);
  return Number(dong.soLuong);
}

// ===================== Quỹ phép năm =====================

const COT_QUY = 'id, nhanVienId, namHieuLuc, tongSoNgayPhep, soNgayDaNghi, ngayCapNhat';

async function layQuy(nhanVienId, nam, ketNoi = pool, khoa = false) {
  const [dong] = await ketNoi.execute(
    `SELECT ${COT_QUY} FROM quyngayphep WHERE nhanVienId = ? AND namHieuLuc = ?${khoa ? ' FOR UPDATE' : ''}`,
    [nhanVienId, nam],
  );
  return chuanHoaSo(dong[0], ['tongSoNgayPhep', 'soNgayDaNghi']);
}

async function layQuyTheoId(id, ketNoi = pool, khoa = false) {
  const [dong] = await ketNoi.execute(`SELECT ${COT_QUY} FROM quyngayphep WHERE id = ?${khoa ? ' FOR UPDATE' : ''}`, [id]);
  return chuanHoaSo(dong[0], ['tongSoNgayPhep', 'soNgayDaNghi']);
}

async function capNhatTongQuy(id, tongSoNgayPhep, ketNoi) {
  await ketNoi.execute('UPDATE quyngayphep SET tongSoNgayPhep = ? WHERE id = ?', [tongSoNgayPhep, id]);
}

async function congNgayDaNghi(id, soNgay, ketNoi) {
  await ketNoi.execute('UPDATE quyngayphep SET soNgayDaNghi = soNgayDaNghi + ? WHERE id = ?', [soNgay, id]);
}

// Nhân viên chưa nghỉ việc, đã vào làm trước hết năm và chưa có quỹ năm đó (người đã có quỹ giữ nguyên).
// LOCK IN SHARE MODE: không cho HR đổi ngày vào làm/trạng thái giữa lúc tính số ngày phép.
async function layNhanVienChuaCoQuy(nam, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT nv.id, DATE_FORMAT(nv.ngayVaoLam, '%Y-%m-%d') AS ngayVaoLam FROM nhanvien nv
      WHERE nv.trangThaiLamViec <> 'DA_NGHI_VIEC' AND nv.ngayVaoLam <= ?
        AND NOT EXISTS (SELECT 1 FROM quyngayphep q WHERE q.nhanVienId = nv.id AND q.namHieuLuc = ?)
      ORDER BY nv.id LOCK IN SHARE MODE`,
    [`${nam}-12-31`, nam],
  );
  return dong;
}

// cacQuy: [{ nhanVienId, tongSoNgayPhep }]
async function capQuyHangLoat(nam, cacQuy, ketNoi) {
  if (cacQuy.length === 0) return 0;
  const [ketQua] = await ketNoi.query('INSERT INTO quyngayphep (nhanVienId, namHieuLuc, tongSoNgayPhep, soNgayDaNghi) VALUES ?', [
    cacQuy.map((q) => [q.nhanVienId, nam, q.tongSoNgayPhep, 0]),
  ]);
  return ketQua.affectedRows;
}

// Tổng ngày của đơn CHO_DUYET (loại trừ quỹ) trong năm, đã giữ chỗ trong quỹ
const SQL_CHO_DUYET_NAM = `SELECT COALESCE(SUM(d.soNgayNghi), 0) FROM dondexuatnghiphep d
       JOIN loainghiphep l ON l.id = d.loaiNghiPhepId
      WHERE d.nhanVienId = nv.id AND d.trangThai = 'CHO_DUYET' AND l.truVaoQuyPhepNam = 1 AND YEAR(d.ngayBatDau) = ?`;

async function demNgayChoDuyetTrongNam(nhanVienId, nam, boQuaDonId, ketNoi = pool) {
  const [[dong]] = await ketNoi.execute(
    `SELECT COALESCE(SUM(d.soNgayNghi), 0) AS soNgay FROM dondexuatnghiphep d
       JOIN loainghiphep l ON l.id = d.loaiNghiPhepId
      WHERE d.nhanVienId = ? AND d.trangThai = 'CHO_DUYET' AND l.truVaoQuyPhepNam = 1
        AND YEAR(d.ngayBatDau) = ? AND d.id <> ?`,
    [nhanVienId, nam, boQuaDonId ?? 0],
  );
  return Number(dong.soNgay);
}

// Danh sách quỹ phép theo nhân viên (cả người chưa được cấp: quyId null)
async function layDanhSachQuy({ nam, phamViPhongBanIds, phongBanId, tuKhoa, viTri, soLuong }) {
  if (phamViPhongBanIds && phamViPhongBanIds.length === 0) return { items: [], tongSo: 0 };
  const dieuKien = ["nv.trangThaiLamViec <> 'DA_NGHI_VIEC'"];
  const thamSo = [];
  themDieuKienPhamVi(dieuKien, thamSo, { phamViPhongBanIds, phongBanId, tuKhoa });
  const bangNoi = `FROM nhanvien nv
       JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId
       JOIN phongban pb ON pb.id = cdpb.phongBanId
       LEFT JOIN quyngayphep q ON q.nhanVienId = nv.id AND q.namHieuLuc = ?
      WHERE ${dieuKien.join(' AND ')}`;
  const [[dem]] = await pool.query(`SELECT COUNT(*) AS tongSo ${bangNoi}`, [nam, ...thamSo]);
  const [items] = await pool.query(
    `SELECT nv.id AS nhanVienId, nv.maNhanVien, nv.hoVaTen, cdpb.phongBanId, pb.tenPhongBan, nv.trangThaiLamViec,
            q.id AS quyId, q.tongSoNgayPhep, q.soNgayDaNghi, (${SQL_CHO_DUYET_NAM}) AS soNgayChoDuyet
       ${bangNoi}
      ORDER BY nv.maNhanVien LIMIT ? OFFSET ?`,
    [nam, nam, ...thamSo, soLuong, viTri],
  );
  return {
    items: items.map((d) => chuanHoaSo(d, ['tongSoNgayPhep', 'soNgayDaNghi', 'soNgayChoDuyet'])),
    tongSo: Number(dem.tongSo),
  };
}

// ===================== Đơn nghỉ phép =====================

const COT_DON = `d.id, d.maDon, d.nhanVienId, nv.maNhanVien, nv.hoVaTen, cdpb.phongBanId, pb.tenPhongBan,
       d.loaiNghiPhepId, l.maLoai, l.tenLoai, l.coLuong, l.truVaoQuyPhepNam,
       d.ngayBatDau, d.ngayKetThuc, d.soNgayNghi, d.lyDo, d.phuongThucTao, d.trangThai,
       d.nguoiDuyetId, nd.maNhanVien AS maNguoiDuyet, nd.hoVaTen AS tenNguoiDuyet, d.lyDoTuChoi, d.thoiGianDuyet, d.ngayTao`;

const BANG_NOI_DON = `FROM dondexuatnghiphep d
       JOIN nhanvien nv ON nv.id = d.nhanVienId
       JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId
       JOIN phongban pb ON pb.id = cdpb.phongBanId
       JOIN loainghiphep l ON l.id = d.loaiNghiPhepId
       LEFT JOIN nhanvien nd ON nd.id = d.nguoiDuyetId`;

function chuanHoaDon(dong) {
  if (!dong) return null;
  return { ...chuanHoaSo(dong, ['soNgayNghi']), coLuong: Boolean(dong.coLuong), truVaoQuyPhepNam: Boolean(dong.truVaoQuyPhepNam) };
}

async function layDonTheoId(id, ketNoi = pool) {
  const [dong] = await ketNoi.execute(`SELECT ${COT_DON} ${BANG_NOI_DON} WHERE d.id = ?`, [id]);
  return chuanHoaDon(dong[0]);
}

async function khoaDon(id, ketNoi) {
  const [dong] = await ketNoi.execute(
    'SELECT id, nhanVienId, loaiNghiPhepId, ngayBatDau, ngayKetThuc, soNgayNghi, trangThai FROM dondexuatnghiphep WHERE id = ? FOR UPDATE',
    [id],
  );
  return chuanHoaSo(dong[0], ['soNgayNghi']);
}

// Đơn còn hiệu lực (chờ duyệt / đã duyệt) chồng lấn khoảng ngày
// Mọi đơn CHO_DUYET/DA_DUYET giao với khoảng ngày (service quyết định cặp nửa ngày sáng + chiều có hợp lệ không)
async function timDonChongLan(nhanVienId, tuNgay, denNgay, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT id, maDon, ngayBatDau, ngayKetThuc, soNgayNghi FROM dondexuatnghiphep
      WHERE nhanVienId = ? AND trangThai IN ('CHO_DUYET', 'DA_DUYET') AND ngayBatDau <= ? AND ngayKetThuc >= ?
      ORDER BY id`,
    [nhanVienId, denNgay, tuNgay],
  );
  return dong.map((d) => ({ ...d, soNgayNghi: Number(d.soNgayNghi) }));
}

// Chốt công: các đơn chờ duyệt có ngày nghỉ giao với khoảng (mã đơn + người gửi để HR biết cần nhắc ai)
async function layDonChoDuyetTrongKhoang(tuNgay, denNgay, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT d.maDon, nv.maNhanVien FROM dondexuatnghiphep d JOIN nhanvien nv ON nv.id = d.nhanVienId
      WHERE d.trangThai = 'CHO_DUYET' AND d.ngayBatDau <= ? AND d.ngayKetThuc >= ? ORDER BY d.id`,
    [denNgay, tuNgay],
  );
  return dong;
}

// giamDoc khác (tài khoản hoạt động, đang làm việc) còn lại để duyệt đơn của một giamDoc
async function demGiamDocHoatDongKhac(nhanVienId, ketNoi = pool) {
  const [[dong]] = await ketNoi.execute(
    `SELECT COUNT(DISTINCT nv.id) AS soLuong FROM nhanvien nv
       JOIN nguoidung nd ON nd.id = nv.nguoiDungId AND nd.trangThai = 'DANG_HOAT_DONG'
       JOIN nguoidungvaitro ndvt ON ndvt.nguoiDungId = nd.id
       JOIN vaitro vt ON vt.id = ndvt.vaiTroId AND vt.maVaiTro = 'giamDoc'
      WHERE nv.id <> ? AND nv.trangThaiLamViec NOT IN ('TAM_NGHI', 'DA_NGHI_VIEC')`,
    [nhanVienId],
  );
  return Number(dong.soLuong);
}

// Số thứ tự mã DNPyyyy-xxxx lớn nhất của năm ('DNP2026-' dài 8 ký tự)
async function laySoMaLonNhat(nam, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT MAX(CAST(SUBSTRING(maDon, 9) AS UNSIGNED)) AS soLonNhat
       FROM dondexuatnghiphep WHERE maDon LIKE ? FOR UPDATE`,
    [`DNP${nam}-%`],
  );
  return Number(dong[0].soLonNhat ?? 0);
}

async function themDon(don, ketNoi) {
  const [ketQua] = await ketNoi.execute(
    `INSERT INTO dondexuatnghiphep (maDon, nhanVienId, loaiNghiPhepId, ngayBatDau, ngayKetThuc, soNgayNghi, lyDo, phuongThucTao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [don.maDon, don.nhanVienId, don.loaiNghiPhepId, don.ngayBatDau, don.ngayKetThuc, don.soNgayNghi, don.lyDo, don.phuongThucTao],
  );
  return ketQua.insertId;
}

async function capNhatTrangThaiDon(id, { trangThai, nguoiDuyetId, lyDoTuChoi }, ketNoi) {
  await ketNoi.execute(
    `UPDATE dondexuatnghiphep
        SET trangThai = ?, nguoiDuyetId = ?, lyDoTuChoi = ?, thoiGianDuyet = IF(? IS NULL, NULL, NOW())
      WHERE id = ?`,
    [trangThai, nguoiDuyetId ?? null, lyDoTuChoi ?? null, nguoiDuyetId ?? null, id],
  );
}

// boLoc.nhanVienId: đơn của một người; phamViPhongBanIds: null = toàn công ty.
// tuNgay/denNgay: đơn có ngày nghỉ giao với khoảng; cacTrangThai: lọc nhiều trạng thái (lịch nghỉ)
async function layDanhSachDon({
  nhanVienId,
  phamViPhongBanIds,
  phongBanId,
  tuKhoa,
  trangThai,
  cacTrangThai,
  loaiNghiPhepId,
  tuNgay,
  denNgay,
  viTri,
  soLuong,
}) {
  if (phamViPhongBanIds && phamViPhongBanIds.length === 0) return { items: [], tongSo: 0 };
  const dieuKien = [];
  const thamSo = [];
  if (nhanVienId) {
    dieuKien.push('d.nhanVienId = ?');
    thamSo.push(nhanVienId);
  }
  themDieuKienPhamVi(dieuKien, thamSo, { phamViPhongBanIds, phongBanId, tuKhoa });
  if (trangThai) {
    dieuKien.push('d.trangThai = ?');
    thamSo.push(trangThai);
  }
  if (cacTrangThai) {
    dieuKien.push(`d.trangThai IN (${cacTrangThai.map(() => '?').join(', ')})`);
    thamSo.push(...cacTrangThai);
  }
  if (loaiNghiPhepId) {
    dieuKien.push('d.loaiNghiPhepId = ?');
    thamSo.push(loaiNghiPhepId);
  }
  if (tuNgay && denNgay) {
    dieuKien.push('d.ngayBatDau <= ? AND d.ngayKetThuc >= ?');
    thamSo.push(denNgay, tuNgay);
  }
  const where = dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : '';
  const [[dem]] = await pool.query(`SELECT COUNT(*) AS tongSo ${BANG_NOI_DON} ${where}`, thamSo);
  const [items] = await pool.query(
    `SELECT ${COT_DON} ${BANG_NOI_DON} ${where}
      ORDER BY (d.trangThai = 'CHO_DUYET') DESC, d.ngayTao DESC, d.id DESC
      LIMIT ? OFFSET ?`,
    [...thamSo, soLuong, viTri],
  );
  return { items: items.map(chuanHoaDon), tongSo: Number(dem.tongSo) };
}

module.exports = {
  layDanhSachLoai,
  layLoaiTheoId,
  themLoai,
  capNhatLoai,
  demDonTheoLoai,
  layQuy,
  layQuyTheoId,
  capNhatTongQuy,
  congNgayDaNghi,
  layNhanVienChuaCoQuy,
  capQuyHangLoat,
  demNgayChoDuyetTrongNam,
  layDanhSachQuy,
  layDonTheoId,
  khoaDon,
  timDonChongLan,
  layDonChoDuyetTrongKhoang,
  demGiamDocHoatDongKhac,
  laySoMaLonNhat,
  themDon,
  capNhatTrangThaiDon,
  layDanhSachDon,
};
