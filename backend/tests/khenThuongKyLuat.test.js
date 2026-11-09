const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');

// Dữ liệu mẫu (database/seed.sql mục 12, 14): quyết định 1 (NV0005), 2 (NV0010), 3 (NV0007) ngày @thu2ThangChot;
// đề xuất 1 (quanly -> NV5, CHO_DUYET), 2 (quanly2 -> NV10, CHO_DUYET), 3 TU_CHOI, 4 DA_DUYET -> quyết định 3.
// Test tự tạo dữ liệu riêng, ngày ban hành năm 2020/2021 (seed không có bảng lương các năm này) và dọn trong afterEach.
const MAT_KHAU = 'MatKhau@123';
const NV_ADMIN = 1;
const NV_GIAMDOC = 2;
const NV_QUANLY = 3;
const NV_HR = 4;
const NV_NHANVIEN = 5;
const NV_NHANVIEN2 = 6;
const NV_HR2 = 7;
const NV_GIAMDOC2 = 8;
const NV_NHANVIEN3 = 10;
const NGAY_QUA_KHU = '2021-03-15';

const token = {};
let anhChup;
let mocNhatKy;
let demMa = 0;

function dangNhap(tenDangNhap) {
  return request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap, matKhau: MAT_KHAU });
}
const goi = (phuongThuc, duongDan, tk) => {
  const r = request(app)[phuongThuc](`/api/v1${duongDan}`);
  return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
};
async function layNhatKy(hanhDong) {
  const [d] = await pool.execute('SELECT nguoiDungId, chiTiet FROM nhatkyhethong WHERE id > ? AND hanhDong = ? ORDER BY id',
    [mocNhatKy, hanhDong]);
  return d;
}
const bodyDeXuat = (ghiDe = {}) => ({
  nhanVienId: NV_NHANVIEN, loaiDeXuat: 'KHEN_THUONG', tieuDe: 'QA khen thưởng', lyDo: 'Hoàn thành tốt nhiệm vụ', soTienDeXuat: 700000, ...ghiDe,
});
async function taoDeXuat(tk = token.quanly, ghiDe = {}) {
  const res = await goi('post', '/deXuatKhenThuongKyLuat', tk).send(bodyDeXuat(ghiDe));
  expect(res.status).toBe(201);
  return res.body.data;
}
const bodyQuyetDinh = (ghiDe = {}) => ({
  nhanVienId: NV_NHANVIEN, loaiQuyetDinh: 'KHEN_THUONG', tieuDe: 'QA quyết định', lyDo: 'Thành tích tốt',
  soTien: 400000, ngayBanHanh: NGAY_QUA_KHU, nguoiKyDuyetId: NV_GIAMDOC, ...ghiDe,
});
async function layDeXuatDb(id) {
  const [[d]] = await pool.execute('SELECT * FROM dexuatkhenthuongkyluat WHERE id = ?', [id]);
  return d;
}
async function demQuyetDinh() {
  const [[d]] = await pool.query('SELECT COUNT(*) AS n FROM quyetdinhkhenthuongkyluat');
  return Number(d.n);
}

const BANG_DAT_LAI = ['dexuatkhenthuongkyluat', 'quyetdinhkhenthuongkyluat', 'phieuluongnhanvien', 'bangtonghopluong', 'nhatkyhethong'];
async function datLaiAutoIncrement() {
  for (const bang of BANG_DAT_LAI) await pool.query(`ALTER TABLE ${bang} AUTO_INCREMENT = 1`);
}

beforeAll(async () => {
  anhChup = {};
  for (const bang of BANG_DAT_LAI) {
    anhChup[bang] = (await pool.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${bang}`))[0][0].m;
  }
  const [dx] = await pool.query('SELECT * FROM dexuatkhenthuongkyluat WHERE id <= 4');
  anhChup.deXuatSeed = dx;
  for (const ten of ['admin', 'giamdoc', 'giamdoc2', 'quanly', 'quanly2', 'hr', 'hr2', 'nhanvien', 'nhanvien2', 'nhanvien3']) {
    const res = await dangNhap(ten);
    expect(res.status).toBe(200);
    token[ten] = res.body.data.token;
  }
});

beforeEach(async () => {
  const [[m]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM nhatkyhethong');
  mocNhatKy = m.m;
});

afterEach(async () => {
  await pool.execute('DELETE FROM dexuatkhenthuongkyluat WHERE id > ?', [anhChup.dexuatkhenthuongkyluat]);
  await pool.execute('DELETE FROM quyetdinhkhenthuongkyluat WHERE id > ?', [anhChup.quyetdinhkhenthuongkyluat]);
  await pool.execute('DELETE FROM phieuluongnhanvien WHERE id > ?', [anhChup.phieuluongnhanvien]);
  await pool.execute('DELETE FROM bangtonghopluong WHERE id > ?', [anhChup.bangtonghopluong]);
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKy]);
  // Khôi phục đề xuất seed nếu test có đổi
  for (const d of anhChup.deXuatSeed) {
    await pool.execute(
      'UPDATE dexuatkhenthuongkyluat SET trangThai = ?, nguoiXuLyId = ?, ghiChuXuLy = ?, quyetDinhId = ?, tieuDe = ?, lyDo = ?, soTienDeXuat = ? WHERE id = ?',
      [d.trangThai, d.nguoiXuLyId, d.ghiChuXuLy, d.quyetDinhId, d.tieuDe, d.lyDo, d.soTienDeXuat, d.id]
    );
  }
  await datLaiAutoIncrement();
});

afterAll(async () => {
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [anhChup.nhatkyhethong]);
  await datLaiAutoIncrement();
  await pool.end();
});

// ---------------------------------------------------------------------------
describe('Đề xuất khen thưởng/kỷ luật - quyền và xem', () => {
  test('chưa đăng nhập 401, nhanVien/Admin bị 403', async () => {
    const r = await goi('get', '/deXuatKhenThuongKyLuat');
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ success: false, code: 401, data: null });
    expect((await goi('get', '/deXuatKhenThuongKyLuat', token.nhanvien)).status).toBe(403);
    expect((await goi('get', '/deXuatKhenThuongKyLuat', token.admin)).status).toBe(403);
    expect((await goi('post', '/deXuatKhenThuongKyLuat', token.hr).send(bodyDeXuat())).status).toBe(403);
    expect((await goi('post', '/deXuatKhenThuongKyLuat', token.nhanvien).send(bodyDeXuat({ nhanVienId: NV_NHANVIEN2 }))).status).toBe(403);
  });

  test('HR/giamDoc xem toàn bộ, quanLy chỉ đề xuất do mình tạo, có phân trang', async () => {
    const hr = await goi('get', '/deXuatKhenThuongKyLuat', token.hr);
    expect(hr.status).toBe(200);
    expect(hr.body).toMatchObject({ success: true, code: 200 });
    expect(hr.body.data.phanTrang).toMatchObject({ trang: 1 });
    const idsHr = hr.body.data.items.map((d) => d.id);
    expect(idsHr).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    const gd = await goi('get', '/deXuatKhenThuongKyLuat', token.giamdoc);
    expect(gd.body.data.items.map((d) => d.id)).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    const ql = await goi('get', '/deXuatKhenThuongKyLuat', token.quanly);
    const idsQl = ql.body.data.items.map((d) => d.id);
    expect(idsQl).toEqual(expect.arrayContaining([1, 3]));
    expect(idsQl).not.toContain(2);
    expect(ql.body.data.items.every((d) => d.nguoiDeXuatId === NV_QUANLY)).toBe(true);
    const loc = await goi('get', '/deXuatKhenThuongKyLuat?trangThai=TU_CHOI', token.hr);
    expect(loc.body.data.items.every((d) => d.trangThai === 'TU_CHOI')).toBe(true);
    expect((await goi('get', '/deXuatKhenThuongKyLuat?trangThai=PENDING', token.hr)).status).toBe(400);
  });

  test('GET /:id ngoài phạm vi 404, id sai 400', async () => {
    expect((await goi('get', '/deXuatKhenThuongKyLuat/1', token.quanly)).status).toBe(200);
    expect((await goi('get', '/deXuatKhenThuongKyLuat/2', token.quanly)).status).toBe(404);
    expect((await goi('get', '/deXuatKhenThuongKyLuat/2', token.hr)).status).toBe(200);
    expect((await goi('get', '/deXuatKhenThuongKyLuat/999999', token.hr)).status).toBe(404);
    expect((await goi('get', '/deXuatKhenThuongKyLuat/abc', token.hr)).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('Đề xuất - tạo, sửa, thu hồi', () => {
  test('quanLy tạo đề xuất trong PM thành công 201, CHO_DUYET, ghi nhật ký', async () => {
    const res = await goi('post', '/deXuatKhenThuongKyLuat', token.quanly).send(bodyDeXuat());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, code: 201 });
    expect(res.body.data).toMatchObject({ nguoiDeXuatId: NV_QUANLY, nhanVienId: NV_NHANVIEN, trangThai: 'CHO_DUYET', loaiDeXuat: 'KHEN_THUONG' });
    const nk = await layNhatKy('TAO_DE_XUAT_KTKL');
    expect(nk).toHaveLength(1);
    expect(nk[0].nguoiDungId).toBe(3);
  });

  test('giamDoc đề xuất cho nhân viên bất kỳ phòng ban', async () => {
    const dx = await taoDeXuat(token.giamdoc, { nhanVienId: NV_NHANVIEN3, loaiDeXuat: 'KY_LUAT' });
    expect(dx).toMatchObject({ nguoiDeXuatId: NV_GIAMDOC, nhanVienId: NV_NHANVIEN3, loaiDeXuat: 'KY_LUAT' });
  });

  test('dữ liệu sai 400', async () => {
    const sai = [
      { nhanVienId: 'x' }, { loaiDeXuat: 'THUONG' }, { tieuDe: '' }, { tieuDe: 'ab' }, { lyDo: '' },
      { soTienDeXuat: -1 }, { soTienDeXuat: '1.234' }, { soTienDeXuat: 'abc' }, { tieuDe: 'a'.repeat(201) },
    ];
    for (const ghiDe of sai) {
      const res = await goi('post', '/deXuatKhenThuongKyLuat', token.quanly).send(bodyDeXuat(ghiDe));
      expect([ghiDe, res.status]).toEqual([ghiDe, 400]);
      expect(res.body).toMatchObject({ success: false, code: 400, data: null });
    }
    expect((await goi('post', '/deXuatKhenThuongKyLuat', token.quanly).send(bodyDeXuat({ nhanVienId: NV_QUANLY }))).status).toBe(400);
  });

  test('quanLy đề xuất nhân viên ngoài phòng 404, không tồn tại 404', async () => {
    expect((await goi('post', '/deXuatKhenThuongKyLuat', token.quanly).send(bodyDeXuat({ nhanVienId: NV_NHANVIEN3 }))).status).toBe(404);
    expect((await goi('post', '/deXuatKhenThuongKyLuat', token.quanly2).send(bodyDeXuat({ nhanVienId: NV_NHANVIEN }))).status).toBe(404);
    expect((await goi('post', '/deXuatKhenThuongKyLuat', token.giamdoc).send(bodyDeXuat({ nhanVienId: 999999 }))).status).toBe(404);
  });

  test('nhân viên đã nghỉ việc 409', async () => {
    const [kq] = await pool.execute(
      `INSERT INTO nhanvien (maNhanVien, hoVaTen, gioiTinh, ngaySinh, chucDanhPhongBanId, ngayVaoLam, trangThaiLamViec)
       VALUES (?, 'QA Nghỉ việc', 'NAM', '1995-01-01', 5, '2020-01-06', 'DA_NGHI_VIEC')`, [`QK${Date.now() % 100000}`]
    );
    try {
      const res = await goi('post', '/deXuatKhenThuongKyLuat', token.quanly).send(bodyDeXuat({ nhanVienId: kq.insertId }));
      expect(res.status).toBe(409);
      expect((await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr).send(bodyQuyetDinh({ nhanVienId: kq.insertId }))).status).toBe(409);
    } finally {
      await pool.execute('DELETE FROM nhanvien WHERE id = ?', [kq.insertId]);
      await pool.query('ALTER TABLE nhanvien AUTO_INCREMENT = 1');
    }
  });

  test('PATCH: người tạo sửa được, người khác 403, ngoài phạm vi 404, đã xử lý 409', async () => {
    const dx = await taoDeXuat();
    const ok = await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.quanly).send({ tieuDe: 'Tiêu đề mới', soTienDeXuat: 900000 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.tieuDe).toBe('Tiêu đề mới');
    expect(Number(ok.body.data.soTienDeXuat)).toBe(900000);
    expect(await layNhatKy('SUA_DE_XUAT_KTKL')).toHaveLength(1);
    expect((await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.quanly).send({})).status).toBe(400);
    expect((await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.giamdoc).send({ tieuDe: 'GĐ sửa' })).status).toBe(403);
    expect((await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.quanly2).send({ tieuDe: 'QL2 sửa' })).status).toBe(404);
    expect((await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.hr).send({ tieuDe: 'HR sửa' })).status).toBe(403);
    expect((await goi('patch', '/deXuatKhenThuongKyLuat/3', token.quanly).send({ tieuDe: 'Sửa đề xuất đã từ chối' })).status).toBe(409);
    expect((await layDeXuatDb(3)).tieuDe).toBe(anhChup.deXuatSeed.find((d) => d.id === 3).tieuDe);
  });

  test('DELETE: người tạo thu hồi CHO_DUYET, đã xử lý 409, người khác 403', async () => {
    const dx = await taoDeXuat();
    expect((await goi('delete', `/deXuatKhenThuongKyLuat/${dx.id}`, token.giamdoc)).status).toBe(403);
    const ok = await goi('delete', `/deXuatKhenThuongKyLuat/${dx.id}`, token.quanly);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ success: true, data: null });
    expect(await layDeXuatDb(dx.id)).toBeUndefined();
    expect(await layNhatKy('XOA_DE_XUAT_KTKL')).toHaveLength(1);
    expect((await goi('delete', '/deXuatKhenThuongKyLuat/3', token.quanly)).status).toBe(409);
    expect((await goi('delete', '/deXuatKhenThuongKyLuat/4', token.giamdoc)).status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
describe('Đề xuất - HR từ chối và lập quyết định', () => {
  test('từ chối: bắt buộc ghiChuXuLy 400, thành công TU_CHOI, lần 2 409, sai vai trò 403', async () => {
    const dx = await taoDeXuat();
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/tuChoi`, token.hr).send({})).status).toBe(400);
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/tuChoi`, token.giamdoc).send({ ghiChuXuLy: 'Không đủ căn cứ' })).status).toBe(403);
    const ok = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/tuChoi`, token.hr).send({ ghiChuXuLy: 'Không đủ căn cứ' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ trangThai: 'TU_CHOI', nguoiXuLyId: NV_HR, ghiChuXuLy: 'Không đủ căn cứ' });
    expect(await layNhatKy('TU_CHOI_DE_XUAT_KTKL')).toHaveLength(1);
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/tuChoi`, token.hr).send({ ghiChuXuLy: 'Lần hai' })).status).toBe(409);
    expect((await goi('post', '/deXuatKhenThuongKyLuat/999999/tuChoi', token.hr).send({ ghiChuXuLy: 'Không có' })).status).toBe(404);
  });

  test('lập quyết định từ đề xuất 201: transaction quyết định + đề xuất DA_DUYET, số QĐ tự sinh, nhật ký', async () => {
    const dx = await taoDeXuat();
    const res = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/lapQuyetDinh`, token.hr)
      .send({ nguoiKyDuyetId: NV_GIAMDOC, ngayBanHanh: NGAY_QUA_KHU, ghiChuXuLy: 'Đồng ý' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, code: 201 });
    const qd = res.body.data.quyetDinh;
    expect(qd).toMatchObject({ nhanVienId: NV_NHANVIEN, loaiQuyetDinh: 'KHEN_THUONG', tieuDe: 'QA khen thưởng', nguoiKyDuyetId: NV_GIAMDOC });
    expect(qd.soQuyetDinh).toMatch(/^QD2021-\d{4}$/);
    expect(Number(qd.soTien)).toBe(700000);
    // NV 5 chỉ có hợp đồng từ 2024 -> tháng 03/2021 không có HĐ hiệu lực, phải cảnh báo tiền không vào lương
    expect(res.body.data.canhBao).toEqual(expect.stringContaining('không có hợp đồng hiệu lực'));
    const db = await layDeXuatDb(dx.id);
    expect(db).toMatchObject({ trangThai: 'DA_DUYET', quyetDinhId: qd.id, nguoiXuLyId: NV_HR, ghiChuXuLy: 'Đồng ý' });
    expect(await layNhatKy('LAP_QUYET_DINH_KTKL')).toHaveLength(1);
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/lapQuyetDinh`, token.hr)
      .send({ nguoiKyDuyetId: NV_GIAMDOC, ngayBanHanh: NGAY_QUA_KHU })).status).toBe(409);
  });

  test('lập quyết định: người ký không phải giamDoc / ngày sai -> 400 và rollback (đề xuất vẫn CHO_DUYET)', async () => {
    const dx = await taoDeXuat();
    const truoc = await demQuyetDinh();
    const sai = [
      { nguoiKyDuyetId: NV_HR2, ngayBanHanh: NGAY_QUA_KHU },
      { nguoiKyDuyetId: NV_QUANLY, ngayBanHanh: NGAY_QUA_KHU },
      { nguoiKyDuyetId: NV_GIAMDOC, ngayBanHanh: '2021-02-30' },
      { nguoiKyDuyetId: NV_GIAMDOC },
      { ngayBanHanh: NGAY_QUA_KHU },
      { nguoiKyDuyetId: NV_GIAMDOC, ngayBanHanh: '2099-01-01' },
    ];
    for (const body of sai) {
      const res = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/lapQuyetDinh`, token.hr).send(body);
      expect([body, res.status]).toEqual([body, 400]);
    }
    expect(await demQuyetDinh()).toBe(truoc);
    expect((await layDeXuatDb(dx.id)).trangThai).toBe('CHO_DUYET');
    expect(await layNhatKy('LAP_QUYET_DINH_KTKL')).toHaveLength(0);
  });

  test('số quyết định nhập trùng 409 và rollback', async () => {
    const dx = await taoDeXuat();
    const [[seed]] = await pool.query('SELECT soQuyetDinh FROM quyetdinhkhenthuongkyluat WHERE id = 1');
    const truoc = await demQuyetDinh();
    const res = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/lapQuyetDinh`, token.hr)
      .send({ nguoiKyDuyetId: NV_GIAMDOC, ngayBanHanh: NGAY_QUA_KHU, soQuyetDinh: seed.soQuyetDinh });
    expect(res.status).toBe(409);
    expect(await demQuyetDinh()).toBe(truoc);
    expect((await layDeXuatDb(dx.id)).trangThai).toBe('CHO_DUYET');
  });

  test('HR không xử lý đề xuất về chính mình 403; hr2 xử lý được', async () => {
    const dx = await taoDeXuat(token.giamdoc, { nhanVienId: NV_HR });
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/tuChoi`, token.hr).send({ ghiChuXuLy: 'Tự từ chối' })).status).toBe(403);
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/lapQuyetDinh`, token.hr)
      .send({ nguoiKyDuyetId: NV_GIAMDOC2, ngayBanHanh: NGAY_QUA_KHU })).status).toBe(403);
    const ok = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/lapQuyetDinh`, token.hr2)
      .send({ nguoiKyDuyetId: NV_GIAMDOC2, ngayBanHanh: NGAY_QUA_KHU });
    expect(ok.status).toBe(201);
  });

  test('người ký không được là người nhận quyết định 400', async () => {
    const dx = await taoDeXuat(token.giamdoc, { nhanVienId: NV_GIAMDOC2 });
    const res = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/lapQuyetDinh`, token.hr)
      .send({ nguoiKyDuyetId: NV_GIAMDOC2, ngayBanHanh: NGAY_QUA_KHU });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('Quyết định khen thưởng/kỷ luật - xem', () => {
  test('chưa đăng nhập 401', async () => {
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat')).status).toBe(401);
  });

  test('HR/giamDoc toàn bộ kèm thongKe; quanLy PM + của mình; nhanVien/Admin chỉ của mình', async () => {
    const hr = await goi('get', '/quyetDinhKhenThuongKyLuat', token.hr);
    expect(hr.status).toBe(200);
    expect(hr.body.data).toHaveProperty('thongKe');
    expect(hr.body.data).toHaveProperty('phanTrang');
    expect(hr.body.data.items.map((q) => q.id)).toEqual(expect.arrayContaining([1, 2, 3]));
    const gd = await goi('get', '/quyetDinhKhenThuongKyLuat', token.giamdoc);
    expect(gd.body.data.items.map((q) => q.id)).toEqual(expect.arrayContaining([1, 2, 3]));
    const ql = (await goi('get', '/quyetDinhKhenThuongKyLuat', token.quanly)).body.data.items.map((q) => q.id);
    expect(ql).toContain(1);
    expect(ql).not.toContain(2);
    expect(ql).not.toContain(3);
    const nv = (await goi('get', '/quyetDinhKhenThuongKyLuat', token.nhanvien)).body.data.items;
    expect(nv.length).toBeGreaterThan(0);
    expect(nv.every((q) => q.nhanVienId === NV_NHANVIEN)).toBe(true);
    const nv3 = (await goi('get', '/quyetDinhKhenThuongKyLuat', token.nhanvien3)).body.data.items;
    expect(nv3.every((q) => q.nhanVienId === NV_NHANVIEN3)).toBe(true);
    const ad = await goi('get', '/quyetDinhKhenThuongKyLuat', token.admin);
    expect(ad.status).toBe(200);
    expect(ad.body.data.items.every((q) => q.nhanVienId === NV_ADMIN)).toBe(true);
  });

  test('GET /:id ngoài phạm vi 404 (nhanVien xem của người khác)', async () => {
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/1', token.nhanvien)).status).toBe(200);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/2', token.nhanvien)).status).toBe(404);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/1', token.nhanvien2)).status).toBe(404);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/1', token.quanly)).status).toBe(200);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/2', token.quanly)).status).toBe(404);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/3', token.giamdoc)).status).toBe(200);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/999999', token.hr)).status).toBe(404);
  });

  test('GET /nguoiKy: chỉ HR, trả danh sách giamDoc', async () => {
    const res = await goi('get', '/quyetDinhKhenThuongKyLuat/nguoiKy', token.hr);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining([NV_GIAMDOC, NV_GIAMDOC2]));
    expect(ids).not.toContain(NV_HR);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/nguoiKy', token.giamdoc)).status).toBe(403);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/nguoiKy', token.nhanvien)).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
describe('Quyết định - lập trực tiếp', () => {
  test('HR lập với người ký giamDoc 201; số tự sinh tăng dần; nhật ký', async () => {
    const r1 = await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr).send(bodyQuyetDinh());
    expect(r1.status).toBe(201);
    expect(r1.body.data.quyetDinh).toMatchObject({ nhanVienId: NV_NHANVIEN, nguoiKyDuyetId: NV_GIAMDOC });
    const r2 = await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr).send(bodyQuyetDinh({ loaiQuyetDinh: 'KY_LUAT' }));
    expect(r2.status).toBe(201);
    const so = (r) => Number(r.body.data.quyetDinh.soQuyetDinh.split('-')[1]);
    expect(r1.body.data.quyetDinh.soQuyetDinh).toMatch(/^QD2021-\d{4}$/);
    expect(so(r2)).toBe(so(r1) + 1);
    expect(await layNhatKy('LAP_QUYET_DINH_KTKL')).toHaveLength(2);
  });

  test('giamDoc tự ký (bỏ qua nguoiKyDuyetId gửi lên); không lập cho chính mình 400', async () => {
    const res = await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(bodyQuyetDinh({ nguoiKyDuyetId: NV_GIAMDOC2 }));
    expect(res.status).toBe(201);
    expect(res.body.data.quyetDinh.nguoiKyDuyetId).toBe(NV_GIAMDOC);
    expect((await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(bodyQuyetDinh({ nhanVienId: NV_GIAMDOC }))).status).toBe(400);
    expect((await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr).send(bodyQuyetDinh({ nhanVienId: NV_HR }))).status).toBe(400);
  });

  test('sai vai trò 403', async () => {
    for (const tk of ['quanly', 'nhanvien', 'admin']) {
      expect((await goi('post', '/quyetDinhKhenThuongKyLuat', token[tk]).send(bodyQuyetDinh())).status).toBe(403);
    }
  });

  test('dữ liệu sai 400, nhân viên không tồn tại 404, số trùng 409', async () => {
    const truoc = await demQuyetDinh();
    const sai = [
      { nhanVienId: 'x' }, { loaiQuyetDinh: 'THUONG' }, { ngayBanHanh: '15/03/2021' }, { ngayBanHanh: '2099-12-01' },
      { soTien: -5 }, { tieuDe: '' }, { nguoiKyDuyetId: NV_QUANLY }, { nguoiKyDuyetId: undefined }, { soQuyetDinh: 'ab' },
    ];
    for (const ghiDe of sai) {
      const res = await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr).send(bodyQuyetDinh(ghiDe));
      expect([ghiDe, res.status]).toEqual([ghiDe, 400]);
    }
    expect((await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr).send(bodyQuyetDinh({ nhanVienId: 999999 }))).status).toBe(404);
    const [[seed]] = await pool.query('SELECT soQuyetDinh FROM quyetdinhkhenthuongkyluat WHERE id = 2');
    const trung = await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr).send(bodyQuyetDinh({ soQuyetDinh: seed.soQuyetDinh }));
    expect(trung.status).toBe(409);
    expect(trung.body).toMatchObject({ success: false, code: 409, data: null });
    expect(await demQuyetDinh()).toBe(truoc);
  });

  test('ngày ban hành cuối tháng hiện tại hợp lệ, đầu tháng sau 400', async () => {
    const d = new Date();
    const cuoi = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0)).toISOString().slice(0, 10);
    const dauSau = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1)).toISOString().slice(0, 10);
    expect((await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr).send(bodyQuyetDinh({ ngayBanHanh: dauSau }))).status).toBe(400);
    // Tháng hiện tại có thể đã có bảng lương seed? seed chỉ có bảng tháng chốt (quá khứ) nên cuối tháng này hợp lệ
    const ok = await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr).send(bodyQuyetDinh({ ngayBanHanh: cuoi }));
    expect(ok.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
describe('Quyết định và bảng lương tháng ban hành', () => {
  test('tháng có bảng lương CHO_DUYET/DA_DUYET -> 409, không ghi quyết định', async () => {
    for (const [thang, trangThai] of [[7, 'CHO_DUYET'], [8, 'DA_DUYET']]) {
      await pool.execute(
        `INSERT INTO bangtonghopluong (maBangLuong, thang, nam, tongChiPhiLuong, trangThai, nguoiLapId)
         VALUES (?, ?, 2020, 0, ?, 4)`, [`QABL2020-0${thang}`, thang, trangThai]
      );
    }
    const truoc = await demQuyetDinh();
    expect((await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr).send(bodyQuyetDinh({ ngayBanHanh: '2020-07-10' }))).status).toBe(409);
    expect((await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr).send(bodyQuyetDinh({ ngayBanHanh: '2020-08-10' }))).status).toBe(409);
    const dx = await taoDeXuat();
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/lapQuyetDinh`, token.hr)
      .send({ nguoiKyDuyetId: NV_GIAMDOC, ngayBanHanh: '2020-07-10' })).status).toBe(409);
    expect((await layDeXuatDb(dx.id)).trangThai).toBe('CHO_DUYET');
    expect(await demQuyetDinh()).toBe(truoc);
  });

  test('tháng có bảng lương BAN_NHAP -> tự tính lại phiếu (thưởng +, kỷ luật -), canhBao, nhật ký TINH_LAI_BANG_LUONG', async () => {
    const thang = '2020-06';
    await pool.execute("INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, chiTiet) VALUES (4, 'CHOT_CONG_THANG', ?)", [thang]);
    const lap = await goi('post', '/bangLuong', token.hr).send({ thang });
    expect(lap.status).toBe(201);
    const bangId = lap.body.data.id ?? lap.body.data.bangLuong?.id;
    const layThuong = async () => {
      const [[p]] = await pool.execute('SELECT thuongKPI FROM phieuluongnhanvien WHERE bangTongHopLuongId = ? AND nhanVienId = ?', [bangId, NV_QUANLY]);
      return Number(p.thuongKPI);
    };
    const goc = await layThuong();

    const khen = await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr)
      .send(bodyQuyetDinh({ nhanVienId: NV_QUANLY, soTien: 1000000, ngayBanHanh: '2020-06-15' }));
    expect(khen.status).toBe(201);
    expect(khen.body.data.canhBao).toEqual(expect.stringContaining('BL'));
    expect(await layThuong()).toBe(goc + 1000000);
    expect(await layNhatKy('TINH_LAI_BANG_LUONG_KTKL')).toHaveLength(1);
    expect(await layNhatKy('TINH_LAI_BANG_LUONG')).toHaveLength(0);

    const phat = await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr)
      .send(bodyQuyetDinh({ nhanVienId: NV_QUANLY, loaiQuyetDinh: 'KY_LUAT', soTien: 300000, ngayBanHanh: '2020-06-20' }));
    expect(phat.status).toBe(201);
    expect(await layThuong()).toBe(goc + 700000);
    const [[b]] = await pool.execute('SELECT trangThai FROM bangtonghopluong WHERE id = ?', [bangId]);
    expect(b.trangThai).toBe('BAN_NHAP');
  });

  test('giamDoc lập quyết định vào tháng có bảng nháp vẫn duyệt được bảng lương đó (200)', async () => {
    const thang = '2020-09';
    await pool.execute("INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, chiTiet) VALUES (4, 'CHOT_CONG_THANG', ?)", [thang]);
    const lap = await goi('post', '/bangLuong', token.hr).send({ thang });
    expect(lap.status).toBe(201);
    const bangId = lap.body.data.id ?? lap.body.data.bangLuong?.id;
    const qd = await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc)
      .send(bodyQuyetDinh({ nhanVienId: NV_QUANLY, ngayBanHanh: '2020-09-15' }));
    expect(qd.status).toBe(201);
    expect(qd.body.data.canhBao).toEqual(expect.any(String));
    expect(await layNhatKy('TINH_LAI_BANG_LUONG_KTKL')).toHaveLength(1);
    expect((await goi('post', `/bangLuong/${bangId}/guiDuyet`, token.hr)).status).toBe(200);
    const duyet = await goi('post', `/bangLuong/${bangId}/duyet`, token.giamdoc);
    expect(duyet.status).toBe(200);
    const [[b]] = await pool.execute('SELECT trangThai FROM bangtonghopluong WHERE id = ?', [bangId]);
    expect(b.trangThai).toBe('DA_DUYET');
  });

  test('kỷ luật phạt vượt thu nhập trên bảng BAN_NHAP: canhBao chứa "phạt vượt thu nhập bị bỏ" kèm mã NV', async () => {
    const thang = '2020-05';
    await pool.execute("INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, chiTiet) VALUES (4, 'CHOT_CONG_THANG', ?)", [thang]);
    const lap = await goi('post', '/bangLuong', token.hr).send({ thang });
    expect(lap.status).toBe(201);
    const phat = await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr)
      .send(bodyQuyetDinh({ nhanVienId: NV_QUANLY, loaiQuyetDinh: 'KY_LUAT', soTien: 500000000, ngayBanHanh: '2020-05-20' }));
    expect(phat.status).toBe(201);
    expect(phat.body.data.canhBao).toEqual(expect.stringContaining('phạt vượt thu nhập bị bỏ'));
    expect(phat.body.data.canhBao).toEqual(expect.stringContaining('NV0003'));
    // Quyết định sau cùng tháng tính lại cả bảng: phạt của NV0003 vẫn bị cắt nên vẫn cảnh báo
    const khen = await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr)
      .send(bodyQuyetDinh({ nhanVienId: NV_NHANVIEN, soTien: 100000, ngayBanHanh: '2020-05-21' }));
    expect(khen.status).toBe(201);
    expect(khen.body.data.canhBao).toEqual(expect.stringContaining('NV0003'));
  });
});

// ---------------------------------------------------------------------------
describe('Kiểm tra lại điều kiện tại thời điểm xử lý', () => {
  test('lập quyết định với người ký giamDoc có tài khoản bị khóa -> 400, rollback; mở lại thì lập được', async () => {
    const [[nk]] = await pool.execute(
      'SELECT nd.id, nd.trangThai FROM nhanvien nv JOIN nguoidung nd ON nd.id = nv.nguoiDungId WHERE nv.id = ?', [NV_GIAMDOC2]);
    const dx = await taoDeXuat();
    const truoc = await demQuyetDinh();
    await pool.execute("UPDATE nguoidung SET trangThai = 'BI_KHOA' WHERE id = ?", [nk.id]);
    try {
      const r1 = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/lapQuyetDinh`, token.hr)
        .send({ nguoiKyDuyetId: NV_GIAMDOC2, ngayBanHanh: NGAY_QUA_KHU });
      expect(r1.status).toBe(400);
      expect(r1.body).toMatchObject({ success: false, code: 400, data: null });
      const r2 = await goi('post', '/quyetDinhKhenThuongKyLuat', token.hr).send(bodyQuyetDinh({ nguoiKyDuyetId: NV_GIAMDOC2 }));
      expect(r2.status).toBe(400);
      expect(await demQuyetDinh()).toBe(truoc);
      expect((await layDeXuatDb(dx.id)).trangThai).toBe('CHO_DUYET');
      const nguoiKy = await goi('get', '/quyetDinhKhenThuongKyLuat/nguoiKy', token.hr);
      expect(nguoiKy.status).toBe(200);
      const dsNguoiKy = Array.isArray(nguoiKy.body.data) ? nguoiKy.body.data : nguoiKy.body.data.items;
      expect(dsNguoiKy.map((n) => n.id)).not.toContain(NV_GIAMDOC2);
    } finally {
      await pool.execute('UPDATE nguoidung SET trangThai = ? WHERE id = ?', [nk.trangThai, nk.id]);
    }
    const ok = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/lapQuyetDinh`, token.hr)
      .send({ nguoiKyDuyetId: NV_GIAMDOC2, ngayBanHanh: NGAY_QUA_KHU });
    expect(ok.status).toBe(201);
  });

  test('quanLy sửa đề xuất khi nhân viên đã chuyển ra khỏi phòng mình -> bị chặn, không đổi dữ liệu', async () => {
    const dx = await taoDeXuat();
    const [[goc]] = await pool.execute('SELECT chucDanhPhongBanId FROM nhanvien WHERE id = ?', [NV_NHANVIEN]);
    const [[khac]] = await pool.execute('SELECT chucDanhPhongBanId FROM nhanvien WHERE id = ?', [NV_NHANVIEN3]);
    expect(khac.chucDanhPhongBanId).not.toBe(goc.chucDanhPhongBanId);
    await pool.execute('UPDATE nhanvien SET chucDanhPhongBanId = ? WHERE id = ?', [khac.chucDanhPhongBanId, NV_NHANVIEN]);
    try {
      const res = await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.quanly).send({ tieuDe: 'Sửa sau khi chuyển phòng' });
      expect([403, 404]).toContain(res.status);
      expect(res.body).toMatchObject({ success: false, data: null });
      expect((await layDeXuatDb(dx.id)).tieuDe).toBe('QA khen thưởng');
      expect(await layNhatKy('SUA_DE_XUAT_KTKL')).toHaveLength(0);
    } finally {
      await pool.execute('UPDATE nhanvien SET chucDanhPhongBanId = ? WHERE id = ?', [goc.chucDanhPhongBanId, NV_NHANVIEN]);
    }
    const ok = await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.quanly).send({ tieuDe: 'Sửa khi đã về phòng' });
    expect(ok.status).toBe(200);
  });
});
