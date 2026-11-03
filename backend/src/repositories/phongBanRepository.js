const { pool } = require('../config/ketNoiCsdl');

// ===================== Phạm vi & kiểm tra dùng chung =====================

// Phạm vi quanLy (docs/phan-quyen.md quy tắc 4): phòng ban mình làm trưởng + đệ quy các phòng ban con
async function layPhongBanQuanLy(nhanVienId) {
  const [dong] = await pool.execute(
    `WITH RECURSIVE cay AS (
        SELECT id FROM phongban WHERE truongBoPhanId = ?
        UNION
        SELECT pb.id FROM phongban pb JOIN cay ON pb.phongBanChaId = cay.id
     )
     SELECT id FROM cay`,
    [nhanVienId]
  );
  return dong.map((d) => d.id);
}

// Cây phòng ban kèm trưởng bộ phận và trạng thái làm việc của trưởng (tính chuỗi duyệt đơn nghỉ phép)
async function layCayPhongBan(ketNoi = pool) {
  const [dong] = await ketNoi.query(
    `SELECT pb.id, pb.phongBanChaId, pb.trangThai, pb.truongBoPhanId, t.maNhanVien AS maTruong, t.hoVaTen AS tenTruong,
            t.trangThaiLamViec AS trangThaiTruong,
            EXISTS (SELECT 1 FROM nguoidungvaitro ndvt JOIN vaitro vt ON vt.id = ndvt.vaiTroId
                     WHERE ndvt.nguoiDungId = t.nguoiDungId AND vt.maVaiTro = 'quanLy') AS truongCoQuanLy
       FROM phongban pb
       LEFT JOIN nhanvien t ON t.id = pb.truongBoPhanId`
  );
  return dong.map((d) => ({ ...d, truongCoQuanLy: Boolean(d.truongCoQuanLy) }));
}

// Gọi trong transaction: FOR UPDATE chặn việc bổ nhiệm đúng lúc HR đang cho nghỉ/điều chuyển người đó
async function layPhongBanLamTruong(nhanVienId, ketNoi) {
  const [dong] = await ketNoi.execute(
    'SELECT id, tenPhongBan FROM phongban WHERE truongBoPhanId = ? FOR UPDATE',
    [nhanVienId]
  );
  return dong;
}

// Thứ tự khóa thống nhất: phongban -> chucdanhphongban -> nhanvien -> nguoidung.
// Luồng bắt đầu từ nhân viên (điều chuyển, đổi trạng thái) gọi hàm này TRƯỚC khi khóa nhanvien,
// khóa theo id tăng dần để hai transaction cùng khóa nhiều phòng không chờ vòng nhau.
async function khoaCacPhongBan(phongBanIds, ketNoi) {
  const ids = [...new Set(phongBanIds.filter(Boolean))].sort((a, b) => a - b);
  if (!ids.length) return;
  await ketNoi.query(`SELECT id FROM phongban WHERE id IN (${ids.map(() => '?').join(', ')}) ORDER BY id FOR UPDATE`, ids);
}

// Đọc không khóa (dùng trước transaction) để biết cần khóa phòng nào trước khi khóa nhanvien
async function layIdPhongBanLamTruong(nhanVienId) {
  const [dong] = await pool.execute('SELECT id FROM phongban WHERE truongBoPhanId = ?', [nhanVienId]);
  return dong.map((d) => d.id);
}

async function layPhongBanCuaViTri(chucDanhPhongBanId, ketNoi = pool) {
  const [dong] = await ketNoi.execute('SELECT phongBanId FROM chucdanhphongban WHERE id = ?', [chucDanhPhongBanId]);
  return dong[0]?.phongBanId ?? null;
}

// Khóa dòng vị trí (chức danh trong phòng ban) trong transaction để kiểm tra định biên không bị tranh chấp.
// Chỉ khóa chucdanhphongban: nếu JOIN ... FOR UPDATE sẽ khóa kèm phongban/chucdanh theo thứ tự tùy kế hoạch
// thực thi, ngược với luồng sửa/ngừng chức danh (chucdanh -> chucdanhphongban). Trạng thái phòng ban/chức danh đọc riêng.
async function khoaViTri(chucDanhPhongBanId, ketNoi) {
  const [khoa] = await ketNoi.execute('SELECT id FROM chucdanhphongban WHERE id = ? FOR UPDATE', [chucDanhPhongBanId]);
  if (!khoa.length) return null;
  const [dong] = await ketNoi.execute(
    `SELECT cdpb.id, cdpb.phongBanId, cdpb.chucDanhId, cdpb.dinhBien, cdpb.ghiChu, cdpb.trangThai,
            pb.trangThai AS trangThaiPhongBan, pb.tenPhongBan,
            cd.tenChucDanh, cd.trangThai AS trangThaiChucDanh
       FROM chucdanhphongban cdpb
       JOIN phongban pb ON pb.id = cdpb.phongBanId
       JOIN chucdanh cd ON cd.id = cdpb.chucDanhId
      WHERE cdpb.id = ?`,
    [chucDanhPhongBanId]
  );
  return dong[0] ?? null;
}

// ===================== Đọc =====================

const COT_PHONG_BAN = `pb.id, pb.maPhongBan, pb.tenPhongBan, pb.phongBanChaId, pb.trangThai,
       pb.truongBoPhanId, nv.maNhanVien AS maTruongBoPhan, nv.hoVaTen AS tenTruongBoPhan,
       (SELECT COUNT(*) FROM nhanvien x JOIN chucdanhphongban c ON c.id = x.chucDanhPhongBanId
         WHERE c.phongBanId = pb.id AND x.trangThaiLamViec <> 'DA_NGHI_VIEC') AS soNhanVien`;

function chuanHoaPhongBan(dong) {
  return { ...dong, soNhanVien: Number(dong.soNhanVien) };
}

// Toàn bộ phòng ban dạng phẳng (frontend tự dựng cây theo phongBanChaId).
// soNhanVien = quân số trực tiếp (chưa nghỉ việc), service cộng dồn theo cây thành tongQuanSo.
async function layDanhSachPhongBan({ trangThai }) {
  const [dong] = await pool.execute(
    `SELECT ${COT_PHONG_BAN}
       FROM phongban pb
       LEFT JOIN nhanvien nv ON nv.id = pb.truongBoPhanId
      WHERE (? IS NULL OR pb.trangThai = ?)
      ORDER BY pb.maPhongBan`,
    [trangThai ?? null, trangThai ?? null]
  );
  return dong.map(chuanHoaPhongBan);
}

async function layPhongBanTheoId(id) {
  const [dong] = await pool.execute(
    `SELECT ${COT_PHONG_BAN}
       FROM phongban pb
       LEFT JOIN nhanvien nv ON nv.id = pb.truongBoPhanId
      WHERE pb.id = ?`,
    [id]
  );
  return dong[0] ? chuanHoaPhongBan(dong[0]) : null;
}

// Vị trí (chức danh trong phòng ban) kèm định biên và số người đang giữ
async function layDanhSachViTri({ id, phongBanId, trangThai }) {
  const [dong] = await pool.execute(
    `SELECT cdpb.id, cdpb.phongBanId, pb.maPhongBan, pb.tenPhongBan, pb.trangThai AS trangThaiPhongBan,
            cdpb.chucDanhId, cd.maChucDanh, cd.tenChucDanh, cd.capBac, cd.trangThai AS trangThaiChucDanh,
            cdpb.dinhBien, cdpb.ghiChu, cdpb.trangThai,
            (SELECT COUNT(*) FROM nhanvien nv
              WHERE nv.chucDanhPhongBanId = cdpb.id AND nv.trangThaiLamViec <> 'DA_NGHI_VIEC') AS soDangGiu
       FROM chucdanhphongban cdpb
       JOIN phongban pb ON pb.id = cdpb.phongBanId
       JOIN chucdanh cd ON cd.id = cdpb.chucDanhId
      WHERE (? IS NULL OR cdpb.id = ?)
        AND (? IS NULL OR cdpb.phongBanId = ?)
        AND (? IS NULL OR cdpb.trangThai = ?)
      ORDER BY pb.maPhongBan, cd.maChucDanh`,
    [id ?? null, id ?? null, phongBanId ?? null, phongBanId ?? null, trangThai ?? null, trangThai ?? null]
  );
  return dong.map((d) => ({ ...d, soDangGiu: Number(d.soDangGiu), conTrong: Math.max(d.dinhBien - Number(d.soDangGiu), 0) }));
}

async function layDanhSachChucDanh({ id, trangThai }) {
  const [dong] = await pool.execute(
    `SELECT id, maChucDanh, tenChucDanh, capBac, trangThai FROM chucdanh
      WHERE (? IS NULL OR id = ?) AND (? IS NULL OR trangThai = ?)
      ORDER BY maChucDanh`,
    [id ?? null, id ?? null, trangThai ?? null, trangThai ?? null]
  );
  return dong;
}

// Quân số của phòng ban cộng cả phòng ban con cháu (chưa nghỉ việc)
async function layTongQuanSo(phongBanId) {
  const [dong] = await pool.execute(
    `WITH RECURSIVE cay AS (
        SELECT id FROM phongban WHERE id = ?
        UNION
        SELECT pb.id FROM phongban pb JOIN cay ON pb.phongBanChaId = cay.id
     )
     SELECT COUNT(nv.id) AS tong
       FROM cay
       JOIN chucdanhphongban cdpb ON cdpb.phongBanId = cay.id
       JOIN nhanvien nv ON nv.chucDanhPhongBanId = cdpb.id AND nv.trangThaiLamViec <> 'DA_NGHI_VIEC'`,
    [phongBanId]
  );
  return Number(dong[0].tong);
}

// ===================== Ghi (gọi trong transaction) =====================

// Cập nhật theo danh sách cột cho phép (tên cột lấy từ code, không lấy từ request)
async function capNhatTheoCot(bang, cotChoPhep, id, truong, ketNoi) {
  const cot = Object.keys(truong).filter((ten) => cotChoPhep.includes(ten));
  if (cot.length === 0) return;
  await ketNoi.execute(
    `UPDATE ${bang} SET ${cot.map((ten) => `${ten} = ?`).join(', ')} WHERE id = ?`,
    [...cot.map((ten) => truong[ten]), id]
  );
}

async function khoaPhongBan(id, ketNoi) {
  const [dong] = await ketNoi.execute(
    'SELECT id, maPhongBan, tenPhongBan, phongBanChaId, truongBoPhanId, trangThai FROM phongban WHERE id = ? FOR UPDATE',
    [id]
  );
  return dong[0] ?? null;
}

// Các phòng ban con cháu (không gồm chính nó), dùng chống tạo vòng khi đổi phòng ban cha
async function layPhongBanConChau(id, ketNoi) {
  const [dong] = await ketNoi.execute(
    `WITH RECURSIVE cay AS (
        SELECT id FROM phongban WHERE phongBanChaId = ?
        UNION
        SELECT pb.id FROM phongban pb JOIN cay ON pb.phongBanChaId = cay.id
     )
     SELECT id FROM cay`,
    [id]
  );
  return dong.map((d) => d.id);
}

async function demPhongBanConHoatDong(id, ketNoi) {
  const [dong] = await ketNoi.execute(
    "SELECT id FROM phongban WHERE phongBanChaId = ? AND trangThai = 'DANG_HOAT_DONG' FOR UPDATE",
    [id]
  );
  return dong.length;
}

// Đọc có khóa: nhân viên chưa nghỉ việc đang thuộc phòng ban
async function demNhanVienTrongPhong(phongBanId, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT nv.id FROM nhanvien nv
       JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId
      WHERE cdpb.phongBanId = ? AND nv.trangThaiLamViec <> 'DA_NGHI_VIEC'
      FOR UPDATE`,
    [phongBanId]
  );
  return dong.length;
}

async function themPhongBan({ maPhongBan, tenPhongBan, phongBanChaId }, ketNoi) {
  const [ketQua] = await ketNoi.execute(
    'INSERT INTO phongban (maPhongBan, tenPhongBan, phongBanChaId) VALUES (?, ?, ?)',
    [maPhongBan, tenPhongBan, phongBanChaId]
  );
  return ketQua.insertId;
}

function capNhatPhongBan(id, truong, ketNoi) {
  return capNhatTheoCot('phongban', ['tenPhongBan', 'phongBanChaId', 'trangThai', 'truongBoPhanId'], id, truong, ketNoi);
}

async function khoaChucDanh(id, ketNoi) {
  const [dong] = await ketNoi.execute(
    'SELECT id, maChucDanh, tenChucDanh, capBac, trangThai FROM chucdanh WHERE id = ? FOR UPDATE',
    [id]
  );
  return dong[0] ?? null;
}

async function demViTriApDungCuaChucDanh(chucDanhId, ketNoi) {
  const [dong] = await ketNoi.execute(
    "SELECT id FROM chucdanhphongban WHERE chucDanhId = ? AND trangThai = 'DANG_AP_DUNG' FOR UPDATE",
    [chucDanhId]
  );
  return dong.length;
}

async function themChucDanh({ maChucDanh, tenChucDanh, capBac }, ketNoi) {
  const [ketQua] = await ketNoi.execute(
    'INSERT INTO chucdanh (maChucDanh, tenChucDanh, capBac) VALUES (?, ?, ?)',
    [maChucDanh, tenChucDanh, capBac]
  );
  return ketQua.insertId;
}

function capNhatChucDanh(id, truong, ketNoi) {
  return capNhatTheoCot('chucdanh', ['tenChucDanh', 'capBac', 'trangThai'], id, truong, ketNoi);
}

async function themViTri({ phongBanId, chucDanhId, dinhBien, ghiChu }, ketNoi) {
  const [ketQua] = await ketNoi.execute(
    'INSERT INTO chucdanhphongban (phongBanId, chucDanhId, dinhBien, ghiChu) VALUES (?, ?, ?, ?)',
    [phongBanId, chucDanhId, dinhBien, ghiChu]
  );
  return ketQua.insertId;
}

function capNhatViTri(id, truong, ketNoi) {
  return capNhatTheoCot('chucdanhphongban', ['dinhBien', 'ghiChu', 'trangThai'], id, truong, ketNoi);
}

module.exports = {
  layCayPhongBan,
  layPhongBanQuanLy,
  layPhongBanLamTruong,
  khoaCacPhongBan,
  layIdPhongBanLamTruong,
  layPhongBanCuaViTri,
  khoaViTri,
  layDanhSachPhongBan,
  layPhongBanTheoId,
  layDanhSachViTri,
  layDanhSachChucDanh,
  layTongQuanSo,
  khoaPhongBan,
  layPhongBanConChau,
  demPhongBanConHoatDong,
  demNhanVienTrongPhong,
  themPhongBan,
  capNhatPhongBan,
  khoaChucDanh,
  demViTriApDungCuaChucDanh,
  themChucDanh,
  capNhatChucDanh,
  themViTri,
  capNhatViTri,
};
