const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const hopDongRepository = require('../src/repositories/hopDongRepository');

// Dữ liệu mẫu (database/seed.sql mục 8): hợp đồng id 1-7
//  1 NV0002 KXĐ, 2 NV0003 XĐTH DA_CHAM_DUT, 3 NV0003 KXĐ, 4 NV0004 (hr) KXĐ, 5 NV0001 (admin) KXĐ,
//  6 NV0005 (nhanvien) XĐTH, 7 NV0006 (nhanvien2) THU_VIEC
const MAT_KHAU = 'MatKhau@123';
const URL = '/api/v1/hopDong';
const COT_HD = ['ngayBatDau', 'ngayKetThuc', 'luongCoBan', 'mucPhuCap', 'trangThai', 'duongDanFileHopDong'];
const VAI_TRO_HR_ID = 4;

const token = {};
let mocNhatKyDau;
let mocNhatKy;
let anhChup;
let demTen = 0;

// Ngày tương đối theo giờ máy chủ (giống service)
function ngay(soNgay = 0) {
  const d = new Date();
  d.setDate(d.getDate() + soNgay);
  return d.toLocaleDateString('sv-SE');
}
function congNgay(chuoi, soNgay) {
  const d = new Date(`${chuoi}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + soNgay);
  return d.toISOString().slice(0, 10);
}
function congThang(chuoi, soThang) {
  const [nam, thang, n] = chuoi.split('-').map(Number);
  const tong = thang - 1 + soThang;
  const namMoi = nam + Math.floor(tong / 12);
  const thangMoi = (tong % 12) + 1;
  const cuoi = new Date(Date.UTC(namMoi, thangMoi, 0)).getUTCDate();
  return `${namMoi}-${String(thangMoi).padStart(2, '0')}-${String(Math.min(n, cuoi)).padStart(2, '0')}`;
}

const NGAY_VAO_LAM = ngay(-400);

function dangNhap(tenDangNhap, matKhau = MAT_KHAU) {
  return request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap, matKhau });
}
const goi = (phuongThuc, duongDan, tk) => {
  const r = request(app)[phuongThuc](`${URL}${duongDan}`);
  return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
};

async function taoNhanVien(ghiDe = {}) {
  demTen += 1;
  const ten = `qahd${Date.now() % 100000}${demTen}`;
  const res = await request(app)
    .post('/api/v1/nhanVien')
    .set('Authorization', `Bearer ${token.hr}`)
    .send({
      hoVaTen: 'Trần Hợp Đồng',
      gioiTinh: 'NAM',
      ngaySinh: '1995-05-20',
      ngayVaoLam: NGAY_VAO_LAM,
      chucDanhPhongBanId: 5,
      tenDangNhap: ten,
      email: `${ten}@smarthrm.local`,
      ...ghiDe,
    });
  expect(res.status).toBe(201);
  return res.body.data;
}

// Tạo thêm một HR có hồ sơ nhân viên, đã đổi mật khẩu tạm để gọi API được
async function taoHrThuHai() {
  const { nhanVien, taiKhoan } = await taoNhanVien();
  await pool.execute('INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES (?, ?)', [nhanVien.nguoiDungId, VAI_TRO_HR_ID]);
  const dn = await dangNhap(taiKhoan.tenDangNhap, taiKhoan.matKhauTam);
  expect(dn.status).toBe(200);
  const doi = await request(app)
    .post('/api/v1/xacThuc/doiMatKhau')
    .set('Authorization', `Bearer ${dn.body.data.token}`)
    .send({ matKhauCu: taiKhoan.matKhauTam, matKhauMoi: 'HrThuHai123' });
  expect(doi.status).toBe(200);
  const dn2 = await dangNhap(taiKhoan.tenDangNhap, 'HrThuHai123');
  expect(dn2.status).toBe(200);
  return { nhanVien, tk: dn2.body.data.token };
}

const taoHopDong = (body, tk = token.hr) => goi('post', '', tk).send(body);
function hopDongXacDinh(nhanVienId, ghiDe = {}) {
  return {
    nhanVienId,
    loaiHopDong: 'XAC_DINH_THOI_HAN',
    ngayBatDau: ngay(0),
    ngayKetThuc: ngay(364),
    luongCoBan: 15000000,
    mucPhuCap: '500000.50',
    ...ghiDe,
  };
}
// Đếm số hợp đồng hiện có trong CSDL (không đếm cứng theo seed)
async function demHopDong() {
  const [[d]] = await pool.query('SELECT COUNT(*) AS n FROM hopdonglaodong');
  return Number(d.n);
}
async function taoHopDongOk(body) {
  const res = await taoHopDong(body);
  expect(res.status).toBe(201);
  return res.body.data;
}

async function layHopDongDb(id) {
  const [d] = await pool.execute('SELECT * FROM hopdonglaodong WHERE id = ?', [id]);
  return d[0];
}
async function layLichSuDb(hopDongId) {
  const [d] = await pool.execute('SELECT * FROM lichsuhopdong WHERE hopDongLaoDongId = ? ORDER BY id', [hopDongId]);
  return d;
}
async function layNhatKy(hanhDong) {
  const [d] = await pool.execute('SELECT nguoiDungId, chiTiet FROM nhatkyhethong WHERE id > ? AND hanhDong = ? ORDER BY id', [
    mocNhatKy,
    hanhDong,
  ]);
  return d;
}

async function datLaiAutoIncrement() {
  for (const bang of ['hopdonglaodong', 'lichsuhopdong', 'nhanvien', 'nguoidung', 'nhatkyhethong']) {
    await pool.query(`ALTER TABLE ${bang} AUTO_INCREMENT = 1`);
  }
}

beforeAll(async () => {
  const [moc] = await pool.execute('SELECT COALESCE(MAX(id), 0) AS moc FROM nhatkyhethong');
  mocNhatKyDau = moc[0].moc;
  const [hd] = await pool.query(`SELECT id, ${COT_HD.join(', ')} FROM hopdonglaodong`);
  const [[ls]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM lichsuhopdong');
  const [[nv]] = await pool.query('SELECT MAX(id) AS m FROM nhanvien');
  const [[nd]] = await pool.query('SELECT MAX(id) AS m FROM nguoidung');
  const [nvTt] = await pool.query('SELECT id, trangThaiLamViec FROM nhanvien');
  anhChup = {
    hd,
    nvTt,
    maxHopDong: Math.max(...hd.map((d) => d.id)),
    maxLichSu: ls.m,
    maxNhanVien: nv.m,
    maxNguoiDung: nd.m,
  };
  for (const ten of ['admin', 'giamdoc', 'quanly', 'hr', 'nhanvien', 'nhanvien2']) {
    const res = await dangNhap(ten);
    expect(res.status).toBe(200);
    token[ten] = res.body.data.token;
  }
});

beforeEach(async () => {
  const [moc] = await pool.execute('SELECT COALESCE(MAX(id), 0) AS moc FROM nhatkyhethong');
  mocNhatKy = moc[0].moc;
  // Seed tính ngày hợp đồng 6, 7 theo CURDATE(); test đọc ngày thật từ CSDL, không ghi đè ngày cố định
});

afterEach(async () => {
  jest.restoreAllMocks();
  await pool.execute('DELETE FROM hopdonglaodong WHERE id > ?', [anhChup.maxHopDong]); // CASCADE lichsuhopdong
  await pool.execute('DELETE FROM lichsuhopdong WHERE id > ?', [anhChup.maxLichSu]);
  for (const d of anhChup.hd) {
    await pool.execute(`UPDATE hopdonglaodong SET ${COT_HD.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
      ...COT_HD.map((c) => d[c]),
      d.id,
    ]);
  }
  for (const d of anhChup.nvTt) {
    await pool.execute('UPDATE nhanvien SET trangThaiLamViec = ? WHERE id = ?', [d.trangThaiLamViec, d.id]);
  }
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKy]);
  await pool.execute('DELETE FROM nhanvien WHERE id > ?', [anhChup.maxNhanVien]);
  await pool.execute('DELETE FROM nguoidungvaitro WHERE nguoiDungId > ?', [anhChup.maxNguoiDung]);
  await pool.execute('DELETE FROM nguoidung WHERE id > ?', [anhChup.maxNguoiDung]);
  await datLaiAutoIncrement();
});

afterAll(async () => {
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKyDau]);
  await datLaiAutoIncrement();
  await pool.end();
});

// ---------------------------------------------------------------------------
describe('Phân quyền 5 vai trò', () => {
  test('chưa đăng nhập trả 401 chuẩn cho mọi endpoint', async () => {
    for (const [pt, dd] of [
      ['get', ''],
      ['get', '/cuaToi'],
      ['get', '/sapHetHan'],
      ['get', '/6'],
      ['post', ''],
      ['post', '/6/giaHan'],
      ['post', '/6/dieuChinh'],
      ['post', '/6/chamDut'],
    ]) {
      const res = await goi(pt, dd);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ success: false, code: 401, message: expect.any(String), data: null });
    }
  });

  test.each(['admin', 'quanly', 'nhanvien'])('%s không xem được danh sách và sắp hết hạn (403)', async (ten) => {
    for (const dd of ['', '/sapHetHan']) {
      const res = await goi('get', dd, token[ten]);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ success: false, code: 403, data: null });
    }
  });

  test.each(['admin', 'giamdoc', 'quanly', 'nhanvien'])('%s không được lập/gia hạn/điều chỉnh/chấm dứt (403)', async (ten) => {
    const cacYeuCau = [
      goi('post', '', token[ten]).send(hopDongXacDinh(6)),
      goi('post', '/6/giaHan', token[ten]).send({ ngayKetThucMoi: '2027-06-01' }),
      goi('post', '/6/dieuChinh', token[ten]).send({ luongCoBan: 1, lyDo: 'x' }),
      goi('post', '/6/chamDut', token[ten]).send({ ngayChamDut: ngay(0), lyDo: 'x' }),
    ];
    for (const res of await Promise.all(cacYeuCau)) expect(res.status).toBe(403);
    expect((await layHopDongDb(6)).trangThai).toBe('HIEU_LUC');
  });

  test.each([
    ['nhanvien', 6, 200],
    ['nhanvien', 7, 403],
    ['nhanvien', 1, 403],
    ['admin', 5, 200],
    ['admin', 6, 403],
    ['quanly', 3, 200],
    ['quanly', 6, 403],
    ['giamdoc', 6, 200],
    ['hr', 1, 200],
  ])('%s xem chi tiết hợp đồng %i -> %i', async (ten, id, ma) => {
    const res = await goi('get', `/${id}`, token[ten]);
    expect(res.status).toBe(ma);
    if (ma === 200) {
      expect(res.body).toMatchObject({ success: true, code: 200, data: { id } });
      expect(Array.isArray(res.body.data.lichSu)).toBe(true);
    } else {
      expect(res.body).toMatchObject({ success: false, code: 403, data: null });
    }
  });

  test('HR không được tự thao tác hợp đồng của chính mình (403)', async () => {
    const r1 = await goi('post', '/4/dieuChinh', token.hr).send({ luongCoBan: 99000000, lyDo: 'Tự tăng lương' });
    const r2 = await goi('post', '/4/chamDut', token.hr).send({ ngayChamDut: ngay(0), lyDo: 'x' });
    const r3 = await taoHopDong(hopDongXacDinh(4, { ngayBatDau: '2099-01-01' }));
    expect([r1.status, r2.status, r3.status]).toEqual([403, 403, 403]);
    expect(Number((await layHopDongDb(4)).luongCoBan)).toBe(16000000);
  });
});

// ---------------------------------------------------------------------------
describe('GET danh sách, cuaToi, chi tiết', () => {
  test.each(['hr', 'giamdoc'])('%s lấy toàn bộ hợp đồng mẫu, phân trang chuẩn', async (ten) => {
    const res = await goi('get', '', token[ten]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200, message: expect.any(String) });
    const tongSo = await demHopDong();
    expect(res.body.data.phanTrang).toEqual({ trang: 1, kichThuoc: 20, tongSo });
    expect(res.body.data.items).toHaveLength(Math.min(tongSo, 20));
    expect(JSON.stringify(res.body)).not.toMatch(/matKhauMaHoa|soTaiKhoanNganHang/);
  });

  test.each([
    ['?nhanVienId=3', [3, 2]],
    ['?trangThai=DA_CHAM_DUT', [13, 2]], // 13: hợp đồng của NV0012 đã nghỉ việc
    ['?loaiHopDong=THU_VIEC', [7]],
    ['?tuKhoa=HD2019-0001', [2]],
    ['?tuKhoa=HD2019', [2, 9]],
    ['?tuKhoa=NV0009', [10]],
    ['?tuKhoa=NV0005', [6]],
    ['?tuKhoa=%25', []],
  ])('lọc %s', async (q, mong) => {
    const res = await goi('get', q, token.hr);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((h) => h.id)).toEqual(mong);
    expect(res.body.data.phanTrang.tongSo).toBe(mong.length);
  });

  test('phân trang trang=2 kichThuoc=3', async () => {
    const res = await goi('get', '?trang=2&kichThuoc=3', token.hr);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(3);
    expect(res.body.data.phanTrang).toEqual({ trang: 2, kichThuoc: 3, tongSo: await demHopDong() });
  });

  test.each(['?trangThai=SAI', '?loaiHopDong=ABC', '?nhanVienId=abc', '?trangThai=HET'])('tham số sai %s trả 400', async (q) => {
    const res = await goi('get', q, token.hr);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 400, data: null });
  });

  test.each([
    ['nhanvien', [6]],
    ['nhanvien2', [7]],
    ['quanly', [3, 2]],
    ['hr', [4]],
  ])('%s xem hợp đồng của mình', async (ten, mong) => {
    const res = await goi('get', '/cuaToi', token[ten]);
    expect(res.status).toBe(200);
    expect(res.body.data.map((h) => h.id)).toEqual(mong);
  });

  test('chi tiết kèm lịch sử mới nhất trước, không tồn tại 404, id sai 400', async () => {
    const res = await goi('get', '/6', token.hr);
    expect(res.status).toBe(200);
    expect(res.body.data.lichSu.map((l) => l.hanhDong)).toEqual(['DIEU_CHINH', 'GIA_HAN', 'TAO_MOI']);
    expect((await goi('get', '/99999', token.hr)).status).toBe(404);
    expect((await goi('get', '/abc', token.hr)).status).toBe(400);
  });

  test('hợp đồng quá ngày kết thúc hiển thị HET_HAN, lọc được theo HET_HAN', async () => {
    const { nhanVien } = await taoNhanVien();
    const hd = await taoHopDongOk(hopDongXacDinh(nhanVien.id, { ngayBatDau: NGAY_VAO_LAM, ngayKetThuc: ngay(-10) }));
    expect(hd).toMatchObject({ trangThai: 'HET_HAN', trangThaiLuu: 'HIEU_LUC' });
    const res = await goi('get', `?trangThai=HET_HAN&nhanVienId=${nhanVien.id}`, token.hr);
    expect(res.body.data.items.map((h) => h.id)).toEqual([hd.id]);
    expect((await layHopDongDb(hd.id)).trangThai).toBe('HIEU_LUC');
  });
});

// ---------------------------------------------------------------------------
describe('GET /sapHetHan', () => {
  test('mặc định 30 ngày, có soNgayConLai, tối đa 365, tham số sai 400', async () => {
    const { nhanVien } = await taoNhanVien();
    const hd = await taoHopDongOk(hopDongXacDinh(nhanVien.id, { ngayBatDau: NGAY_VAO_LAM, ngayKetThuc: ngay(10) }));
    const res = await goi('get', '/sapHetHan', token.giamdoc);
    expect(res.status).toBe(200);
    expect(res.body.data.soNgay).toBe(30);
    const muc = res.body.data.items.find((h) => h.id === hd.id);
    expect(muc).toMatchObject({ soNgayConLai: 10 });

    const r5 = await goi('get', '/sapHetHan?soNgay=5', token.hr);
    expect(r5.body.data.items.some((h) => h.id === hd.id)).toBe(false);
    const rMax = await goi('get', '/sapHetHan?soNgay=1000', token.hr);
    expect(rMax.body.data.soNgay).toBe(365);
    expect((await goi('get', '/sapHetHan?soNgay=abc', token.hr)).status).toBe(400);
  });

  test('bỏ hợp đồng đã có hợp đồng nối tiếp và người đã nghỉ việc', async () => {
    const a = (await taoNhanVien()).nhanVien;
    const b = (await taoNhanVien()).nhanVien;
    const hdA = await taoHopDongOk(hopDongXacDinh(a.id, { ngayBatDau: NGAY_VAO_LAM, ngayKetThuc: ngay(10) }));
    await taoHopDongOk({ nhanVienId: a.id, loaiHopDong: 'KHONG_XAC_DINH_THOI_HAN', ngayBatDau: ngay(11), luongCoBan: 20000000 });
    const hdB = await taoHopDongOk(hopDongXacDinh(b.id, { ngayBatDau: NGAY_VAO_LAM, ngayKetThuc: ngay(10) }));
    await pool.execute("UPDATE nhanvien SET trangThaiLamViec = 'DA_NGHI_VIEC' WHERE id = ?", [b.id]);
    const res = await goi('get', '/sapHetHan', token.hr);
    const ids = res.body.data.items.map((h) => h.id);
    expect(ids).not.toContain(hdA.id);
    expect(ids).not.toContain(hdB.id);
  });

  test('seed tính ngày theo CURDATE(): HD2024-0001 (NV0005) còn 20 ngày nằm trong cảnh báo 30 ngày', async () => {
    const res = await goi('get', '/sapHetHan?soNgay=30', token.hr);
    expect(res.status).toBe(200);
    const muc = res.body.data.items.find((h) => h.id === 6);
    // Seed đặt ngayKetThuc = CURDATE()+20 lúc dựng DB; so với DATEDIFF thực tế để không phụ thuộc ngày dựng
    const [[d]] = await pool.execute('SELECT DATEDIFF(ngayKetThuc, CURDATE()) AS con FROM hopdonglaodong WHERE id = 6');
    expect(Number(d.con)).toBeGreaterThan(0);
    expect(Number(d.con)).toBeLessThanOrEqual(20);
    expect(muc).toMatchObject({ maHopDong: 'HD2024-0001', soNgayConLai: Number(d.con) });
  });

  test('seed: hợp đồng thử việc NV0006 bắt đầu CURDATE()-60, kết thúc CURDATE()+100, mã theo năm bắt đầu', async () => {
    const res = await goi('get', '/7', token.hr);
    expect(res.status).toBe(200);
    const nam = ngay(-60).slice(0, 4);
    expect(res.body.data).toMatchObject({ maHopDong: `HD${nam}-0001`, loaiHopDong: 'THU_VIEC' });
    const db = await layHopDongDb(7);
    const chuoi = (v) => (v instanceof Date ? v.toLocaleDateString('sv-SE') : String(v).slice(0, 10));
    expect(chuoi(db.ngayBatDau)).toBe(ngay(-60));
    expect(chuoi(db.ngayKetThuc)).toBe(ngay(100));
    const [nv] = await pool.execute('SELECT ngayVaoLam FROM nhanvien WHERE id = 6');
    expect(chuoi(nv[0].ngayVaoLam)).toBe(ngay(-60));
  });
});

// ---------------------------------------------------------------------------
describe('POST / - lập hợp đồng', () => {
  test('HR lập thành công: 201, mã HDyyyy-xxxx, lịch sử TAO_MOI, nhật ký THEM_HOP_DONG', async () => {
    const { nhanVien } = await taoNhanVien();
    const res = await taoHopDong(hopDongXacDinh(nhanVien.id, { lyDo: '  Ký mới  ', duongDanFileHopDong: ' /f/hd.pdf ' }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, code: 201, message: expect.any(String) });
    const hd = res.body.data;
    expect(hd.maHopDong).toMatch(new RegExp(`^HD${ngay(0).slice(0, 4)}-\\d{4}$`));
    expect(hd).toMatchObject({
      nhanVienId: nhanVien.id,
      maNhanVien: nhanVien.maNhanVien,
      loaiHopDong: 'XAC_DINH_THOI_HAN',
      ngayBatDau: ngay(0),
      ngayKetThuc: ngay(364),
      trangThai: 'HIEU_LUC',
      duongDanFileHopDong: '/f/hd.pdf',
    });
    expect(Number(hd.luongCoBan)).toBe(15000000);
    expect(Number(hd.mucPhuCap)).toBe(500000.5);
    expect(hd.lichSu).toHaveLength(1);
    expect(hd.lichSu[0]).toMatchObject({
      hanhDong: 'TAO_MOI',
      loaiHopDongCu: null,
      trangThaiCu: null,
      trangThaiMoi: 'HIEU_LUC',
      lyDoThayDoi: 'Ký mới',
      nguoiThucHienId: 4,
    });
    const nk = await layNhatKy('THEM_HOP_DONG');
    expect(nk).toHaveLength(1);
    expect(nk[0].nguoiDungId).toBe(4);
    expect(nk[0].chiTiet).toContain(hd.maHopDong);
  });

  test('mã theo năm ngày bắt đầu và tăng dần', async () => {
    const { nhanVien } = await taoNhanVien();
    const nam = Number(ngay(0).slice(0, 4)) - 1;
    const a = await taoHopDongOk({
      nhanVienId: nhanVien.id,
      loaiHopDong: 'THU_VIEC',
      ngayBatDau: NGAY_VAO_LAM,
      ngayKetThuc: congNgay(NGAY_VAO_LAM, 30),
      luongCoBan: 1,
    });
    expect(a.maHopDong.slice(0, 6)).toBe(`HD${NGAY_VAO_LAM.slice(0, 4)}`);
    const b = await taoHopDongOk(hopDongXacDinh(nhanVien.id));
    const c = await taoHopDongOk(hopDongXacDinh((await taoNhanVien()).nhanVien.id));
    expect(Number(c.maHopDong.slice(7))).toBe(Number(b.maHopDong.slice(7)) + 1);
    expect(nam).toBeGreaterThan(2000);
  });

  test('mức phụ cấp mặc định 0, không thời hạn có ngayKetThuc null', async () => {
    const { nhanVien } = await taoNhanVien();
    const hd = await taoHopDongOk({
      nhanVienId: nhanVien.id,
      loaiHopDong: 'KHONG_XAC_DINH_THOI_HAN',
      ngayBatDau: ngay(0),
      luongCoBan: '12000000.00',
    });
    expect(hd.ngayKetThuc).toBeNull();
    expect(Number(hd.mucPhuCap)).toBe(0);
  });

  test.each([
    ['thiếu nhanVienId', { nhanVienId: undefined }],
    ['nhanVienId không phải số nguyên dương', { nhanVienId: -1 }],
    ['loại hợp đồng sai', { loaiHopDong: 'ABC' }],
    ['ngày bắt đầu sai định dạng', { ngayBatDau: '2026-13-01' }],
    ['thiếu ngày bắt đầu', { ngayBatDau: undefined }],
    ['ngày kết thúc sai', { ngayKetThuc: '01/01/2027' }],
    ['thiếu lương', { luongCoBan: undefined }],
    ['lương = 0', { luongCoBan: 0 }],
    ['lương âm', { luongCoBan: -5 }],
    ['lương 3 chữ số thập phân', { luongCoBan: '1.234' }],
    ['lương dạng boolean', { luongCoBan: true }],
    ['phụ cấp không phải số', { mucPhuCap: 'abc' }],
    ['phụ cấp âm', { mucPhuCap: -1 }],
    ['lý do quá 500 ký tự', { lyDo: 'a'.repeat(501) }],
    ['đường dẫn quá 255 ký tự', { duongDanFileHopDong: 'a'.repeat(256) }],
    ['XĐTH thiếu ngày kết thúc', { ngayKetThuc: undefined }],
    ['ngày kết thúc trước ngày bắt đầu', { ngayKetThuc: ngay(-1) }],
    ['ngày kết thúc bằng ngày bắt đầu', { ngayKetThuc: ngay(0) }],
    ['KXĐ có ngày kết thúc', { loaiHopDong: 'KHONG_XAC_DINH_THOI_HAN' }],
    ['thử việc quá 180 ngày', { loaiHopDong: 'THU_VIEC', ngayKetThuc: congNgay(ngay(0), 180) }],
    ['XĐTH quá 36 tháng', { ngayKetThuc: congThang(ngay(0), 36) }],
    ['ngày bắt đầu sau hôm nay quá 180 ngày', { ngayBatDau: ngay(181), ngayKetThuc: ngay(400) }],
  ])('400 khi %s, không ghi gì vào CSDL', async (_ten, ghiDe) => {
    const soHd = await demHopDong();
    const [[ls]] = await pool.query('SELECT COUNT(*) AS n FROM lichsuhopdong');
    const res = await taoHopDong(hopDongXacDinh(6, ghiDe));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, code: 400, message: expect.any(String), data: null });
    expect(await demHopDong()).toBe(soHd);
    const [[ls2]] = await pool.query('SELECT COUNT(*) AS n FROM lichsuhopdong');
    expect(Number(ls2.n)).toBe(Number(ls.n));
  });

  test('biên hợp lệ: thử việc đúng 180 ngày, XĐTH đúng 36 tháng, bắt đầu hôm nay+180', async () => {
    const tv = await taoHopDongOk({
      nhanVienId: (await taoNhanVien()).nhanVien.id,
      loaiHopDong: 'THU_VIEC',
      ngayBatDau: ngay(0),
      ngayKetThuc: congNgay(ngay(0), 179),
      luongCoBan: 1,
    });
    expect(tv.trangThai).toBe('HIEU_LUC');
    await taoHopDongOk(hopDongXacDinh((await taoNhanVien()).nhanVien.id, { ngayKetThuc: congNgay(congThang(ngay(0), 36), -1) }));
    await taoHopDongOk(hopDongXacDinh((await taoNhanVien()).nhanVien.id, { ngayBatDau: ngay(180), ngayKetThuc: ngay(300) }));
  });

  test('ngày bắt đầu trước ngày vào làm 400; nhân viên không tồn tại 404; đã nghỉ việc 409', async () => {
    const { nhanVien } = await taoNhanVien();
    const r1 = await taoHopDong(hopDongXacDinh(nhanVien.id, { ngayBatDau: congNgay(NGAY_VAO_LAM, -1) }));
    expect(r1.status).toBe(400);
    expect((await taoHopDong(hopDongXacDinh(99999))).status).toBe(404);
    await pool.execute("UPDATE nhanvien SET trangThaiLamViec = 'DA_NGHI_VIEC' WHERE id = ?", [nhanVien.id]);
    const r3 = await taoHopDong(hopDongXacDinh(nhanVien.id));
    expect(r3.status).toBe(409);
    expect(r3.body).toMatchObject({ success: false, code: 409, data: null });
  });

  test('chồng thời gian với hợp đồng đang hiệu lực trả 409; sau khi chấm dứt thì lập được', async () => {
    const { nhanVien } = await taoNhanVien();
    const hd = await taoHopDongOk(hopDongXacDinh(nhanVien.id, { ngayKetThuc: ngay(100) }));
    const trung = await taoHopDong(hopDongXacDinh(nhanVien.id, { ngayBatDau: ngay(100), ngayKetThuc: ngay(500) }));
    expect(trung.status).toBe(409);
    expect(trung.body.message).toContain(hd.maHopDong);
    const kxd = await taoHopDong({ nhanVienId: nhanVien.id, loaiHopDong: 'KHONG_XAC_DINH_THOI_HAN', ngayBatDau: ngay(-30), luongCoBan: 1 });
    expect(kxd.status).toBe(409);
    // Liền kề (bắt đầu sau ngày kết thúc) thì hợp lệ
    await taoHopDongOk({ nhanVienId: nhanVien.id, loaiHopDong: 'KHONG_XAC_DINH_THOI_HAN', ngayBatDau: ngay(101), luongCoBan: 1 });

    const cd = await goi('post', `/${hd.id}/chamDut`, token.hr).send({ ngayChamDut: ngay(0), lyDo: 'Thôi việc' });
    expect(cd.status).toBe(200);
    await taoHopDongOk(hopDongXacDinh(nhanVien.id, { ngayBatDau: ngay(1), ngayKetThuc: ngay(100) }));
  });

  test('hợp đồng DA_CHAM_DUT với ngày chấm dứt tương lai vẫn chặn chồng lấn đến ngày chấm dứt', async () => {
    const { nhanVien } = await taoNhanVien();
    const hd = await taoHopDongOk(hopDongXacDinh(nhanVien.id, { ngayKetThuc: ngay(200) }));
    const cd = await goi('post', `/${hd.id}/chamDut`, token.hr).send({ ngayChamDut: ngay(60), lyDo: 'Thôi việc' });
    expect(cd.status).toBe(200);
    expect((await layHopDongDb(hd.id)).trangThai).toBe('DA_CHAM_DUT');
    const trung = await taoHopDong(hopDongXacDinh(nhanVien.id, { ngayBatDau: ngay(1), ngayKetThuc: ngay(100) }));
    expect(trung.status).toBe(409);
    expect(trung.body).toMatchObject({ success: false, code: 409, data: null });
    expect(trung.body.message).toContain(hd.maHopDong);
    const ok = await taoHopDong(hopDongXacDinh(nhanVien.id, { ngayBatDau: ngay(61), ngayKetThuc: ngay(300) }));
    expect(ok.status).toBe(201);
  });

  test('song song: hai HR lập hợp đồng chồng lấn cho cùng một người, chỉ một thành công', async () => {
    const hr2 = await taoHrThuHai();
    const { nhanVien } = await taoNhanVien();
    const [r1, r2] = await Promise.all([
      taoHopDong(hopDongXacDinh(nhanVien.id), token.hr),
      taoHopDong(hopDongXacDinh(nhanVien.id, { ngayBatDau: ngay(10) }), hr2.tk),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
    const [d] = await pool.execute('SELECT COUNT(*) AS n FROM hopdonglaodong WHERE nhanVienId = ?', [nhanVien.id]);
    expect(Number(d[0].n)).toBe(1);
    const nguoiTao = r1.status === 201 ? 4 : hr2.nhanVien.id;
    const id = (r1.status === 201 ? r1 : r2).body.data.id;
    expect((await layLichSuDb(id))[0].nguoiThucHienId).toBe(nguoiTao);
  });

  test('song song: hai HR lập cho hai người khác nhau cùng năm, mã không trùng', async () => {
    const hr2 = await taoHrThuHai();
    const a = (await taoNhanVien()).nhanVien;
    const b = (await taoNhanVien()).nhanVien;
    const [r1, r2] = await Promise.all([taoHopDong(hopDongXacDinh(a.id), token.hr), taoHopDong(hopDongXacDinh(b.id), hr2.tk)]);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect(r1.body.data.maHopDong).not.toBe(r2.body.data.maHopDong);
  });

  test('HR thứ hai không tự lập hợp đồng cho chính mình (403)', async () => {
    const hr2 = await taoHrThuHai();
    const res = await taoHopDong(hopDongXacDinh(hr2.nhanVien.id), hr2.tk);
    expect(res.status).toBe(403);
  });

  test('rollback: lỗi khi ghi lịch sử thì không còn hợp đồng và nhật ký', async () => {
    const { nhanVien } = await taoNhanVien();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(hopDongRepository, 'themLichSu').mockRejectedValueOnce(new Error('Lỗi giả lập'));
    const res = await taoHopDong(hopDongXacDinh(nhanVien.id));
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false, code: 500, data: null });
    const [d] = await pool.execute('SELECT COUNT(*) AS n FROM hopdonglaodong WHERE nhanVienId = ?', [nhanVien.id]);
    expect(Number(d[0].n)).toBe(0);
    expect(await layNhatKy('THEM_HOP_DONG')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe('POST /:id/giaHan', () => {
  test('gia hạn XĐTH thành công: lịch sử GIA_HAN, nhật ký GIA_HAN_HOP_DONG', async () => {
    const { nhanVien } = await taoNhanVien();
    const hd = await taoHopDongOk(hopDongXacDinh(nhanVien.id));
    const res = await goi('post', `/${hd.id}/giaHan`, token.hr).send({ ngayKetThucMoi: ngay(700), lyDo: 'Gia hạn' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200, data: { ngayKetThuc: ngay(700), trangThai: 'HIEU_LUC' } });
    expect(res.body.data.lichSu[0]).toMatchObject({
      hanhDong: 'GIA_HAN',
      ngayKetThucCu: ngay(364),
      ngayKetThucMoi: ngay(700),
      trangThaiCu: 'HIEU_LUC',
      nguoiThucHienId: 4,
    });
    expect(await layNhatKy('GIA_HAN_HOP_DONG')).toHaveLength(1);
  });

  test.each([
    ['ngày mới bằng ngày cũ', 0, 400],
    ['ngày mới trước ngày cũ', -10, 400],
  ])('%s trả %i', async (_t, lech, ma) => {
    const { nhanVien } = await taoNhanVien();
    const hd = await taoHopDongOk(hopDongXacDinh(nhanVien.id));
    const res = await goi('post', `/${hd.id}/giaHan`, token.hr).send({ ngayKetThucMoi: congNgay(ngay(364), lech) });
    expect(res.status).toBe(ma);
  });

  test('gia hạn vượt 36 tháng 400, thiếu/sai ngày 400, không tồn tại 404', async () => {
    const { nhanVien } = await taoNhanVien();
    const hd = await taoHopDongOk(hopDongXacDinh(nhanVien.id));
    expect((await goi('post', `/${hd.id}/giaHan`, token.hr).send({ ngayKetThucMoi: congThang(ngay(0), 36) })).status).toBe(400);
    expect((await goi('post', `/${hd.id}/giaHan`, token.hr).send({})).status).toBe(400);
    expect((await goi('post', `/${hd.id}/giaHan`, token.hr).send({ ngayKetThucMoi: 'abc' })).status).toBe(400);
    expect((await goi('post', '/99999/giaHan', token.hr).send({ ngayKetThucMoi: ngay(700) })).status).toBe(404);
    expect((await layHopDongDb(hd.id)).ngayKetThuc).toBe(ngay(364));
  });

  test('thử việc, KXĐ, đã chấm dứt, đã hết hạn đều không gia hạn được (409)', async () => {
    expect((await goi('post', '/7/giaHan', token.hr).send({ ngayKetThucMoi: ngay(90) })).status).toBe(409);
    expect((await goi('post', '/1/giaHan', token.hr).send({ ngayKetThucMoi: '2099-01-01' })).status).toBe(409);
    expect((await goi('post', '/2/giaHan', token.hr).send({ ngayKetThucMoi: '2022-01-01' })).status).toBe(409);
    const { nhanVien } = await taoNhanVien();
    const hetHan = await taoHopDongOk(hopDongXacDinh(nhanVien.id, { ngayBatDau: NGAY_VAO_LAM, ngayKetThuc: ngay(-1) }));
    expect((await goi('post', `/${hetHan.id}/giaHan`, token.hr).send({ ngayKetThucMoi: ngay(100) })).status).toBe(409);
  });

  test('gia hạn chồng lên hợp đồng kế tiếp trả 409', async () => {
    const { nhanVien } = await taoNhanVien();
    const a = await taoHopDongOk(hopDongXacDinh(nhanVien.id, { ngayKetThuc: ngay(60) }));
    await taoHopDongOk(hopDongXacDinh(nhanVien.id, { ngayBatDau: ngay(120), ngayKetThuc: ngay(300) }));
    const res = await goi('post', `/${a.id}/giaHan`, token.hr).send({ ngayKetThucMoi: ngay(150) });
    expect(res.status).toBe(409);
    expect((await layHopDongDb(a.id)).ngayKetThuc).toBe(ngay(60));
  });

  test('rollback: lỗi ghi lịch sử thì ngày kết thúc giữ nguyên', async () => {
    const { nhanVien } = await taoNhanVien();
    const hd = await taoHopDongOk(hopDongXacDinh(nhanVien.id));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(hopDongRepository, 'themLichSu').mockRejectedValueOnce(new Error('Lỗi giả lập'));
    const res = await goi('post', `/${hd.id}/giaHan`, token.hr).send({ ngayKetThucMoi: ngay(700) });
    expect(res.status).toBe(500);
    expect((await layHopDongDb(hd.id)).ngayKetThuc).toBe(ngay(364));
    expect(await layLichSuDb(hd.id)).toHaveLength(1);
    expect(await layNhatKy('GIA_HAN_HOP_DONG')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe('POST /:id/dieuChinh', () => {
  test('điều chỉnh lương, phụ cấp, file: lịch sử DIEU_CHINH cũ/mới, nhật ký', async () => {
    const res = await goi('post', '/6/dieuChinh', token.hr).send({
      luongCoBan: '14000000',
      mucPhuCap: 900000,
      duongDanFileHopDong: '/f/pl1.pdf',
      lyDo: 'Phụ lục 1',
    });
    expect(res.status).toBe(200);
    expect(Number(res.body.data.luongCoBan)).toBe(14000000);
    expect(Number(res.body.data.mucPhuCap)).toBe(900000);
    expect(res.body.data.duongDanFileHopDong).toBe('/f/pl1.pdf');
    const ls = res.body.data.lichSu[0];
    expect(ls).toMatchObject({ hanhDong: 'DIEU_CHINH', lyDoThayDoi: 'Phụ lục 1', trangThaiCu: 'HIEU_LUC', trangThaiMoi: 'HIEU_LUC' });
    expect(Number(ls.luongCoBanCu)).toBe(13000000);
    expect(Number(ls.luongCoBanMoi)).toBe(14000000);
    const nk = await layNhatKy('DIEU_CHINH_HOP_DONG');
    expect(nk).toHaveLength(1);
    expect(nk[0].chiTiet).toContain('HD2024-0001');
    expect(nk[0].chiTiet).not.toMatch(/13000000|14000000|800000|900000/);
  });

  test('chỉ điều chỉnh mức phụ cấp: nhật ký ghi "đã thay đổi", không lộ số tiền', async () => {
    const res = await goi('post', '/6/dieuChinh', token.hr).send({ mucPhuCap: 1234567, lyDo: 'Tăng phụ cấp' });
    expect(res.status).toBe(200);
    const nk = await layNhatKy('DIEU_CHINH_HOP_DONG');
    expect(nk).toHaveLength(1);
    expect(nk[0].chiTiet).toContain('mucPhuCap: đã thay đổi');
    expect(nk[0].chiTiet).not.toMatch(/1234567|800000/);
    expect(nk[0].chiTiet).not.toContain('luongCoBan');
  });

  test.each([
    ['thiếu lý do', { luongCoBan: 1 }],
    ['lý do rỗng', { luongCoBan: 1, lyDo: '' }],
    ['lương 0', { luongCoBan: 0, lyDo: 'x' }],
    ['phụ cấp sai', { mucPhuCap: '1,5', lyDo: 'x' }],
    ['không có gì thay đổi', { luongCoBan: 13000000, mucPhuCap: '800000.00', lyDo: 'x' }],
    ['chỉ có lý do', { lyDo: 'x' }],
  ])('400 khi %s', async (_t, body) => {
    const res = await goi('post', '/6/dieuChinh', token.hr).send(body);
    expect(res.status).toBe(400);
    expect(await layLichSuDb(6)).toHaveLength(3);
  });

  test('hợp đồng đã chấm dứt hoặc hết hạn không điều chỉnh được (409)', async () => {
    expect((await goi('post', '/2/dieuChinh', token.hr).send({ luongCoBan: 1, lyDo: 'x' })).status).toBe(409);
    const { nhanVien } = await taoNhanVien();
    const hetHan = await taoHopDongOk(hopDongXacDinh(nhanVien.id, { ngayBatDau: NGAY_VAO_LAM, ngayKetThuc: ngay(-1) }));
    expect((await goi('post', `/${hetHan.id}/dieuChinh`, token.hr).send({ luongCoBan: 1, lyDo: 'x' })).status).toBe(409);
  });

  test('rollback: lỗi ghi lịch sử thì lương giữ nguyên', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(hopDongRepository, 'themLichSu').mockRejectedValueOnce(new Error('Lỗi giả lập'));
    const res = await goi('post', '/6/dieuChinh', token.hr).send({ luongCoBan: 99000000, lyDo: 'x' });
    expect(res.status).toBe(500);
    expect(Number((await layHopDongDb(6)).luongCoBan)).toBe(13000000);
    expect(await layNhatKy('DIEU_CHINH_HOP_DONG')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe('POST /:id/chamDut', () => {
  test('chấm dứt thành công: ngày kết thúc = ngày chấm dứt, lịch sử CHAM_DUT, nhật ký; lần hai 409', async () => {
    const ketThucCu = (await layHopDongDb(6)).ngayKetThuc;
    const res = await goi('post', '/6/chamDut', token.hr).send({ ngayChamDut: ngay(0), lyDo: ' Nghỉ việc ' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ trangThai: 'DA_CHAM_DUT', ngayKetThuc: ngay(0) });
    expect(res.body.data.lichSu[0]).toMatchObject({
      hanhDong: 'CHAM_DUT',
      trangThaiCu: 'HIEU_LUC',
      trangThaiMoi: 'DA_CHAM_DUT',
      lyDoThayDoi: 'Nghỉ việc',
      ngayKetThucCu: ketThucCu,
      ngayKetThucMoi: ngay(0),
    });
    expect(await layNhatKy('CHAM_DUT_HOP_DONG')).toHaveLength(1);
    const lan2 = await goi('post', '/6/chamDut', token.hr).send({ ngayChamDut: ngay(0), lyDo: 'x' });
    expect(lan2.status).toBe(409);
  });

  test('chấm dứt hợp đồng HET_HAN ghi trangThaiCu = HIEU_LUC (giá trị lưu thật)', async () => {
    const { nhanVien } = await taoNhanVien();
    const hd = await taoHopDongOk(hopDongXacDinh(nhanVien.id, { ngayBatDau: NGAY_VAO_LAM, ngayKetThuc: ngay(-5) }));
    const res = await goi('post', `/${hd.id}/chamDut`, token.hr).send({ ngayChamDut: ngay(-5), lyDo: 'Kết thúc' });
    expect(res.status).toBe(200);
    const ls = await layLichSuDb(hd.id);
    expect(ls[ls.length - 1]).toMatchObject({ hanhDong: 'CHAM_DUT', trangThaiCu: 'HIEU_LUC', trangThaiMoi: 'DA_CHAM_DUT' });
  });

  test.each([
    ['trước ngày bắt đầu', { ngayChamDut: '2024-06-02', lyDo: 'x' }],
    ['sau ngày kết thúc', null],
    ['thiếu lý do', { ngayChamDut: ngay(0) }],
    ['ngày sai', { ngayChamDut: '2026-02-30', lyDo: 'x' }],
  ])('400 khi %s', async (_t, body) => {
    // "sau ngày kết thúc" tính từ ngày kết thúc thật trong CSDL (seed theo CURDATE())
    const ketThuc = (await layHopDongDb(6)).ngayKetThuc;
    const duLieu = body || { ngayChamDut: congNgay(ketThuc, 1), lyDo: 'x' };
    const res = await goi('post', '/6/chamDut', token.hr).send(duLieu);
    expect(res.status).toBe(400);
    expect((await layHopDongDb(6)).trangThai).toBe('HIEU_LUC');
  });

  test('biên hợp lệ: chấm dứt đúng ngày bắt đầu', async () => {
    const res = await goi('post', '/6/chamDut', token.hr).send({ ngayChamDut: '2024-06-03', lyDo: 'x' });
    expect(res.status).toBe(200);
  });

  test('rollback: lỗi ghi lịch sử thì trạng thái giữ nguyên', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(hopDongRepository, 'themLichSu').mockRejectedValueOnce(new Error('Lỗi giả lập'));
    const truoc = await layHopDongDb(7);
    const res = await goi('post', '/7/chamDut', token.hr).send({ ngayChamDut: ngay(-1), lyDo: 'x' });
    expect(res.status).toBe(500);
    const hd = await layHopDongDb(7);
    expect(hd).toMatchObject({ trangThai: 'HIEU_LUC', ngayKetThuc: truoc.ngayKetThuc });
    expect(await layNhatKy('CHAM_DUT_HOP_DONG')).toHaveLength(0);
  });
});
