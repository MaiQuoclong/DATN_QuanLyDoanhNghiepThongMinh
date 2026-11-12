const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const { layNgayLeCuaNam, laNgayLe, laNgayNghiChung, daKhaiBaoNgayLe } = require('../src/utils/ngayLe');
const { heSoLamThemCuaNgay, tinhGioLamThemQuyDoi, lapPhieu } = require('../src/utils/tinhLuong');

const MAT_KHAU = 'MatKhau@123';
const token = {};
let mocNhatKy;

const dsNgayLe = (nam) => [...layNgayLeCuaNam(nam)].sort();

beforeAll(async () => {
  // Năm chưa khai báo âm lịch in cảnh báo console: tắt để log test gọn
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const [[m]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM nhatkyhethong');
  mocNhatKy = m.m;
  for (const ten of ['admin', 'giamdoc', 'quanly', 'hr', 'nhanvien']) {
    const res = await request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap: ten, matKhau: MAT_KHAU });
    expect(res.status).toBe(200);
    token[ten] = res.body.data.token;
  }
});

afterAll(async () => {
  jest.restoreAllMocks();
  // Dọn nhật ký đăng nhập do test sinh ra
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKy]);
  await pool.query('ALTER TABLE nhatkyhethong AUTO_INCREMENT = 1');
  await pool.end();
});

// ---------------------------------------------------------------------------
describe('Unit utils/ngayLe - nghỉ bù (Điều 111 khoản 3, Điều 112)', () => {
  test('năm 2026: lễ âm lịch khai báo + lễ dương lịch rơi ngày thường, không có nghỉ bù', () => {
    expect(dsNgayLe(2026)).toEqual([
      '2026-01-01',
      '2026-02-16',
      '2026-02-17',
      '2026-02-18',
      '2026-02-19',
      '2026-02-20',
      '2026-04-27',
      '2026-04-30',
      '2026-05-01',
      '2026-09-01',
      '2026-09-02',
    ]);
    expect(daKhaiBaoNgayLe(2026)).toBe(true);
  });

  test('năm 2027: Tết Đinh Mùi 4/2–10/2 (T7/CN 6–7/2 không tính), Giỗ Tổ 16/4, 1/5 bù 3/5, Quốc khánh 2–3/9', () => {
    expect(dsNgayLe(2027)).toEqual([
      '2027-01-01',
      '2027-02-04',
      '2027-02-05',
      '2027-02-08',
      '2027-02-09',
      '2027-02-10',
      '2027-04-16',
      '2027-04-30',
      '2027-05-03', // 01/5 thứ 7 -> nghỉ bù thứ 2
      '2027-09-02',
      '2027-09-03',
    ]);
    expect(daKhaiBaoNgayLe(2027)).toBe(true);
  });

  test('năm 2028: 01/01 thứ 7 bù 03/01; 30/4 Chủ nhật bù 02/5 (vì 01/5 đã là lễ); 02/9 thứ 7 bù 04/9', () => {
    const ds = dsNgayLe(2028);
    expect(ds).toEqual(['2028-01-03', '2028-05-01', '2028-05-02', '2028-09-04']);
    expect(ds).not.toContain('2028-04-30'); // ngày lễ gốc rơi cuối tuần không tính là ngày lễ làm việc
    expect(daKhaiBaoNgayLe(2028)).toBe(false);
  });

  test('năm 2022: 30/4 thứ 7 và 01/5 Chủ nhật cùng cuối tuần -> 2 lượt bù 02/5 và 03/5 (không trùng nhau)', () => {
    const ds = dsNgayLe(2022);
    expect(ds).toEqual(expect.arrayContaining(['2022-05-02', '2022-05-03']));
    expect(ds.filter((d) => d.startsWith('2022-05'))).toEqual(['2022-05-02', '2022-05-03']);
  });

  test('laNgayLe / laNgayNghiChung: ngày bù là ngày nghỉ, ngày thường không phải', () => {
    expect(laNgayLe('2028-05-02')).toBe(true);
    expect(laNgayLe('2028-05-03')).toBe(false);
    expect(laNgayNghiChung('2028-05-02')).toBe(true);
    expect(laNgayNghiChung('2028-04-30')).toBe(true); // Chủ nhật
    expect(laNgayNghiChung('2026-11-10')).toBe(false); // thứ 3 bình thường
  });

  test('kết quả lưu đệm: gọi lại cùng năm trả cùng tập', () => {
    expect(layNgayLeCuaNam(2028)).toBe(layNgayLeCuaNam(2028));
  });
});

// ---------------------------------------------------------------------------
describe('Unit tinhLuong - hệ số làm thêm theo loại ngày (Điều 98)', () => {
  test.each([
    ['2026-11-10', 1.5], // thứ 3
    ['2026-11-14', 2], // thứ 7
    ['2026-11-15', 2], // Chủ nhật
    ['2026-09-02', 3], // Quốc khánh
    ['2026-02-17', 3], // Tết
    ['2028-05-02', 3], // ngày nghỉ bù tính như ngày lễ
  ])('ngày %s -> hệ số %d', (ngay, heSo) => {
    expect(heSoLamThemCuaNgay(ngay)).toBe(heSo);
  });

  test('tinhGioLamThemQuyDoi cộng giờ OT × hệ số từng ngày (giờ dạng chuỗi DECIMAL)', () => {
    const banGhi = [
      { ngayChamCong: '2026-11-10', soGioLamThemOT: '2.00' }, // 2 × 1.5 = 3
      { ngayChamCong: '2026-11-14', soGioLamThemOT: '3.00' }, // 3 × 2 = 6
      { ngayChamCong: '2026-09-02', soGioLamThemOT: '1.00' }, // 1 × 3 = 3
    ];
    expect(tinhGioLamThemQuyDoi(banGhi)).toBe(12);
    expect(tinhGioLamThemQuyDoi([])).toBe(0);
  });

  test('lapPhieu dùng giờ quy đổi khi có, mặc định × 1.5 khi không truyền', () => {
    const chung = { luongCoBan: 22000000, mucPhuCap: 0, soNgayCongThucTe: 22, thuongPhat: 0 };
    // đơn giá giờ = 22.000.000 / 22 / 8 = 125.000
    expect(lapPhieu({ ...chung, gioLamThemQuyDoi: 12 }, 22).luongLamThemOT).toBe(1500000);
    expect(lapPhieu({ ...chung, tongGioLamThem: 4 }, 22).luongLamThemOT).toBe(750000);
  });
});

// ---------------------------------------------------------------------------
describe('GET /api/v1/ngayLe', () => {
  const goi = (query, tk) => {
    const r = request(app).get(`/api/v1/ngayLe${query}`);
    return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
  };

  test('chưa đăng nhập trả 401 chuẩn', async () => {
    const res = await goi('?nam=2026');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, code: 401, message: expect.any(String), data: null });
  });

  test.each(['admin', 'giamdoc', 'quanly', 'hr', 'nhanvien'])('%s lấy được danh sách ngày lễ năm 2026', async (ten) => {
    const res = await goi('?nam=2026', token[ten]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      code: 200,
      message: expect.any(String),
      data: { nam: 2026, cacNgay: dsNgayLe(2026), daKhaiBaoAmLich: true },
    });
  });

  test('năm chưa khai báo âm lịch (2028) trả lễ dương lịch + nghỉ bù, daKhaiBaoAmLich = false', async () => {
    const res = await goi('?nam=2028', token.nhanvien);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ nam: 2028, cacNgay: ['2028-01-03', '2028-05-01', '2028-05-02', '2028-09-04'], daKhaiBaoAmLich: false });
  });

  test('không truyền nam -> năm hiện tại', async () => {
    const res = await goi('', token.hr);
    expect(res.status).toBe(200);
    expect(res.body.data.nam).toBe(new Date().getFullYear());
  });

  test.each(['abc', '1999', '2101', '20261', '2026.5', '-2026', ''])('nam=%s sai trả 400 chuẩn', async (nam) => {
    const res = await goi(`?nam=${nam}`, token.hr);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, code: 400, message: expect.any(String), data: null });
  });
});
