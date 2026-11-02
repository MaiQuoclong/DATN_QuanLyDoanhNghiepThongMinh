const { pool } = require('../config/ketNoiCsdl');

// Trạng thái HET_HAN không lưu trong CSDL mà suy ra khi đọc: hợp đồng HIEU_LUC đã qua ngày kết thúc
const TRANG_THAI_THUC_TE = `CASE WHEN hd.trangThai = 'HIEU_LUC' AND hd.ngayKetThuc IS NOT NULL AND hd.ngayKetThuc < CURDATE()
            THEN 'HET_HAN' ELSE hd.trangThai END`;

const COT_HOP_DONG = `hd.id, hd.maHopDong, hd.nhanVienId, nv.maNhanVien, nv.hoVaTen, nv.trangThaiLamViec,
       pb.tenPhongBan, cd.tenChucDanh, hd.loaiHopDong, hd.ngayBatDau, hd.ngayKetThuc,
       hd.luongCoBan, hd.mucPhuCap, ${TRANG_THAI_THUC_TE} AS trangThai, hd.trangThai AS trangThaiLuu, hd.duongDanFileHopDong, hd.ngayTao`;

const BANG_NOI = `FROM hopdonglaodong hd
       JOIN nhanvien nv ON nv.id = hd.nhanVienId
       JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId
       JOIN phongban pb ON pb.id = cdpb.phongBanId
       JOIN chucdanh cd ON cd.id = cdpb.chucDanhId`;

const COT_CAP_NHAT = ['ngayKetThuc', 'luongCoBan', 'mucPhuCap', 'trangThai', 'duongDanFileHopDong'];

async function layDanhSach({ tuKhoa, nhanVienId, loaiHopDong, trangThai, viTri, soLuong }) {
  const dieuKien = [];
  const thamSo = [];
  if (tuKhoa) {
    dieuKien.push('(hd.maHopDong LIKE ? OR nv.maNhanVien LIKE ? OR nv.hoVaTen LIKE ?)');
    const mau = `%${tuKhoa.replace(/[\\%_]/g, '\\$&')}%`;
    thamSo.push(mau, mau, mau);
  }
  if (nhanVienId) {
    dieuKien.push('hd.nhanVienId = ?');
    thamSo.push(nhanVienId);
  }
  if (loaiHopDong) {
    dieuKien.push('hd.loaiHopDong = ?');
    thamSo.push(loaiHopDong);
  }
  if (trangThai) {
    dieuKien.push(`${TRANG_THAI_THUC_TE} = ?`);
    thamSo.push(trangThai);
  }
  const where = dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : '';
  const [[dem]] = await pool.query(`SELECT COUNT(*) AS tongSo ${BANG_NOI} ${where}`, thamSo);
  const [items] = await pool.query(
    `SELECT ${COT_HOP_DONG} ${BANG_NOI} ${where} ORDER BY hd.ngayBatDau DESC, hd.id DESC LIMIT ? OFFSET ?`,
    [...thamSo, soLuong, viTri]
  );
  return { items, tongSo: Number(dem.tongSo) };
}

async function layTheoNhanVien(nhanVienId) {
  const [dong] = await pool.execute(
    `SELECT ${COT_HOP_DONG} ${BANG_NOI} WHERE hd.nhanVienId = ? ORDER BY hd.ngayBatDau DESC, hd.id DESC`,
    [nhanVienId]
  );
  return dong;
}

async function layTheoId(id, ketNoi = pool) {
  const [dong] = await ketNoi.execute(`SELECT ${COT_HOP_DONG} ${BANG_NOI} WHERE hd.id = ?`, [id]);
  return dong[0] ?? null;
}

// Nhân viên của hợp đồng (đọc không khóa) để khóa dòng nhân viên trước, cùng thứ tự với luồng tạo hợp đồng
async function layNhanVienCuaHopDong(id, ketNoi) {
  const [dong] = await ketNoi.execute('SELECT nhanVienId FROM hopdonglaodong WHERE id = ?', [id]);
  return dong[0]?.nhanVienId ?? null;
}

async function khoaHopDong(id, ketNoi) {
  const [dong] = await ketNoi.execute('SELECT id FROM hopdonglaodong WHERE id = ? FOR UPDATE', [id]);
  return dong.length > 0;
}

// Hợp đồng bất kỳ (kể cả đã chấm dứt) có thời gian chồng lên [ngayBatDau, ngayKetThuc] của hợp đồng mới.
// Không lọc trạng thái: khi chấm dứt, ngayKetThuc đã gán bằng ngayChamDut (có thể ở tương lai),
// nên vẫn phải chặn hợp đồng mới chồng lên khoảng còn lại đó.
// FOR UPDATE để hai HR cùng tạo hợp đồng cho một người không cùng lọt qua kiểm tra.
async function timHopDongChongLan(nhanVienId, ngayBatDau, ngayKetThuc, boQuaId, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT id, maHopDong, ngayBatDau, ngayKetThuc FROM hopdonglaodong
      WHERE nhanVienId = ? AND id <> ?
        AND (ngayKetThuc IS NULL OR ngayKetThuc >= ?)
        AND (? IS NULL OR ngayBatDau <= ?)
      FOR UPDATE`,
    [nhanVienId, boQuaId ?? 0, ngayBatDau, ngayKetThuc, ngayKetThuc]
  );
  return dong[0] ?? null;
}

// Số thứ tự lớn nhất của mã HDyyyy-xxxx trong năm; FOR UPDATE để không sinh trùng mã
async function laySoMaLonNhat(nam, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT MAX(CAST(SUBSTRING(maHopDong, 8) AS UNSIGNED)) AS soLonNhat
       FROM hopdonglaodong
      WHERE maHopDong LIKE ?
      FOR UPDATE`,
    [`HD${nam}-%`]
  );
  return Number(dong[0].soLonNhat ?? 0);
}

async function them(hd, ketNoi) {
  const [ketQua] = await ketNoi.execute(
    `INSERT INTO hopdonglaodong (maHopDong, nhanVienId, loaiHopDong, ngayBatDau, ngayKetThuc,
                                 luongCoBan, mucPhuCap, trangThai, duongDanFileHopDong)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'HIEU_LUC', ?)`,
    [hd.maHopDong, hd.nhanVienId, hd.loaiHopDong, hd.ngayBatDau, hd.ngayKetThuc,
      hd.luongCoBan, hd.mucPhuCap, hd.duongDanFileHopDong]
  );
  return ketQua.insertId;
}

async function capNhat(id, truong, ketNoi) {
  const cot = Object.keys(truong).filter((ten) => COT_CAP_NHAT.includes(ten));
  if (cot.length === 0) return;
  await ketNoi.execute(
    `UPDATE hopdonglaodong SET ${cot.map((ten) => `${ten} = ?`).join(', ')} WHERE id = ?`,
    [...cot.map((ten) => truong[ten]), id]
  );
}

// ls: { hopDongLaoDongId, hanhDong, cu: hợp đồng trước (null khi tạo mới), moi: hợp đồng sau, lyDo, nguoiThucHienId }
async function themLichSu({ hopDongLaoDongId, hanhDong, cu, moi, lyDo, nguoiThucHienId }, ketNoi) {
  await ketNoi.execute(
    `INSERT INTO lichsuhopdong (hopDongLaoDongId, hanhDong, loaiHopDongCu, loaiHopDongMoi, luongCoBanCu, luongCoBanMoi,
                                mucPhuCapCu, mucPhuCapMoi, ngayBatDauCu, ngayBatDauMoi, ngayKetThucCu, ngayKetThucMoi,
                                trangThaiCu, trangThaiMoi, lyDoThayDoi, nguoiThucHienId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      hopDongLaoDongId, hanhDong,
      cu?.loaiHopDong ?? null, moi.loaiHopDong,
      cu?.luongCoBan ?? null, moi.luongCoBan,
      cu?.mucPhuCap ?? null, moi.mucPhuCap ?? 0,
      cu?.ngayBatDau ?? null, moi.ngayBatDau,
      cu?.ngayKetThuc ?? null, moi.ngayKetThuc ?? null,
      cu?.trangThai ?? null, moi.trangThai,
      lyDo ?? null, nguoiThucHienId,
    ]
  );
}

async function layLichSu(hopDongId) {
  const [dong] = await pool.execute(
    `SELECT ls.id, ls.hanhDong, ls.loaiHopDongCu, ls.loaiHopDongMoi, ls.luongCoBanCu, ls.luongCoBanMoi,
            ls.mucPhuCapCu, ls.mucPhuCapMoi, ls.ngayBatDauCu, ls.ngayBatDauMoi, ls.ngayKetThucCu, ls.ngayKetThucMoi,
            ls.trangThaiCu, ls.trangThaiMoi, ls.lyDoThayDoi, ls.nguoiThucHienId,
            nv.maNhanVien AS maNguoiThucHien, nv.hoVaTen AS tenNguoiThucHien, ls.ngayGhiNhan
       FROM lichsuhopdong ls
       JOIN nhanvien nv ON nv.id = ls.nguoiThucHienId
      WHERE ls.hopDongLaoDongId = ?
      ORDER BY ls.id DESC`,
    [hopDongId]
  );
  return dong;
}

// Hợp đồng còn hiệu lực sẽ hết hạn trong soNgay tới (kể cả đã quá hạn mà chưa xử lý), bỏ qua người đã nghỉ việc
async function laySapHetHan(soNgay) {
  const [dong] = await pool.execute(
    `SELECT ${COT_HOP_DONG}, DATEDIFF(hd.ngayKetThuc, CURDATE()) AS soNgayConLai
       ${BANG_NOI}
      WHERE hd.trangThai = 'HIEU_LUC' AND hd.ngayKetThuc IS NOT NULL
        AND hd.ngayKetThuc <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
        AND nv.trangThaiLamViec <> 'DA_NGHI_VIEC'
        AND NOT EXISTS (
          SELECT 1 FROM hopdonglaodong tiep
           WHERE tiep.nhanVienId = hd.nhanVienId AND tiep.trangThai = 'HIEU_LUC' AND tiep.ngayBatDau > hd.ngayKetThuc
        )
      ORDER BY hd.ngayKetThuc, hd.id`,
    [soNgay]
  );
  return dong;
}

module.exports = {
  layDanhSach,
  layTheoNhanVien,
  layTheoId,
  layNhanVienCuaHopDong,
  khoaHopDong,
  timHopDongChongLan,
  laySoMaLonNhat,
  them,
  capNhat,
  themLichSu,
  layLichSu,
  laySapHetHan,
};
