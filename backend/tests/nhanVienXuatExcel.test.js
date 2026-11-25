const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const nhanVienRepository = require('../src/repositories/nhanVienRepository');
const { SO_DONG_XUAT_TOI_DA } = require('../src/services/nhanVienService');
const { oCsv } = require('../src/utils/xuatCsv');

// Xuất Excel danh sách nhân viên: đối chiếu chéo với GET /nhanVien cùng bộ lọc để không phụ thuộc số liệu seed.
// Dữ liệu tự sửa (tên ngân hàng/địa chỉ NV0005) được khôi phục, nhật ký tự tạo bị xóa trong afterEach.
const MAT_KHAU = 'MatKhau@123';
const NV_NHANVIEN = 5;
const BOM = String.fromCharCode(0xfeff);
const TIEU_DE_CO_BAN = 'Mã NV,Họ và tên,Giới tính,Ngày sinh,Số điện thoại,Địa chỉ,Mã phòng ban,Phòng ban,Chức danh,Ngày vào làm,Trạng thái';
const TAI_KHOAN = ['admin', 'giamdoc', 'quanly', 'quanly2', 'hr', 'nhanvien'];

const token = {};
let mocNhatKy;
let mocDauFile; // trước các lần đăng nhập (DANG_NHAP) của beforeAll
let goc;

const xuat = (tk, query = {}) => {
  const r = request(app).get('/api/v1/nhanVien/xuatExcel').query(query);
  return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
};
// Đọc thân CSV dạng chuỗi (supertest không tự parse text/csv)
const docCsv = (r) =>
  r.buffer(true).parse((res, cb) => {
    let s = '';
    res.setEncoding('utf8');
    res.on('data', (c) => (s += c));
    res.on('end', () => cb(null, s));
  });
async function layCsv(tk, query) {
  const res = await docCsv(xuat(tk, query));
  return { res, dong: res.body.replace(BOM, '').trimEnd().split('\r\n') };
}
const maNvTrongCsv = (dong) => dong.slice(1).map((d) => d.split(',')[0]);
async function maNvTheoDanhSach(tk, query) {
  const res = await request(app)
    .get('/api/v1/nhanVien')
    .query({ ...query, kichThuoc: 100 })
    .set('Authorization', `Bearer ${tk}`);
  expect(res.status).toBe(200);
  expect(res.body.data.phanTrang.tongSo).toBeLessThanOrEqual(100);
  return res.body.data.items.map((nv) => nv.maNhanVien);
}

beforeAll(async () => {
  mocDauFile = (await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM nhatkyhethong'))[0][0].m;
  for (const tk of TAI_KHOAN) {
    const res = await request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap: tk, matKhau: MAT_KHAU });
    token[tk] = res.body.data.token;
  }
  [[goc]] = await pool.query('SELECT diaChi, tenNganHang, ngayCapNhat FROM nhanvien WHERE id = ?', [NV_NHANVIEN]);
});

beforeEach(async () => {
  mocNhatKy = (await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM nhatkyhethong'))[0][0].m;
});

afterEach(async () => {
  jest.restoreAllMocks();
  await pool.execute('UPDATE nhanvien SET diaChi = ?, tenNganHang = ?, ngayCapNhat = ? WHERE id = ?', [
    goc.diaChi,
    goc.tenNganHang,
    goc.ngayCapNhat,
    NV_NHANVIEN,
  ]);
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKy]);
  await pool.query('ALTER TABLE nhatkyhethong AUTO_INCREMENT = 1');
});

afterAll(async () => {
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocDauFile]);
  await pool.query('ALTER TABLE nhatkyhethong AUTO_INCREMENT = 1');
  await pool.end();
});

describe('GET /api/v1/nhanVien/xuatExcel', () => {
  test('401 khi chưa đăng nhập; 403 với Admin và nhanVien', async () => {
    expect((await xuat()).status).toBe(401);
    for (const tk of ['admin', 'nhanvien']) {
      const res = await xuat(token[tk]);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    }
  });

  test('HR: CSV có BOM, header tải tệp, đủ 13 cột kèm ngân hàng, khớp danh sách', async () => {
    const { res, dong } = await layCsv(token.hr);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="DanhSachNhanVien_\d{8}_\d{4}\.csv"$/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.startsWith(BOM)).toBe(true);
    expect(dong[0]).toBe(`${TIEU_DE_CO_BAN},Số tài khoản ngân hàng,Ngân hàng`);
    expect(maNvTrongCsv(dong)).toEqual(await maNvTheoDanhSach(token.hr, {}));
  });

  test('giamDoc: toàn công ty, có cột ngân hàng', async () => {
    const { res, dong } = await layCsv(token.giamdoc);
    expect(res.status).toBe(200);
    expect(dong[0]).toContain('Số tài khoản ngân hàng');
    expect(maNvTrongCsv(dong)).toEqual(await maNvTheoDanhSach(token.giamdoc, {}));
  });

  test('quanLy: chỉ phạm vi phòng mình (như danh sách), có Địa chỉ, không có ngân hàng', async () => {
    for (const tk of ['quanly', 'quanly2']) {
      const { res, dong } = await layCsv(token[tk]);
      expect(res.status).toBe(200);
      expect(dong[0]).toBe(TIEU_DE_CO_BAN);
      expect(maNvTrongCsv(dong)).toEqual(await maNvTheoDanhSach(token[tk], {}));
      expect(maNvTrongCsv(dong).length).toBeLessThan(maNvTrongCsv((await layCsv(token.hr)).dong).length);
    }
  });

  test('quanLy lọc phòng ngoài phạm vi: chỉ dòng tiêu đề', async () => {
    const maTrongPhamVi = maNvTrongCsv((await layCsv(token.quanly)).dong);
    expect(maTrongPhamVi.length).toBeGreaterThan(0);
    const [phong] = await pool.query(
      `SELECT pb.id FROM phongban pb WHERE pb.id NOT IN (
         SELECT cdpb.phongBanId FROM nhanvien nv JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId WHERE nv.maNhanVien IN (?)
       ) LIMIT 1`,
      [maTrongPhamVi],
    );
    expect(phong).toHaveLength(1);
    const { res, dong } = await layCsv(token.quanly, { phongBanId: phong[0].id });
    expect(res.status).toBe(200);
    expect(dong).toEqual([TIEU_DE_CO_BAN]);
  });

  test('bộ lọc tuKhoa / phongBanId / trangThaiLamViec cho cùng tập như GET /nhanVien', async () => {
    const [[nv]] = await pool.query(
      'SELECT nv.maNhanVien, cdpb.phongBanId FROM nhanvien nv JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId WHERE nv.id = ?',
      [NV_NHANVIEN],
    );
    const cacBoLoc = [{ tuKhoa: nv.maNhanVien }, { phongBanId: nv.phongBanId }, { trangThaiLamViec: 'THU_VIEC,CHINH_THUC' }];
    for (const boLoc of cacBoLoc) {
      expect(maNvTrongCsv((await layCsv(token.hr, boLoc)).dong)).toEqual(await maNvTheoDanhSach(token.hr, boLoc));
    }
  });

  test('400 khi bộ lọc sai; route không bị /:id bắt nhầm', async () => {
    const sai = await xuat(token.hr, { trangThaiLamViec: 'ABC' });
    expect(sai.status).toBe(400);
    expect(sai.body.message).toBe('Trạng thái làm việc không hợp lệ');
    expect((await xuat(token.hr, { phongBanId: '-1' })).status).toBe(400);
    const ok = await docCsv(xuat(token.hr));
    expect(ok.status).toBe(200);
  });

  test('chống CSV injection: ô bắt đầu bằng = hoặc @ được thêm dấu nháy', async () => {
    await pool.execute('UPDATE nhanvien SET diaChi = ?, tenNganHang = ? WHERE id = ?', ['=HYPERLINK("http://x")', '@SUM(1)', NV_NHANVIEN]);
    const [[nv]] = await pool.query('SELECT maNhanVien FROM nhanvien WHERE id = ?', [NV_NHANVIEN]);
    const { dong } = await layCsv(token.hr, { tuKhoa: nv.maNhanVien });
    expect(dong[1]).toContain('"\'=HYPERLINK(""http://x"")"');
    expect(dong[1].endsWith(",'@SUM(1)")).toBe(true);
  });

  test('ghi nhật ký XUAT_EXCEL_NHAN_VIEN kèm số dòng, bộ lọc, cột ngân hàng', async () => {
    const { dong } = await layCsv(token.quanly, { trangThaiLamViec: 'CHINH_THUC' });
    await layCsv(token.hr);
    const [nk] = await pool.query(
      `SELECT nd.tenDangNhap, nk.chiTiet, nk.diaChiIP FROM nhatkyhethong nk JOIN nguoidung nd ON nd.id = nk.nguoiDungId
        WHERE nk.id > ? AND nk.hanhDong = 'XUAT_EXCEL_NHAN_VIEN' ORDER BY nk.id`,
      [mocNhatKy],
    );
    expect(nk.map((d) => d.tenDangNhap)).toEqual(['quanly', 'hr']);
    expect(nk[0].chiTiet).toBe(`${dong.length - 1} dòng; lọc: trangThai=CHINH_THUC; kèm ngân hàng: không`);
    expect(nk[1].chiTiet).toMatch(/; lọc: không; kèm ngân hàng: có$/);
    expect(nk[0].diaChiIP).toBeTruthy();
  });

  test('số âm dạng chuỗi (DECIMAL) không bị thêm dấu nháy; chuỗi bắt đầu bằng - vẫn bị chặn', () => {
    expect(oCsv('-500000.00')).toBe('-500000.00');
    expect(oCsv(-5)).toBe('-5');
    expect(oCsv('-1+2')).toBe("'-1+2");
    expect(oCsv('+84905')).toBe("'+84905");
  });

  test(`vượt trần ${SO_DONG_XUAT_TOI_DA} dòng -> 400, không ghi nhật ký`, async () => {
    jest.spyOn(nhanVienRepository, 'layDanhSachXuat').mockResolvedValue(Array.from({ length: SO_DONG_XUAT_TOI_DA + 1 }, () => ({})));
    const res = await xuat(token.hr);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(`Kết quả vượt ${SO_DONG_XUAT_TOI_DA} nhân viên, vui lòng thu hẹp bộ lọc`);
    const [nk] = await pool.query("SELECT id FROM nhatkyhethong WHERE id > ? AND hanhDong = 'XUAT_EXCEL_NHAN_VIEN'", [mocNhatKy]);
    expect(nk).toEqual([]);
  });
});
