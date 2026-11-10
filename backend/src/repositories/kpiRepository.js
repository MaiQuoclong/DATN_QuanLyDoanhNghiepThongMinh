const { pool } = require('../config/ketNoiCsdl');

// Điều kiện lọc theo danh sách id: mảng rỗng -> không khớp dòng nào (quanLy không phụ trách phòng nào)
function themDieuKienIn(dieuKien, thamSo, cot, ids) {
  if (!ids) return;
  if (!ids.length) {
    dieuKien.push('1 = 0');
    return;
  }
  dieuKien.push(`${cot} IN (${ids.map(() => '?').join(', ')})`);
  thamSo.push(...ids);
}

// ===================== Kỳ đánh giá =====================

const COT_KY = `k.id, k.tenKyDanhGia, k.ngayBatDau, k.ngayKetThuc, k.trangThai,
  (SELECT COUNT(*) FROM phieudanhgiakpi p WHERE p.kyDanhGiaId = k.id) AS soPhieu,
  (SELECT COUNT(*) FROM phieudanhgiakpi p WHERE p.kyDanhGiaId = k.id AND p.trangThai = 'CHO_DUYET') AS soPhieuChoDuyet,
  (SELECT COUNT(*) FROM phieudanhgiakpi p WHERE p.kyDanhGiaId = k.id AND p.trangThai = 'DA_DUYET') AS soPhieuDaDuyet`;

async function layDanhSachKy({ trangThai }) {
  const dieuKien = [];
  const thamSo = [];
  if (trangThai) {
    dieuKien.push('k.trangThai = ?');
    thamSo.push(trangThai);
  }
  const [dong] = await pool.execute(
    `SELECT ${COT_KY} FROM kydanhgiakpi k ${dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : ''}
      ORDER BY k.ngayBatDau DESC, k.id DESC`,
    thamSo,
  );
  return dong;
}

async function layKyTheoId(id, ketNoi = pool) {
  const [dong] = await ketNoi.execute(`SELECT ${COT_KY} FROM kydanhgiakpi k WHERE k.id = ?`, [id]);
  return dong[0] ?? null;
}

// khoa: 'UPDATE' (đóng/sửa kỳ) | 'SHARE' (thao tác trên phiếu: chặn đóng kỳ đúng lúc đang chấm)
async function khoaKy(id, ketNoi, khoa = 'UPDATE') {
  const [dong] = await ketNoi.execute(
    `SELECT id, tenKyDanhGia, ngayBatDau, ngayKetThuc, trangThai FROM kydanhgiakpi WHERE id = ? ${khoa === 'SHARE' ? 'LOCK IN SHARE MODE' : 'FOR UPDATE'}`,
    [id],
  );
  return dong[0] ?? null;
}

// Gọi trong transaction: cột tên không có index nên FOR UPDATE quét và khóa cả bảng (kèm gap),
// tuần tự hóa hai request cùng tạo/đổi tên kỳ -> không chèn trùng tên (schema không có UNIQUE)
async function timKyTheoTen(tenKyDanhGia, boQuaId, ketNoi) {
  const [dong] = await ketNoi.execute('SELECT id FROM kydanhgiakpi WHERE tenKyDanhGia = ? AND id <> ? FOR UPDATE', [tenKyDanhGia, boQuaId]);
  return dong[0] ?? null;
}

async function themKy({ tenKyDanhGia, ngayBatDau, ngayKetThuc }, ketNoi) {
  const [kq] = await ketNoi.execute(
    "INSERT INTO kydanhgiakpi (tenKyDanhGia, ngayBatDau, ngayKetThuc, trangThai) VALUES (?, ?, ?, 'DANG_MO')",
    [tenKyDanhGia, ngayBatDau, ngayKetThuc],
  );
  return kq.insertId;
}

const COT_SUA_KY = ['tenKyDanhGia', 'ngayBatDau', 'ngayKetThuc', 'trangThai'];
async function capNhatKy(id, truong, ketNoi) {
  const cot = Object.keys(truong).filter((c) => COT_SUA_KY.includes(c));
  if (!cot.length) return;
  await ketNoi.execute(`UPDATE kydanhgiakpi SET ${cot.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cot.map((c) => truong[c]), id]);
}

async function demPhieuTheoTrangThai(kyDanhGiaId, trangThai, ketNoi) {
  const [[d]] = await ketNoi.execute('SELECT COUNT(*) AS so FROM phieudanhgiakpi WHERE kyDanhGiaId = ? AND trangThai = ?', [
    kyDanhGiaId,
    trangThai,
  ]);
  return Number(d.so);
}

async function demPhieuCuaKy(kyDanhGiaId, ketNoi) {
  const [[d]] = await ketNoi.execute('SELECT COUNT(*) AS so FROM phieudanhgiakpi WHERE kyDanhGiaId = ?', [kyDanhGiaId]);
  return Number(d.so);
}

async function xoaKy(id, ketNoi) {
  await ketNoi.execute('DELETE FROM kydanhgiakpi WHERE id = ?', [id]);
}

// ===================== Chỉ tiêu KPI =====================

// chucDanhPhongBanId NULL = chỉ tiêu chung áp dụng cho mọi vị trí
const COT_CHI_TIEU = `ct.id, ct.maChiTieu, ct.tenChiTieu, ct.moTa, ct.donViDo, ct.trongSoMacDinh, ct.chucDanhPhongBanId,
  cdpb.phongBanId, pb.tenPhongBan, cd.tenChucDanh,
  (SELECT COUNT(*) FROM chitietdanhgiakpi c WHERE c.chiTieuKPIId = ct.id) AS soLanSuDung`;
const TU_CHI_TIEU = `FROM chitieukpi ct
  LEFT JOIN chucdanhphongban cdpb ON cdpb.id = ct.chucDanhPhongBanId
  LEFT JOIN phongban pb ON pb.id = cdpb.phongBanId
  LEFT JOIN chucdanh cd ON cd.id = cdpb.chucDanhId`;

// phamViPhongBanIds (quanLy): thấy chỉ tiêu chung + chỉ tiêu của vị trí thuộc phòng mình
async function layDanhSachChiTieu({ chucDanhPhongBanId, phongBanId, chiTieuChung, tuKhoa, phamViPhongBanIds }) {
  const dieuKien = [];
  const thamSo = [];
  if (chucDanhPhongBanId) {
    dieuKien.push('ct.chucDanhPhongBanId = ?');
    thamSo.push(chucDanhPhongBanId);
  }
  if (phongBanId) {
    dieuKien.push('cdpb.phongBanId = ?');
    thamSo.push(phongBanId);
  }
  if (chiTieuChung) dieuKien.push('ct.chucDanhPhongBanId IS NULL');
  if (tuKhoa) {
    const mau = `%${String(tuKhoa).replace(/[\\%_]/g, '\\$&')}%`;
    dieuKien.push('(ct.maChiTieu LIKE ? OR ct.tenChiTieu LIKE ?)');
    thamSo.push(mau, mau);
  }
  if (phamViPhongBanIds) {
    const trong = [];
    themDieuKienIn(trong, thamSo, 'cdpb.phongBanId', phamViPhongBanIds);
    dieuKien.push(`(ct.chucDanhPhongBanId IS NULL OR ${trong[0]})`);
  }
  const [dong] = await pool.execute(
    `SELECT ${COT_CHI_TIEU} ${TU_CHI_TIEU} ${dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : ''}
      ORDER BY ct.chucDanhPhongBanId IS NOT NULL, pb.tenPhongBan, cd.tenChucDanh, ct.maChiTieu`,
    thamSo,
  );
  return dong;
}

async function layChiTieuTheoId(id, ketNoi = pool) {
  const [dong] = await ketNoi.execute(`SELECT ${COT_CHI_TIEU} ${TU_CHI_TIEU} WHERE ct.id = ?`, [id]);
  return dong[0] ?? null;
}

async function khoaChiTieu(id, ketNoi) {
  const [dong] = await ketNoi.execute('SELECT id FROM chitieukpi WHERE id = ? FOR UPDATE', [id]);
  return dong.length > 0;
}

async function themChiTieu({ maChiTieu, tenChiTieu, moTa, donViDo, trongSoMacDinh, chucDanhPhongBanId }, ketNoi) {
  const [kq] = await ketNoi.execute(
    `INSERT INTO chitieukpi (maChiTieu, tenChiTieu, moTa, donViDo, trongSoMacDinh, chucDanhPhongBanId)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [maChiTieu, tenChiTieu, moTa, donViDo, trongSoMacDinh, chucDanhPhongBanId],
  );
  return kq.insertId;
}

const COT_SUA_CHI_TIEU = ['tenChiTieu', 'moTa', 'donViDo', 'trongSoMacDinh', 'chucDanhPhongBanId'];
async function capNhatChiTieu(id, truong, ketNoi) {
  const cot = Object.keys(truong).filter((c) => COT_SUA_CHI_TIEU.includes(c));
  if (!cot.length) return;
  await ketNoi.execute(`UPDATE chitieukpi SET ${cot.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cot.map((c) => truong[c]), id]);
}

async function demLanSuDungChiTieu(id, ketNoi) {
  const [[d]] = await ketNoi.execute('SELECT COUNT(*) AS so FROM chitietdanhgiakpi WHERE chiTieuKPIId = ?', [id]);
  return Number(d.so);
}

async function xoaChiTieu(id, ketNoi) {
  await ketNoi.execute('DELETE FROM chitieukpi WHERE id = ?', [id]);
}

// Vị trí đang áp dụng để gán chỉ tiêu (lọc theo phạm vi phòng ban)
async function layViTriGanChiTieu(phamViPhongBanIds) {
  const dieuKien = ["cdpb.trangThai = 'DANG_AP_DUNG'"];
  const thamSo = [];
  themDieuKienIn(dieuKien, thamSo, 'cdpb.phongBanId', phamViPhongBanIds);
  const [dong] = await pool.execute(
    `SELECT cdpb.id, cdpb.phongBanId, pb.tenPhongBan, cd.tenChucDanh
       FROM chucdanhphongban cdpb JOIN phongban pb ON pb.id = cdpb.phongBanId JOIN chucdanh cd ON cd.id = cdpb.chucDanhId
      WHERE ${dieuKien.join(' AND ')} ORDER BY pb.tenPhongBan, cd.tenChucDanh`,
    thamSo,
  );
  return dong;
}

// Chỉ tiêu áp dụng cho một vị trí: chỉ tiêu riêng của vị trí + chỉ tiêu chung
async function layChiTieuChoViTri(chucDanhPhongBanId, ketNoi = pool) {
  const [dong] = await ketNoi.execute(
    `SELECT id, trongSoMacDinh FROM chitieukpi WHERE chucDanhPhongBanId = ? OR chucDanhPhongBanId IS NULL ORDER BY id
     ${ketNoi === pool ? '' : 'LOCK IN SHARE MODE'}`,
    [chucDanhPhongBanId ?? 0],
  );
  return dong;
}

// ===================== Phiếu đánh giá =====================

// Điểm tổng = Σ(điểm × trọng số) / Σ trọng số, tính khi đọc (schema không lưu điểm tổng)
const COT_PHIEU = `p.id, p.kyDanhGiaId, k.tenKyDanhGia, k.ngayBatDau, k.ngayKetThuc, k.trangThai AS trangThaiKy,
  p.nhanVienId, nv.maNhanVien, nv.hoVaTen, nv.trangThaiLamViec, cdpb.phongBanId, pb.tenPhongBan, cd.tenChucDanh,
  EXISTS (SELECT 1 FROM phongban t WHERE t.truongBoPhanId = nv.id) AS laTruongBoPhan,
  p.giaiTrinhNhanVien, p.nhanXetQuanLy, p.xepLoaiChung, p.nguoiDanhGiaId, ndg.hoVaTen AS tenNguoiDanhGia,
  p.ngayNghiemThu, p.trangThai,
  (SELECT ROUND(SUM(c.diemTuCham * c.trongSo) / NULLIF(SUM(c.trongSo), 0), 2) FROM chitietdanhgiakpi c
     WHERE c.phieuDanhGiaKPIId = p.id HAVING COUNT(*) = COUNT(c.diemTuCham)) AS diemTuChamTong,
  (SELECT ROUND(SUM(c.diemNghiemThu * c.trongSo) / NULLIF(SUM(c.trongSo), 0), 2) FROM chitietdanhgiakpi c
     WHERE c.phieuDanhGiaKPIId = p.id HAVING COUNT(*) = COUNT(c.diemNghiemThu)) AS diemTong,
  (SELECT COUNT(*) FROM chitietdanhgiakpi c WHERE c.phieuDanhGiaKPIId = p.id) AS soChiTieu`;
const TU_PHIEU = `FROM phieudanhgiakpi p
  JOIN kydanhgiakpi k ON k.id = p.kyDanhGiaId
  JOIN nhanvien nv ON nv.id = p.nhanVienId
  LEFT JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId
  LEFT JOIN phongban pb ON pb.id = cdpb.phongBanId
  LEFT JOIN chucdanh cd ON cd.id = cdpb.chucDanhId
  LEFT JOIN nhanvien ndg ON ndg.id = p.nguoiDanhGiaId`;

function chuanHoaPhieu(d) {
  return {
    ...d,
    laTruongBoPhan: Boolean(d.laTruongBoPhan),
    diemTuChamTong: d.diemTuChamTong === null ? null : Number(d.diemTuChamTong),
    diemTong: d.diemTong === null ? null : Number(d.diemTong),
  };
}

function dieuKienPhieu({ kyDanhGiaId, phongBanId, trangThai, xepLoaiChung, tuKhoa, nhanVienId, phamViPhongBanIds }) {
  const dieuKien = [];
  const thamSo = [];
  if (kyDanhGiaId) {
    dieuKien.push('p.kyDanhGiaId = ?');
    thamSo.push(kyDanhGiaId);
  }
  if (phongBanId) {
    dieuKien.push('cdpb.phongBanId = ?');
    thamSo.push(phongBanId);
  }
  if (trangThai) {
    dieuKien.push('p.trangThai = ?');
    thamSo.push(trangThai);
  }
  if (xepLoaiChung) {
    dieuKien.push('p.xepLoaiChung = ?');
    thamSo.push(xepLoaiChung);
  }
  if (nhanVienId) {
    dieuKien.push('p.nhanVienId = ?');
    thamSo.push(nhanVienId);
  }
  if (tuKhoa) {
    const mau = `%${String(tuKhoa).replace(/[\\%_]/g, '\\$&')}%`;
    dieuKien.push('(nv.maNhanVien LIKE ? OR nv.hoVaTen LIKE ?)');
    thamSo.push(mau, mau);
  }
  themDieuKienIn(dieuKien, thamSo, 'cdpb.phongBanId', phamViPhongBanIds);
  return { where: dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : '', thamSo };
}

async function layDanhSachPhieu(boLoc) {
  const { where, thamSo } = dieuKienPhieu(boLoc);
  const [[dem]] = await pool.execute(`SELECT COUNT(*) AS tongSo ${TU_PHIEU} ${where}`, thamSo);
  const gioiHan = boLoc.soLuong ? `LIMIT ${Number(boLoc.soLuong)} OFFSET ${Number(boLoc.viTri ?? 0)}` : '';
  const [dong] = await pool.execute(
    `SELECT ${COT_PHIEU} ${TU_PHIEU} ${where} ORDER BY k.ngayBatDau DESC, pb.tenPhongBan, nv.maNhanVien ${gioiHan}`,
    thamSo,
  );
  return { items: dong.map(chuanHoaPhieu), tongSo: Number(dem.tongSo) };
}

async function layPhieuTheoId(id, ketNoi = pool) {
  const [dong] = await ketNoi.execute(`SELECT ${COT_PHIEU} ${TU_PHIEU} WHERE p.id = ?`, [id]);
  return dong[0] ? chuanHoaPhieu(dong[0]) : null;
}

async function khoaPhieu(id, ketNoi) {
  const [dong] = await ketNoi.execute('SELECT id, kyDanhGiaId, nhanVienId, trangThai FROM phieudanhgiakpi WHERE id = ? FOR UPDATE', [id]);
  return dong[0] ?? null;
}

async function layChiTietPhieu(phieuId, ketNoi = pool) {
  const [dong] = await ketNoi.execute(
    `SELECT c.id, c.chiTieuKPIId, ct.maChiTieu, ct.tenChiTieu, ct.moTa, ct.donViDo, c.trongSo, c.mucTieu,
            c.ketQuaThucTe, c.diemTuCham, c.diemNghiemThu, c.nhanXet
       FROM chitietdanhgiakpi c JOIN chitieukpi ct ON ct.id = c.chiTieuKPIId
      WHERE c.phieuDanhGiaKPIId = ? ORDER BY c.id`,
    [phieuId],
  );
  return dong.map((d) => ({
    ...d,
    trongSo: Number(d.trongSo),
    diemTuCham: d.diemTuCham === null ? null : Number(d.diemTuCham),
    diemNghiemThu: d.diemNghiemThu === null ? null : Number(d.diemNghiemThu),
  }));
}

async function themPhieu(kyDanhGiaId, nhanVienId, ketNoi) {
  const [kq] = await ketNoi.execute("INSERT INTO phieudanhgiakpi (kyDanhGiaId, nhanVienId, trangThai) VALUES (?, ?, 'BAN_NHAP')", [
    kyDanhGiaId,
    nhanVienId,
  ]);
  return kq.insertId;
}

async function themChiTietPhieu(phieuId, cacChiTieu, ketNoi) {
  if (!cacChiTieu.length) return;
  await ketNoi.query('INSERT INTO chitietdanhgiakpi (phieuDanhGiaKPIId, chiTieuKPIId, trongSo) VALUES ?', [
    cacChiTieu.map((ct) => [phieuId, ct.id, ct.trongSoMacDinh]),
  ]);
}

const COT_SUA_CHI_TIET = ['trongSo', 'mucTieu', 'ketQuaThucTe', 'diemTuCham', 'diemNghiemThu', 'nhanXet'];
async function capNhatChiTiet(phieuId, chiTietId, truong, ketNoi) {
  const cot = Object.keys(truong).filter((c) => COT_SUA_CHI_TIET.includes(c));
  if (!cot.length) return;
  await ketNoi.execute(`UPDATE chitietdanhgiakpi SET ${cot.map((c) => `${c} = ?`).join(', ')} WHERE id = ? AND phieuDanhGiaKPIId = ?`, [
    ...cot.map((c) => truong[c]),
    chiTietId,
    phieuId,
  ]);
}

const COT_SUA_PHIEU = ['giaiTrinhNhanVien', 'nhanXetQuanLy', 'xepLoaiChung', 'nguoiDanhGiaId', 'ngayNghiemThu', 'trangThai'];
async function capNhatPhieu(id, truong, ketNoi) {
  const cot = Object.keys(truong).filter((c) => COT_SUA_PHIEU.includes(c));
  if (!cot.length) return;
  await ketNoi.execute(`UPDATE phieudanhgiakpi SET ${cot.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
    ...cot.map((c) => truong[c]),
    id,
  ]);
}

async function xoaPhieu(id, ketNoi) {
  await ketNoi.execute('DELETE FROM phieudanhgiakpi WHERE id = ?', [id]); // chi tiết CASCADE
}

// Nhân viên có tài khoản mang vai trò giamDoc (không được đánh giá KPI vì không có cấp nghiệm thu)
const SQL_LA_GIAM_DOC = `EXISTS (SELECT 1 FROM nguoidungvaitro ndvt JOIN vaitro vt ON vt.id = ndvt.vaiTroId
  WHERE ndvt.nguoiDungId = nv.nguoiDungId AND vt.maVaiTro = 'giamDoc')`;

async function laGiamDoc(nhanVienId, ketNoi = pool) {
  const [[d]] = await ketNoi.execute(`SELECT ${SQL_LA_GIAM_DOC} AS la FROM nhanvien nv WHERE nv.id = ?`, [nhanVienId]);
  return Boolean(d?.la);
}

// Nhân viên đủ điều kiện tạo phiếu hàng loạt: đang làm việc, có vị trí, chưa có phiếu trong kỳ
async function layNhanVienChuaCoPhieu(kyDanhGiaId, { phongBanId, phamViPhongBanIds, boQuaNhanVienId }, ketNoi) {
  const dieuKien = [
    "nv.trangThaiLamViec IN ('THU_VIEC', 'CHINH_THUC')",
    'nv.chucDanhPhongBanId IS NOT NULL',
    `NOT ${SQL_LA_GIAM_DOC}`,
    'NOT EXISTS (SELECT 1 FROM phieudanhgiakpi p WHERE p.kyDanhGiaId = ? AND p.nhanVienId = nv.id)',
    'nv.id <> ?',
  ];
  const thamSo = [kyDanhGiaId, boQuaNhanVienId ?? 0];
  if (phongBanId) {
    dieuKien.push('cdpb.phongBanId = ?');
    thamSo.push(phongBanId);
  }
  themDieuKienIn(dieuKien, thamSo, 'cdpb.phongBanId', phamViPhongBanIds);
  const [dong] = await ketNoi.execute(
    `SELECT nv.id, nv.chucDanhPhongBanId FROM nhanvien nv JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId
      WHERE ${dieuKien.join(' AND ')} ORDER BY nv.id`,
    thamSo,
  );
  return dong;
}

module.exports = {
  layDanhSachKy,
  layKyTheoId,
  khoaKy,
  timKyTheoTen,
  themKy,
  capNhatKy,
  demPhieuTheoTrangThai,
  demPhieuCuaKy,
  xoaKy,
  layDanhSachChiTieu,
  layChiTieuTheoId,
  khoaChiTieu,
  themChiTieu,
  capNhatChiTieu,
  demLanSuDungChiTieu,
  xoaChiTieu,
  layChiTieuChoViTri,
  layViTriGanChiTieu,
  layDanhSachPhieu,
  layPhieuTheoId,
  khoaPhieu,
  layChiTietPhieu,
  themPhieu,
  themChiTietPhieu,
  capNhatChiTiet,
  capNhatPhieu,
  xoaPhieu,
  layNhanVienChuaCoPhieu,
  laGiamDoc,
};
