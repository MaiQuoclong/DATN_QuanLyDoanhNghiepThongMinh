const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const nghiPhepRepository = require('../src/repositories/nghiPhepRepository');
const nghiPhepService = require('../src/services/nghiPhepService');
const LoiUngDung = require('../src/utils/LoiUngDung');

const { xacDinhNguoiDuyet } = nghiPhepService;
const { tinhSoNgayNghi, layNgayLamViec, layCacThang } = require('../src/utils/tinhNgayNghi');

// Dữ liệu mẫu (database/seed.sql): PB1 BGD (trưởng NV0002 giamDoc, không có vai trò quanLy), PB2 PNS (không trưởng),
// PB3 PKT (trưởng NV0003 quanly), PB4 PKT-PT con của PB3 (không trưởng), PB5 PKD (trưởng NV0009 quanly2).
// cdpb 5 = Lập trình viên / PKT-PT, cdpb 8 = NV kinh doanh / PKD.
// Loại seed: 1 PHEP_NAM (trừ quỹ, tối đa 12), 2 OM_DAU (không trừ quỹ, 30), 3 KET_HON (tối đa 3).
// Test dùng năm 2021 cố định (không phụ thuộc CURDATE()), tự tạo quỹ cho năm đó.
const MAT_KHAU = 'MatKhau@123';
const HASH_MAT_KHAU = '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm';
const NGAY_VAO_LAM = '2020-01-06';
const NAM = 2021;
const LOAI_PHEP_NAM = 1;
const LOAI_OM = 2;
const LOAI_KET_HON = 3;

const token = {};
let anhChup;
let mocNhatKy;
let demTen = 0;

const homNay = () => new Date().toLocaleDateString('sv-SE');
const namHienTai = () => Number(homNay().slice(0, 4));
function congNgay(soNgay) {
  const d = new Date();
  d.setDate(d.getDate() + soNgay);
  return d.toLocaleDateString('sv-SE');
}

function dangNhap(tenDangNhap, matKhau = MAT_KHAU) {
  return request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap, matKhau });
}
const goi = (phuongThuc, duongDan, tk) => {
  const r = request(app)[phuongThuc](`/api/v1${duongDan}`);
  return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
};

async function taoNhanVien(ghiDe = {}) {
  demTen += 1;
  const ten = `qanp${Date.now() % 100000}${demTen}`;
  const res = await goi('post', '/nhanVien', token.hr).send({
    hoVaTen: 'Lê Nghỉ Phép', gioiTinh: 'NAM', ngaySinh: '1995-05-20', ngayVaoLam: NGAY_VAO_LAM,
    chucDanhPhongBanId: 5, tenDangNhap: ten, email: `${ten}@smarthrm.local`, ...ghiDe,
  });
  expect(res.status).toBe(201);
  const { nhanVien, taiKhoan } = res.body.data;
  const dn = await dangNhap(taiKhoan.tenDangNhap, taiKhoan.matKhauTam);
  expect(dn.status).toBe(200);
  const doi = await goi('post', '/xacThuc/doiMatKhau', dn.body.data.token)
    .send({ matKhauCu: taiKhoan.matKhauTam, matKhauMoi: 'NghiPhep123' });
  expect(doi.status).toBe(200);
  const dn2 = await dangNhap(taiKhoan.tenDangNhap, 'NghiPhep123');
  expect(dn2.status).toBe(200);
  return { nhanVien, tk: dn2.body.data.token };
}

async function capQuy(nhanVienId, tong = 12, daNghi = 0, nam = NAM) {
  const [kq] = await pool.execute(
    'INSERT INTO quyngayphep (nhanVienId, namHieuLuc, tongSoNgayPhep, soNgayDaNghi) VALUES (?, ?, ?, ?)',
    [nhanVienId, nam, tong, daNghi]
  );
  return kq.insertId;
}
async function layQuy(id) {
  const [[d]] = await pool.execute('SELECT tongSoNgayPhep, soNgayDaNghi FROM quyngayphep WHERE id = ?', [id]);
  return { tong: Number(d.tongSoNgayPhep), daNghi: Number(d.soNgayDaNghi) };
}
async function layTrangThaiDon(id) {
  const [[d]] = await pool.execute('SELECT trangThai, nguoiDuyetId FROM dondexuatnghiphep WHERE id = ?', [id]);
  return d;
}

const taoDon = (tk, body = {}) => goi('post', '/donNghiPhep', tk).send({
  loaiNghiPhepId: LOAI_PHEP_NAM, ngayBatDau: '2021-03-01', ngayKetThuc: '2021-03-02', lyDo: 'Giải quyết việc gia đình', ...body,
});
async function taoDonOk(tk, body) {
  const res = await taoDon(tk, body);
  expect(res.status).toBe(201);
  return res.body.data;
}
async function chenChot(thang) {
  await pool.execute("INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, chiTiet) VALUES (4, 'CHOT_CONG_THANG', ?)", [thang]);
}
async function layNhatKy(hanhDong) {
  const [d] = await pool.execute('SELECT nguoiDungId, chiTiet FROM nhatkyhethong WHERE id > ? AND hanhDong = ? ORDER BY id',
    [mocNhatKy, hanhDong]);
  return d;
}
async function taoLoai(ghiDe = {}) {
  demTen += 1;
  const l = {
    maLoai: `QA_${Date.now() % 100000}_${demTen}`, tenLoai: 'Loại thử', soNgayToiDa: null, coLuong: 1, truVaoQuyPhepNam: 0,
    trangThai: 'DANG_AP_DUNG', ...ghiDe,
  };
  const [kq] = await pool.execute(
    'INSERT INTO loainghiphep (maLoai, tenLoai, soNgayToiDa, coLuong, truVaoQuyPhepNam, trangThai) VALUES (?, ?, ?, ?, ?, ?)',
    [l.maLoai, l.tenLoai, l.soNgayToiDa, l.coLuong, l.truVaoQuyPhepNam, l.trangThai]
  );
  return kq.insertId;
}

const BANG_DAT_LAI = ['dondexuatnghiphep', 'quyngayphep', 'loainghiphep', 'nhanvien', 'nguoidung', 'nhatkyhethong'];
async function datLaiAutoIncrement() {
  for (const bang of BANG_DAT_LAI) await pool.query(`ALTER TABLE ${bang} AUTO_INCREMENT = 1`);
}

beforeAll(async () => {
  const lay = async (bang) => (await pool.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${bang}`))[0][0].m;
  anhChup = {
    maxDon: await lay('dondexuatnghiphep'),
    maxQuy: await lay('quyngayphep'),
    maxLoai: await lay('loainghiphep'),
    maxNv: await lay('nhanvien'),
    maxNd: await lay('nguoidung'),
    maxNk: await lay('nhatkyhethong'),
    loai: (await pool.query('SELECT * FROM loainghiphep'))[0],
    quy: (await pool.query('SELECT id, tongSoNgayPhep, soNgayDaNghi FROM quyngayphep'))[0],
    nvSeed: (await pool.query('SELECT id, trangThaiLamViec FROM nhanvien WHERE id <= 20'))[0],
    ndSeed: (await pool.query('SELECT id, trangThai FROM nguoidung WHERE id <= 20'))[0],
  };
  for (const ten of ['admin', 'giamdoc', 'giamdoc2', 'quanly', 'quanly2', 'hr', 'hr2', 'nhanvien']) {
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
  jest.restoreAllMocks();
  await pool.execute('DELETE FROM dondexuatnghiphep WHERE id > ?', [anhChup.maxDon]);
  await pool.execute('DELETE FROM quyngayphep WHERE id > ?', [anhChup.maxQuy]);
  await pool.execute('DELETE FROM loainghiphep WHERE id > ?', [anhChup.maxLoai]);
  for (const l of anhChup.loai) {
    await pool.execute(
      'UPDATE loainghiphep SET tenLoai = ?, soNgayToiDa = ?, coLuong = ?, truVaoQuyPhepNam = ?, moTa = ?, trangThai = ? WHERE id = ?',
      [l.tenLoai, l.soNgayToiDa, l.coLuong, l.truVaoQuyPhepNam, l.moTa, l.trangThai, l.id]
    );
  }
  for (const q of anhChup.quy) {
    await pool.execute('UPDATE quyngayphep SET tongSoNgayPhep = ?, soNgayDaNghi = ? WHERE id = ?', [q.tongSoNgayPhep, q.soNgayDaNghi, q.id]);
  }
  // Khôi phục trạng thái làm việc / tài khoản của nhân sự seed (test tự duyệt chuyển giamdoc2 sang TAM_NGHI)
  for (const nv of anhChup.nvSeed) {
    await pool.execute('UPDATE nhanvien SET trangThaiLamViec = ? WHERE id = ?', [nv.trangThaiLamViec, nv.id]);
  }
  for (const nd of anhChup.ndSeed) {
    await pool.execute('UPDATE nguoidung SET trangThai = ? WHERE id = ?', [nd.trangThai, nd.id]);
  }
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKy]);
  await pool.execute('DELETE FROM nhanvien WHERE id > ?', [anhChup.maxNv]);
  await pool.execute('DELETE FROM nguoidungvaitro WHERE nguoiDungId > ?', [anhChup.maxNd]);
  await pool.execute('DELETE FROM nguoidung WHERE id > ?', [anhChup.maxNd]);
  await datLaiAutoIncrement();
});

afterAll(async () => {
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [anhChup.maxNk]);
  await datLaiAutoIncrement();
  await pool.end();
});

// ---------------------------------------------------------------------------
describe('Unit tinhNgayNghi', () => {
  test('tinhSoNgayNghi bỏ thứ 7, Chủ nhật', () => {
    expect(tinhSoNgayNghi('2021-03-05', '2021-03-08')).toBe(2); // T6 -> T2
    expect(tinhSoNgayNghi('2021-03-01', '2021-03-12')).toBe(10);
    expect(tinhSoNgayNghi('2021-03-06', '2021-03-07')).toBe(0);
  });
  test('nửa ngày chỉ tính 0.5 khi đơn gói trong 1 ngày làm việc', () => {
    expect(tinhSoNgayNghi('2021-03-01', '2021-03-01', true)).toBe(0.5);
    expect(tinhSoNgayNghi('2021-03-01', '2021-03-02', true)).toBe(2);
    expect(tinhSoNgayNghi('2021-03-06', '2021-03-06', true)).toBe(0);
  });
  test('layNgayLamViec trả danh sách ngày T2-T6', () => {
    expect(layNgayLamViec('2021-03-05', '2021-03-09')).toEqual(['2021-03-05', '2021-03-08', '2021-03-09']);
  });
  test('layCacThang đi qua nhiều tháng và qua năm', () => {
    expect(layCacThang('2021-03-01', '2021-03-31')).toEqual(['2021-03']);
    expect(layCacThang('2021-11-20', '2022-02-03')).toEqual(['2021-11', '2021-12', '2022-01', '2022-02']);
  });
});

describe('Unit xacDinhNguoiDuyet', () => {
  const pb = (ghiDe) => ({
    phongBanChaId: null, trangThai: 'DANG_HOAT_DONG', truongBoPhanId: null, maTruong: null, tenTruong: null,
    trangThaiTruong: null, truongCoQuanLy: false, ...ghiDe,
  });
  const truong = (id) => ({ truongBoPhanId: id, maTruong: `NV${id}`, tenTruong: `Trưởng ${id}`, trangThaiTruong: 'CHINH_THUC', truongCoQuanLy: true });
  const cayCoBan = () => [
    pb({ id: 1, ...truong(100), truongCoQuanLy: false }), // BGD: trưởng là giám đốc, không có vai trò quanLy
    pb({ id: 2, phongBanChaId: 1, ...truong(200) }),
    pb({ id: 3, phongBanChaId: 2 }), // không trưởng
  ];

  test('trưởng bộ phận phòng của người gửi duyệt', () => {
    expect(xacDinhNguoiDuyet({ nhanVienId: 5, phongBanId: 2, soNgayNghi: 2 }, cayCoBan()))
      .toMatchObject({ loai: 'TRUONG_BO_PHAN', nhanVienId: 200, phongBanId: 2 });
  });
  test('phòng không có trưởng thì đi lên phòng cha', () => {
    expect(xacDinhNguoiDuyet({ nhanVienId: 5, phongBanId: 3, soNgayNghi: 1 }, cayCoBan()))
      .toMatchObject({ loai: 'TRUONG_BO_PHAN', nhanVienId: 200 });
  });
  test('người gửi là trưởng thì đi lên cha, cha không có quanLy -> GIAM_DOC', () => {
    expect(xacDinhNguoiDuyet({ nhanVienId: 200, phongBanId: 2, soNgayNghi: 1 }, cayCoBan()))
      .toEqual({ loai: 'GIAM_DOC', lyDo: 'CAP_CAO_NHAT' });
  });
  test('trưởng không có vai trò quanLy hoặc TAM_NGHI/DA_NGHI_VIEC thì lên cha', () => {
    const cay = [pb({ id: 1, ...truong(100) }), pb({ id: 2, phongBanChaId: 1, ...truong(200), truongCoQuanLy: false })];
    expect(xacDinhNguoiDuyet({ nhanVienId: 5, phongBanId: 2, soNgayNghi: 1 }, cay)).toMatchObject({ nhanVienId: 100 });
    for (const tt of ['TAM_NGHI', 'DA_NGHI_VIEC']) {
      const cay2 = [pb({ id: 1, ...truong(100) }), pb({ id: 2, phongBanChaId: 1, ...truong(200), trangThaiTruong: tt })];
      expect(xacDinhNguoiDuyet({ nhanVienId: 5, phongBanId: 2, soNgayNghi: 1 }, cay2)).toMatchObject({ nhanVienId: 100 });
    }
  });
  test('phòng ngừng hoạt động thì lên cha', () => {
    const cay = [pb({ id: 1, ...truong(100) }), pb({ id: 2, phongBanChaId: 1, ...truong(200), trangThai: 'NGUNG_HOAT_DONG' })];
    expect(xacDinhNguoiDuyet({ nhanVienId: 5, phongBanId: 2, soNgayNghi: 1 }, cay)).toMatchObject({ nhanVienId: 100 });
  });
  test('đơn dài hơn 5 ngày chuyển GIAM_DOC, đúng 5 ngày vẫn trưởng bộ phận', () => {
    expect(xacDinhNguoiDuyet({ nhanVienId: 5, phongBanId: 2, soNgayNghi: 5.5 }, cayCoBan()))
      .toEqual({ loai: 'GIAM_DOC', lyDo: 'DON_DAI_NGAY' });
    expect(xacDinhNguoiDuyet({ nhanVienId: 5, phongBanId: 2, soNgayNghi: 5 }, cayCoBan())).toMatchObject({ nhanVienId: 200 });
  });
  test('hết cây hoặc phòng không tồn tại, cây có vòng lặp -> GIAM_DOC', () => {
    expect(xacDinhNguoiDuyet({ nhanVienId: 5, phongBanId: 99, soNgayNghi: 1 }, cayCoBan())).toMatchObject({ loai: 'GIAM_DOC' });
    const vong = [pb({ id: 1, phongBanChaId: 2 }), pb({ id: 2, phongBanChaId: 1 })];
    expect(xacDinhNguoiDuyet({ nhanVienId: 5, phongBanId: 1, soNgayNghi: 1 }, vong)).toEqual({ loai: 'GIAM_DOC', lyDo: 'CAP_CAO_NHAT' });
  });
});

// ---------------------------------------------------------------------------
describe('Xác thực và phân quyền route', () => {
  const ROUTE = [
    ['get', '/loaiNghiPhep'], ['post', '/loaiNghiPhep'], ['patch', '/loaiNghiPhep/1'],
    ['get', '/quyPhep/cuaToi'], ['get', '/quyPhep'], ['post', '/quyPhep/capNam'], ['patch', '/quyPhep/1'],
    ['get', '/donNghiPhep'], ['get', '/donNghiPhep/cuaToi'], ['get', '/donNghiPhep/lich'], ['post', '/donNghiPhep'],
    ['post', '/donNghiPhep/1/huy'], ['post', '/donNghiPhep/1/duyet'], ['post', '/donNghiPhep/1/tuChoi'],
  ];
  test('chưa đăng nhập -> 401 cho mọi route', async () => {
    for (const [pt, dd] of ROUTE) {
      const res = await goi(pt, dd);
      expect([pt, dd, res.status]).toEqual([pt, dd, 401]);
      expect(res.body).toMatchObject({ success: false, code: 401, data: null });
    }
  });
  test('route chỉ HR: các vai trò khác -> 403', async () => {
    for (const ten of ['admin', 'giamdoc', 'quanly', 'nhanvien']) {
      for (const [pt, dd] of [['post', '/loaiNghiPhep'], ['patch', '/loaiNghiPhep/1'], ['post', '/quyPhep/capNam'], ['patch', '/quyPhep/1']]) {
        const res = await goi(pt, dd, token[ten]).send({});
        expect([ten, dd, res.status]).toEqual([ten, dd, 403]);
      }
    }
  });
  test('route xem (HR/giamDoc/quanLy): admin, nhanvien -> 403', async () => {
    for (const ten of ['admin', 'nhanvien']) {
      for (const dd of ['/quyPhep', '/donNghiPhep', '/donNghiPhep/lich']) {
        expect((await goi('get', dd, token[ten])).status).toBe(403);
      }
    }
  });
  test('route duyệt/từ chối: HR, admin, nhanvien -> 403', async () => {
    for (const ten of ['hr', 'admin', 'nhanvien']) {
      expect((await goi('post', '/donNghiPhep/1/duyet', token[ten])).status).toBe(403);
      expect((await goi('post', '/donNghiPhep/1/tuChoi', token[ten]).send({ lyDoTuChoi: 'abc' })).status).toBe(403);
    }
  });
  test('route mọi vai trò: nhanvien xem loại, quỹ và đơn của mình -> 200', async () => {
    for (const dd of ['/loaiNghiPhep', '/quyPhep/cuaToi', '/donNghiPhep/cuaToi']) {
      const res = await goi('get', dd, token.nhanvien);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, code: 200 });
    }
  });
  test('tài khoản không có hồ sơ nhân viên -> 403 khi dùng chức năng nghỉ phép', async () => {
    const ten = `qanohs${Date.now() % 100000}`;
    const [kq] = await pool.execute('INSERT INTO nguoidung (tenDangNhap, email, matKhauMaHoa) VALUES (?, ?, ?)',
      [ten, `${ten}@smarthrm.local`, HASH_MAT_KHAU]);
    await pool.execute('INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES (?, 5)', [kq.insertId]);
    const dn = await dangNhap(ten);
    expect(dn.status).toBe(200);
    const tk = dn.body.data.token;
    expect((await goi('get', '/quyPhep/cuaToi', tk)).status).toBe(403);
    expect((await goi('get', '/donNghiPhep/cuaToi', tk)).status).toBe(403);
    expect((await taoDon(tk, { loaiNghiPhepId: LOAI_OM })).status).toBe(403);
    expect((await goi('post', '/donNghiPhep/1/huy', tk)).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
describe('Tạo đơn nghỉ phép', () => {
  test('tạo đơn thành công: 201, mã DNP2021-xxxx, CHO_DUYET, người duyệt dự kiến là trưởng PKT', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 12);
    const res = await taoDon(tk);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, code: 201 });
    const d = res.body.data;
    expect(d.maDon).toMatch(/^DNP2021-\d{4}$/);
    expect(d).toMatchObject({
      trangThai: 'CHO_DUYET', soNgayNghi: 2, phuongThucTao: 'FORM_GIAO_DIEN', duocDuyet: false,
      nguoiDuyetDuKien: { loai: 'TRUONG_BO_PHAN', nhanVienId: 3 },
    });
    const d2 = await taoDonOk(tk, { ngayBatDau: '2021-03-03', ngayKetThuc: '2021-03-03' });
    expect(Number(d2.maDon.slice(8))).toBe(Number(d.maDon.slice(8)) + 1);
  });
  test('nghỉ nửa ngày tính 0.5', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 12);
    const d = await taoDonOk(tk, { ngayBatDau: '2021-03-01', ngayKetThuc: '2021-03-01', nuaNgay: true });
    expect(d.soNgayNghi).toBe(0.5);
  });
  test('dữ liệu sai -> 400', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 12);
    const truongHop = [
      { ngayBatDau: '2021-03-05', ngayKetThuc: '2021-03-01' }, // ngày ngược
      { ngayBatDau: '2021-12-30', ngayKetThuc: '2022-01-03' }, // vắt năm
      { ngayBatDau: '2021-03-06', ngayKetThuc: '2021-03-07' }, // chỉ T7/CN
      { ngayBatDau: '2021-03-01', ngayKetThuc: '2021-03-02', nuaNgay: true }, // nửa ngày nhiều ngày
      { ngayBatDau: congNgay(400), ngayKetThuc: congNgay(400) }, // quá 365 ngày tới
      { ngayBatDau: '2019-12-30', ngayKetThuc: '2019-12-31', loaiNghiPhepId: LOAI_OM }, // trước ngày vào làm
      { ngayBatDau: '2021-03-01', ngayKetThuc: '2021-03-04', loaiNghiPhepId: LOAI_KET_HON }, // vượt soNgayToiDa 3
      { loaiNghiPhepId: 99999 }, // loại không tồn tại
      { nuaNgay: 'true' }, // không phải boolean
      { ngayBatDau: '2021-13-01' },
      { lyDo: 'abc' },
      { loaiNghiPhepId: 'x' },
    ];
    for (const body of truongHop) {
      const res = await taoDon(tk, body);
      expect([body, res.status]).toEqual([body, 400]);
      expect(res.body).toMatchObject({ success: false, code: 400, data: null });
    }
    const [[dem]] = await pool.execute('SELECT COUNT(*) AS n FROM dondexuatnghiphep WHERE nhanVienId = ?', [nhanVien.id]);
    expect(Number(dem.n)).toBe(0);
  });
  test('chồng lấn với đơn chờ duyệt/đã duyệt -> 409; đơn đã hủy thì không chặn', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 12);
    const d = await taoDonOk(tk);
    expect((await taoDon(tk, { ngayBatDau: '2021-03-02', ngayKetThuc: '2021-03-03' })).status).toBe(409);
    expect((await goi('post', `/donNghiPhep/${d.id}/huy`, tk)).status).toBe(200);
    expect((await taoDon(tk, { ngayBatDau: '2021-03-02', ngayKetThuc: '2021-03-03' })).status).toBe(201);
  });
  test('vượt quỹ có tính đơn đang chờ duyệt -> 409', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 3, 0);
    await taoDonOk(tk); // 2 ngày chờ duyệt
    const res = await taoDon(tk, { ngayBatDau: '2021-03-08', ngayKetThuc: '2021-03-09' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/chờ duyệt/);
    expect((await taoDon(tk, { ngayBatDau: '2021-03-08', ngayKetThuc: '2021-03-08' })).status).toBe(201);
    // loại không trừ quỹ không bị giới hạn bởi quỹ
    expect((await taoDon(tk, { loaiNghiPhepId: LOAI_OM, ngayBatDau: '2021-03-15', ngayKetThuc: '2021-03-19' })).status).toBe(201);
  });
  test('chưa được cấp quỹ năm -> 409 với loại trừ quỹ, loại khác vẫn tạo được', async () => {
    const { tk } = await taoNhanVien();
    expect((await taoDon(tk)).status).toBe(409);
    expect((await taoDon(tk, { loaiNghiPhepId: LOAI_OM })).status).toBe(201);
  });
  test('loại ngừng áp dụng -> 409', async () => {
    const { tk } = await taoNhanVien();
    const id = await taoLoai({ trangThai: 'NGUNG_AP_DUNG' });
    expect((await taoDon(tk, { loaiNghiPhepId: id })).status).toBe(409);
  });
  test('tháng đã chốt công (kể cả tháng thứ hai của đơn) -> 409', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 12);
    await chenChot('2021-04');
    expect((await taoDon(tk, { ngayBatDau: '2021-04-05', ngayKetThuc: '2021-04-05' })).status).toBe(409);
    expect((await taoDon(tk, { ngayBatDau: '2021-03-31', ngayKetThuc: '2021-04-01' })).status).toBe(409);
  });
  test('nhân viên TAM_NGHI -> 409', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 12);
    await pool.execute("UPDATE nhanvien SET trangThaiLamViec = 'TAM_NGHI' WHERE id = ?", [nhanVien.id]);
    expect((await taoDon(tk)).status).toBe(409);
  });
  test('gọi thẳng service taoDon (AI_CHAT): dữ liệu sai -> LoiUngDung 400, không phải TypeError; đúng -> phuongThucTao AI_CHAT', async () => {
    const { nhanVien } = await taoNhanVien();
    const [[nv]] = await pool.execute('SELECT nguoiDungId FROM nhanvien WHERE id = ?', [nhanVien.id]);
    const nguoiDung = { nguoiDungId: nv.nguoiDungId, nhanVienId: nhanVien.id, vaiTro: ['nhanVien'] };
    const hopLe = { loaiNghiPhepId: LOAI_OM, ngayBatDau: '2021-03-01', ngayKetThuc: '2021-03-02', lyDo: 'Ốm cần nghỉ ngơi' };
    const truongHop = [
      null, undefined, 'chuoi',
      { ...hopLe, loaiNghiPhepId: 'abc' }, { ...hopLe, loaiNghiPhepId: undefined }, { ...hopLe, loaiNghiPhepId: 1.5 },
      { ...hopLe, ngayBatDau: '3/11/2021' }, { ...hopLe, ngayKetThuc: 20210302 }, { ...hopLe, ngayBatDau: undefined },
      { ...hopLe, lyDo: 'abc' }, { ...hopLe, lyDo: undefined }, { ...hopLe, lyDo: '    ' }, { ...hopLe, lyDo: 12345 },
    ];
    for (const body of truongHop) {
      let loi;
      try { await nghiPhepService.taoDon(nguoiDung, body, 'AI_CHAT'); } catch (e) { loi = e; }
      expect(loi).toBeInstanceOf(LoiUngDung);
      expect([body, loi.code]).toEqual([body, 400]);
    }
    const d = await nghiPhepService.taoDon(nguoiDung, hopLe, 'AI_CHAT');
    expect(d).toMatchObject({ trangThai: 'CHO_DUYET', phuongThucTao: 'AI_CHAT', soNgayNghi: 2 });
    const [[db]] = await pool.execute('SELECT phuongThucTao FROM dondexuatnghiphep WHERE id = ?', [d.id]);
    expect(db.phuongThucTao).toBe('AI_CHAT');
  });
  test('song song: 2 đơn cùng lúc vượt quỹ chỉ 1 thành công', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 2);
    const kq = await Promise.all([
      taoDon(tk, { ngayBatDau: '2021-03-01', ngayKetThuc: '2021-03-02' }),
      taoDon(tk, { ngayBatDau: '2021-03-08', ngayKetThuc: '2021-03-09' }),
    ]);
    expect(kq.map((r) => r.status).sort()).toEqual([201, 409]);
  });
});

// ---------------------------------------------------------------------------
describe('Hủy đơn', () => {
  test('chủ đơn hủy được, ghi nhật ký HUY_DON_NGHI_PHEP; hủy lại -> 409', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 12);
    const d = await taoDonOk(tk);
    const res = await goi('post', `/donNghiPhep/${d.id}/huy`, tk);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ trangThai: 'DA_HUY', duocDuyet: false, nguoiDuyetDuKien: null });
    expect(await layNhatKy('HUY_DON_NGHI_PHEP')).toHaveLength(1);
    expect((await goi('post', `/donNghiPhep/${d.id}/huy`, tk)).status).toBe(409);
  });
  test('hủy đơn của người khác -> 404, đơn không đổi', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 12);
    const d = await taoDonOk(tk);
    expect((await goi('post', `/donNghiPhep/${d.id}/huy`, token.nhanvien)).status).toBe(404);
    expect((await goi('post', `/donNghiPhep/${d.id}/huy`, token.hr)).status).toBe(404);
    expect((await layTrangThaiDon(d.id)).trangThai).toBe('CHO_DUYET');
  });
  test('đơn đã duyệt -> 409', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 12);
    const d = await taoDonOk(tk);
    expect((await goi('post', `/donNghiPhep/${d.id}/duyet`, token.quanly)).status).toBe(200);
    expect((await goi('post', `/donNghiPhep/${d.id}/huy`, tk)).status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
describe('Duyệt / từ chối đơn', () => {
  test('trưởng PKT duyệt đơn nhân viên PKT-PT: cộng soNgayDaNghi, ghi nhật ký, duyệt lại 409', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    const quyId = await capQuy(nhanVien.id, 12, 1);
    const d = await taoDonOk(tk);
    const res = await goi('post', `/donNghiPhep/${d.id}/duyet`, token.quanly);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200, data: { trangThai: 'DA_DUYET', nguoiDuyetId: 3 } });
    expect(await layQuy(quyId)).toEqual({ tong: 12, daNghi: 3 });
    const nk = await layNhatKy('DUYET_DON_NGHI_PHEP');
    expect(nk).toHaveLength(1);
    expect(nk[0].nguoiDungId).toBe(3);
    expect((await goi('post', `/donNghiPhep/${d.id}/duyet`, token.quanly)).status).toBe(409);
    expect((await goi('post', `/donNghiPhep/${d.id}/tuChoi`, token.quanly).send({ lyDoTuChoi: 'Không' })).status).toBe(409);
  });
  test('duyệt loại không trừ quỹ thì không cộng soNgayDaNghi', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    const quyId = await capQuy(nhanVien.id, 12, 0);
    const d = await taoDonOk(tk, { loaiNghiPhepId: LOAI_OM });
    expect((await goi('post', `/donNghiPhep/${d.id}/duyet`, token.quanly)).status).toBe(200);
    expect(await layQuy(quyId)).toEqual({ tong: 12, daNghi: 0 });
  });
  test('quanLy ngoài phạm vi -> 404 (không lộ người duyệt); giamDoc duyệt được mọi đơn', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 12);
    const d = await taoDonOk(tk);
    const r = await goi('post', `/donNghiPhep/${d.id}/duyet`, token.quanly2);
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ success: false, code: 404, data: null });
    expect((await goi('post', `/donNghiPhep/${d.id}/tuChoi`, token.quanly2).send({ lyDoTuChoi: 'Không' })).status).toBe(404);
    expect((await goi('post', `/donNghiPhep/${d.id}/duyet`, token.giamdoc)).status).toBe(200);
  });
  test('đơn dài hơn 5 ngày chuyển giamDoc: quanly -> 403, giamdoc -> 200', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 12);
    const d = await taoDonOk(tk, { ngayBatDau: '2021-03-08', ngayKetThuc: '2021-03-15' });
    expect(d.soNgayNghi).toBe(6);
    expect(d.nguoiDuyetDuKien).toEqual({ loai: 'GIAM_DOC', lyDo: 'DON_DAI_NGAY' });
    expect((await goi('post', `/donNghiPhep/${d.id}/duyet`, token.quanly)).status).toBe(403);
    expect((await goi('post', `/donNghiPhep/${d.id}/duyet`, token.giamdoc)).status).toBe(200);
  });
  test('tự duyệt đơn của mình -> 403 (quanly, giamdoc); đơn của quanly do giamDoc duyệt', async () => {
    // Tiền đề: giamdoc2 (NV0008) đang hoạt động nên giamdoc không được tự duyệt
    expect(await nghiPhepRepository.demGiamDocHoatDongKhac(2)).toBeGreaterThanOrEqual(1);
    const dQl = await taoDonOk(token.quanly, { loaiNghiPhepId: LOAI_OM });
    expect(dQl.nguoiDuyetDuKien).toMatchObject({ loai: 'GIAM_DOC' });
    expect((await goi('post', `/donNghiPhep/${dQl.id}/duyet`, token.quanly)).status).toBe(403);
    const dGd = await taoDonOk(token.giamdoc, { loaiNghiPhepId: LOAI_OM });
    expect((await goi('post', `/donNghiPhep/${dGd.id}/duyet`, token.giamdoc)).status).toBe(403);
    expect((await goi('post', `/donNghiPhep/${dGd.id}/duyet`, token.giamdoc2)).status).toBe(200);
    expect((await goi('post', `/donNghiPhep/${dQl.id}/duyet`, token.giamdoc)).status).toBe(200);
  });
  test.each([
    ['giamdoc2 TAM_NGHI', "UPDATE nhanvien SET trangThaiLamViec = 'TAM_NGHI' WHERE id = 8"],
    ['tài khoản giamdoc2 bị khóa', "UPDATE nguoidung SET trangThai = 'KHOA' WHERE id = 8"],
  ])('giamDoc tự duyệt khi không còn giamDoc khác hoạt động (%s) -> 200, nhật ký ghi "(tự duyệt"', async (_ten, sql) => {
    await pool.execute(sql);
    expect(await nghiPhepRepository.demGiamDocHoatDongKhac(2)).toBe(0);
    const d = await taoDonOk(token.giamdoc, { loaiNghiPhepId: LOAI_OM });
    expect(d.duocDuyet).toBe(true);
    const cua = await goi('get', '/donNghiPhep/cuaToi?thang=2021-03', token.giamdoc);
    expect(cua.status).toBe(200);
    expect(cua.body.data.items.find((x) => x.id === d.id).duocDuyet).toBe(true);
    const res = await goi('post', `/donNghiPhep/${d.id}/duyet`, token.giamdoc);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ trangThai: 'DA_DUYET', nguoiDuyetId: 2 });
    const nk = await layNhatKy('DUYET_DON_NGHI_PHEP');
    expect(nk).toHaveLength(1);
    expect(nk[0].chiTiet).toContain('(tự duyệt');
  });
  test('quanLy trong phạm vi nhưng đơn > 5 ngày (người duyệt là giamDoc) -> 403 cả duyệt và từ chối', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 12);
    const d = await taoDonOk(tk, { ngayBatDau: '2021-03-08', ngayKetThuc: '2021-03-15' });
    const r = await goi('post', `/donNghiPhep/${d.id}/tuChoi`, token.quanly).send({ lyDoTuChoi: 'Không đồng ý' });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ success: false, code: 403, data: null });
    expect((await goi('post', `/donNghiPhep/${d.id}/duyet`, token.quanly)).status).toBe(403);
    expect((await layTrangThaiDon(d.id)).trangThai).toBe('CHO_DUYET');
  });
  test('từ chối: TU_CHOI + lyDoTuChoi, không cộng quỹ, ghi nhật ký; thiếu lý do -> 400', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    const quyId = await capQuy(nhanVien.id, 12);
    const d = await taoDonOk(tk);
    expect((await goi('post', `/donNghiPhep/${d.id}/tuChoi`, token.quanly).send({})).status).toBe(400);
    const res = await goi('post', `/donNghiPhep/${d.id}/tuChoi`, token.quanly).send({ lyDoTuChoi: 'Dự án đang gấp' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ trangThai: 'TU_CHOI', lyDoTuChoi: 'Dự án đang gấp', nguoiDuyetId: 3 });
    expect(await layQuy(quyId)).toEqual({ tong: 12, daNghi: 0 });
    expect(await layNhatKy('TU_CHOI_DON_NGHI_PHEP')).toHaveLength(1);
  });
  test('đơn không tồn tại -> 404, id sai -> 400', async () => {
    expect((await goi('post', '/donNghiPhep/999999/duyet', token.giamdoc)).status).toBe(404);
    expect((await goi('post', '/donNghiPhep/abc/duyet', token.giamdoc)).status).toBe(400);
  });
  test('người gửi DA_NGHI_VIEC: duyệt -> 409, vẫn từ chối được', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 12);
    const d = await taoDonOk(tk);
    await pool.execute("UPDATE nhanvien SET trangThaiLamViec = 'DA_NGHI_VIEC' WHERE id = ?", [nhanVien.id]);
    expect((await goi('post', `/donNghiPhep/${d.id}/duyet`, token.quanly)).status).toBe(409);
    expect((await goi('post', `/donNghiPhep/${d.id}/tuChoi`, token.quanly).send({ lyDoTuChoi: 'Đã nghỉ việc' })).status).toBe(200);
  });
  test('duyệt khi tháng đã chốt -> 409', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await capQuy(nhanVien.id, 12);
    const d = await taoDonOk(tk);
    await chenChot('2021-03');
    expect((await goi('post', `/donNghiPhep/${d.id}/duyet`, token.quanly)).status).toBe(409);
    expect((await layTrangThaiDon(d.id)).trangThai).toBe('CHO_DUYET');
  });
  test('rollback khi lỗi giữa transaction: quỹ không bị cộng, đơn vẫn CHO_DUYET, không có nhật ký', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    const quyId = await capQuy(nhanVien.id, 12);
    const d = await taoDonOk(tk);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(nghiPhepRepository, 'capNhatTrangThaiDon').mockRejectedValueOnce(new Error('Lỗi giả lập'));
    const res = await goi('post', `/donNghiPhep/${d.id}/duyet`, token.quanly);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false, code: 500, data: null });
    expect(await layQuy(quyId)).toEqual({ tong: 12, daNghi: 0 });
    expect((await layTrangThaiDon(d.id)).trangThai).toBe('CHO_DUYET');
    expect(await layNhatKy('DUYET_DON_NGHI_PHEP')).toHaveLength(0);
  });
  test('song song: 2 người duyệt cùng lúc chỉ 1 thành công, quỹ cộng 1 lần', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    const quyId = await capQuy(nhanVien.id, 12);
    const d = await taoDonOk(tk);
    const kq = await Promise.all([
      goi('post', `/donNghiPhep/${d.id}/duyet`, token.quanly),
      goi('post', `/donNghiPhep/${d.id}/duyet`, token.giamdoc),
    ]);
    expect(kq.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await layQuy(quyId)).toEqual({ tong: 12, daNghi: 2 });
    expect(await layNhatKy('DUYET_DON_NGHI_PHEP')).toHaveLength(1);
  });
  test('song song: hủy và duyệt cùng lúc chỉ 1 thành công, quỹ nhất quán', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    const quyId = await capQuy(nhanVien.id, 12);
    const d = await taoDonOk(tk);
    const [huy, duyet] = await Promise.all([
      goi('post', `/donNghiPhep/${d.id}/huy`, tk),
      goi('post', `/donNghiPhep/${d.id}/duyet`, token.quanly),
    ]);
    expect([huy.status, duyet.status].sort()).toEqual([200, 409]);
    const { trangThai } = await layTrangThaiDon(d.id);
    expect((await layQuy(quyId)).daNghi).toBe(trangThai === 'DA_DUYET' ? 2 : 0);
    expect(trangThai).toBe(huy.status === 200 ? 'DA_HUY' : 'DA_DUYET');
  });
});

// ---------------------------------------------------------------------------
describe('Danh sách, lịch nghỉ, quỹ theo phạm vi', () => {
  async function chuanBi() {
    const a = await taoNhanVien(); // PKT-PT
    const b = await taoNhanVien({ chucDanhPhongBanId: 8 }); // PKD
    await capQuy(a.nhanVien.id, 12);
    await capQuy(b.nhanVien.id, 10);
    const dA = await taoDonOk(a.tk);
    const dB = await taoDonOk(b.tk);
    return { a, b, dA, dB };
  }
  const tim = (items, id) => items.find((d) => d.id === id);

  test('danh sách đơn: quanly chỉ thấy phòng mình, quanly2 thấy PKD, HR/giamDoc thấy cả hai; duocDuyet đúng', async () => {
    const { dA, dB } = await chuanBi();
    const lay = async (ten) => {
      const res = await goi('get', '/donNghiPhep?thang=2021-03&kichThuoc=100', token[ten]);
      expect(res.status).toBe(200);
      expect(res.body.data.phanTrang).toMatchObject({ trang: 1, kichThuoc: 100 });
      return res.body.data.items;
    };
    const ql = await lay('quanly');
    expect(tim(ql, dA.id)).toMatchObject({ duocDuyet: true, nguoiDuyetDuKien: { loai: 'TRUONG_BO_PHAN', nhanVienId: 3 } });
    expect(tim(ql, dB.id)).toBeUndefined();
    const ql2 = await lay('quanly2');
    expect(tim(ql2, dB.id)).toMatchObject({ duocDuyet: true, nguoiDuyetDuKien: { nhanVienId: 9 } });
    expect(tim(ql2, dA.id)).toBeUndefined();
    const hr = await lay('hr');
    expect(tim(hr, dA.id).duocDuyet).toBe(false);
    expect(tim(hr, dB.id).duocDuyet).toBe(false);
    const gd = await lay('giamdoc');
    expect(tim(gd, dA.id).duocDuyet).toBe(true);
    expect(tim(gd, dB.id).duocDuyet).toBe(true);
    expect((await goi('get', '/donNghiPhep?trangThai=PENDING', token.hr)).status).toBe(400);
    expect((await goi('get', '/donNghiPhep?thang=2021-3', token.hr)).status).toBe(400);
  });
  test('đơn của tôi chỉ gồm đơn của chính mình', async () => {
    const { a, dA, dB } = await chuanBi();
    const res = await goi('get', '/donNghiPhep/cuaToi', a.tk);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((d) => d.id)).toEqual([dA.id]);
    expect(tim(res.body.data.items, dB.id)).toBeUndefined();
  });
  test('lịch nghỉ theo phạm vi, bỏ đơn đã hủy', async () => {
    const { a, dA, dB } = await chuanBi();
    const lich = async (ten) => {
      const res = await goi('get', '/donNghiPhep/lich?thang=2021-03', token[ten]);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ thang: '2021-03', tuNgay: '2021-03-01', denNgay: '2021-03-31', biCat: false });
      return res.body.data.items;
    };
    expect(tim(await lich('quanly'), dA.id)).toBeDefined();
    expect(tim(await lich('quanly'), dB.id)).toBeUndefined();
    expect(tim(await lich('quanly2'), dB.id)).toBeDefined();
    expect(tim(await lich('hr'), dB.id)).toBeDefined();
    await goi('post', `/donNghiPhep/${dA.id}/huy`, a.tk);
    expect(tim(await lich('giamdoc'), dA.id)).toBeUndefined();
  });
  test('danh sách quỹ năm 2021 theo phạm vi, soNgayConLai trừ cả đơn chờ duyệt; quỹ của tôi', async () => {
    const { a, b } = await chuanBi();
    const quy = async (ten) => {
      const res = await goi('get', '/quyPhep?nam=2021&kichThuoc=100', token[ten]);
      expect(res.status).toBe(200);
      expect(res.body.data.nam).toBe(2021);
      return res.body.data.items;
    };
    const timNv = (items, id) => items.find((d) => d.nhanVienId === id);
    const ql = await quy('quanly');
    expect(timNv(ql, a.nhanVien.id)).toMatchObject({ tongSoNgayPhep: 12, soNgayDaNghi: 0, soNgayChoDuyet: 2, soNgayConLai: 10 });
    expect(timNv(ql, b.nhanVien.id)).toBeUndefined();
    expect(timNv(await quy('quanly2'), b.nhanVien.id)).toMatchObject({ soNgayConLai: 8 });
    expect(timNv(await quy('hr'), a.nhanVien.id)).toBeDefined();
    expect(timNv(await quy('giamdoc'), b.nhanVien.id)).toBeDefined();
    const cua = await goi('get', '/quyPhep/cuaToi?nam=2021', a.tk);
    expect(cua.status).toBe(200);
    expect(cua.body.data).toMatchObject({ nam: 2021, soNgayChoDuyet: 2, soNgayConLai: 10, quy: { tongSoNgayPhep: 12 } });
    const chuaCo = await goi('get', '/quyPhep/cuaToi?nam=2020', a.tk);
    expect(chuaCo.body.data).toMatchObject({ nam: 2020, quy: null, soNgayConLai: null });
    expect((await goi('get', '/quyPhep/cuaToi?nam=21', a.tk)).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('Loại nghỉ phép (HR)', () => {
  const ma = () => `QA_L${Date.now() % 100000}`;
  test('thêm loại 201 + nhật ký, trùng mã 409, mã sai 400', async () => {
    const maLoai = ma();
    const res = await goi('post', '/loaiNghiPhep', token.hr).send({ maLoai: maLoai.toLowerCase(), tenLoai: 'Nghỉ thử nghiệm', soNgayToiDa: 2.5 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true, code: 201,
      data: { maLoai, soNgayToiDa: 2.5, coLuong: true, truVaoQuyPhepNam: true, trangThai: 'DANG_AP_DUNG' }, // mặc định khớp schema DEFAULT 1
    });
    expect(await layNhatKy('THEM_LOAI_NGHI_PHEP')).toHaveLength(1);
    expect((await goi('post', '/loaiNghiPhep', token.hr).send({ maLoai, tenLoai: 'Trùng mã' })).status).toBe(409);
    for (const body of [
      { maLoai: 'A B', tenLoai: 'Sai mã' }, { maLoai: 'X', tenLoai: 'Ngắn' }, { tenLoai: 'Thiếu mã' },
      { maLoai: ma() + 'Z', tenLoai: 'Số âm', soNgayToiDa: -1 }, { maLoai: ma() + 'Y', tenLoai: 'Bước sai', soNgayToiDa: 1.3 },
      { maLoai: ma() + 'W', tenLoai: 'Bằng 0', soNgayToiDa: 0 },
      { maLoai: ma() + 'U', tenLoai: 'Cờ sai', coLuong: 'co' }, { maLoai: ma() + 'T', tenLoai: 'Mô tả số', moTa: 5 },
    ]) {
      expect([body, (await goi('post', '/loaiNghiPhep', token.hr).send(body)).status]).toEqual([body, 400]);
    }
    const khongGioiHan = await goi('post', '/loaiNghiPhep', token.hr).send({ maLoai: ma() + 'V', tenLoai: 'Null', soNgayToiDa: null });
    expect(khongGioiHan.status).toBe(201);
    expect(khongGioiHan.body.data.soNgayToiDa).toBeNull();
  });
  test('thêm loại gửi truVaoQuyPhepNam/coLuong false tường minh -> trả false', async () => {
    const maLoai = ma() + 'F';
    const res = await goi('post', '/loaiNghiPhep', token.hr).send({ maLoai, tenLoai: 'Không trừ quỹ', truVaoQuyPhepNam: false, coLuong: false });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ maLoai, truVaoQuyPhepNam: false, coLuong: false });
    const [[db]] = await pool.execute('SELECT truVaoQuyPhepNam, coLuong FROM loainghiphep WHERE maLoai = ?', [maLoai]);
    expect([Number(db.truVaoQuyPhepNam), Number(db.coLuong)]).toEqual([0, 0]);
  });
  test('sửa không thay đổi -> 400; soNgayToiDa null / chuỗi rỗng -> không giới hạn', async () => {
    const id = await taoLoai({ soNgayToiDa: 5 });
    expect((await goi('patch', `/loaiNghiPhep/${id}`, token.hr).send({ tenLoai: 'Loại thử' })).status).toBe(400);
    const res = await goi('patch', `/loaiNghiPhep/${id}`, token.hr).send({ soNgayToiDa: null });
    expect(res.status).toBe(200);
    expect(res.body.data.soNgayToiDa).toBeNull();
    expect((await goi('patch', `/loaiNghiPhep/${id}`, token.hr).send({ soNgayToiDa: 3 })).status).toBe(200);
    const rong = await goi('patch', `/loaiNghiPhep/${id}`, token.hr).send({ soNgayToiDa: '' });
    expect(rong.status).toBe(200);
    expect(rong.body.data.soNgayToiDa).toBeNull();
    expect(await layNhatKy('SUA_LOAI_NGHI_PHEP')).toHaveLength(3);
    for (const body of [{ moTa: 123 }, { moTa: { a: 1 } }, { moTa: ['x'] }]) {
      expect([body, (await goi('patch', `/loaiNghiPhep/${id}`, token.hr).send(body)).status]).toEqual([body, 400]);
    }
    expect((await goi('patch', `/loaiNghiPhep/${id}`, token.hr).send({ trangThai: 'PENDING' })).status).toBe(400);
    expect((await goi('patch', '/loaiNghiPhep/999999', token.hr).send({ tenLoai: 'Không có' })).status).toBe(404);
  });
  test('đổi cờ coLuong/truVaoQuyPhepNam khi đã có đơn -> 409; chưa có đơn -> 200', async () => {
    const id = await taoLoai();
    expect((await goi('patch', `/loaiNghiPhep/${id}`, token.hr).send({ coLuong: false })).status).toBe(200);
    const { tk } = await taoNhanVien();
    await taoDonOk(tk, { loaiNghiPhepId: id });
    expect((await goi('patch', `/loaiNghiPhep/${id}`, token.hr).send({ coLuong: true })).status).toBe(409);
    expect((await goi('patch', `/loaiNghiPhep/${id}`, token.hr).send({ truVaoQuyPhepNam: true })).status).toBe(409);
    expect((await goi('patch', `/loaiNghiPhep/${id}`, token.hr).send({ tenLoai: 'Đổi tên được' })).status).toBe(200);
  });
  test('sửa tenLoai rỗng/null hoặc trangThai null/rỗng/giá trị lạ -> 400, dữ liệu không đổi', async () => {
    const id = await taoLoai({ tenLoai: 'Tên gốc', trangThai: 'DANG_AP_DUNG' });
    for (const body of [{ tenLoai: '' }, { tenLoai: null }, { trangThai: null }, { trangThai: '' }, { trangThai: 'LA_LUNG' }]) {
      expect([body, (await goi('patch', `/loaiNghiPhep/${id}`, token.hr).send(body)).status]).toEqual([body, 400]);
    }
    const [[db]] = await pool.execute('SELECT tenLoai, trangThai FROM loainghiphep WHERE id = ?', [id]);
    expect(db).toEqual({ tenLoai: 'Tên gốc', trangThai: 'DANG_AP_DUNG' });
    expect(await layNhatKy('SUA_LOAI_NGHI_PHEP')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe('Quỹ phép (HR)', () => {
  test('cấp quỹ năm: ngoài khoảng 400, chỉ cấp người chưa có quỹ, gọi lại cấp 0', async () => {
    const hienTai = namHienTai();
    for (const nam of [hienTai - 2, hienTai + 2, 'abc']) {
      expect((await goi('post', '/quyPhep/capNam', token.hr).send({ nam })).status).toBe(400);
    }
    expect((await goi('post', '/quyPhep/capNam', token.hr).send({ nam: hienTai + 1, tongSoNgayPhep: 1.3 })).status).toBe(400);
    const { nhanVien } = await taoNhanVien();
    const nam = hienTai + 1;
    const [[dem]] = await pool.execute(
      `SELECT COUNT(*) AS n FROM nhanvien nv WHERE nv.trangThaiLamViec <> 'DA_NGHI_VIEC' AND nv.ngayVaoLam <= ?
          AND NOT EXISTS (SELECT 1 FROM quyngayphep q WHERE q.nhanVienId = nv.id AND q.namHieuLuc = ?)`,
      [`${nam}-12-31`, nam]
    );
    const [truoc] = await pool.execute('SELECT id, tongSoNgayPhep FROM quyngayphep WHERE namHieuLuc = ? ORDER BY id', [nam]);
    const res = await goi('post', '/quyPhep/capNam', token.hr).send({ nam, tongSoNgayPhep: 15 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ nam, tongSoNgayPhep: 15, soNhanVien: Number(dem.n) });
    expect(Number(dem.n)).toBeGreaterThanOrEqual(1);
    const [[moi]] = await pool.execute('SELECT tongSoNgayPhep FROM quyngayphep WHERE nhanVienId = ? AND namHieuLuc = ?', [nhanVien.id, nam]);
    expect(Number(moi.tongSoNgayPhep)).toBe(15);
    for (const q of truoc) {
      const [[sau]] = await pool.execute('SELECT tongSoNgayPhep FROM quyngayphep WHERE id = ?', [q.id]);
      expect(sau.tongSoNgayPhep).toBe(q.tongSoNgayPhep);
    }
    expect(await layNhatKy('CAP_QUY_PHEP_NAM')).toHaveLength(1);
    const lai = await goi('post', '/quyPhep/capNam', token.hr).send({ nam });
    expect(lai.body.data.soNhanVien).toBe(0);
    expect(await layNhatKy('CAP_QUY_PHEP_NAM')).toHaveLength(1);
  });
  test('sửa quỹ: tự sửa 403, thấp hơn đã nghỉ + chờ duyệt 409, bước 0.5, không đổi 400, thành công ghi nhật ký', async () => {
    const [[quyHr]] = await pool.execute('SELECT id FROM quyngayphep WHERE nhanVienId = 4 LIMIT 1');
    expect((await goi('patch', `/quyPhep/${quyHr.id}`, token.hr).send({ tongSoNgayPhep: 20 })).status).toBe(403);

    const { nhanVien, tk } = await taoNhanVien();
    const quyId = await capQuy(nhanVien.id, 10, 2);
    await taoDonOk(tk); // 2 ngày chờ duyệt
    expect((await goi('patch', `/quyPhep/${quyId}`, token.hr).send({ tongSoNgayPhep: 3.5 })).status).toBe(409);
    expect((await goi('patch', `/quyPhep/${quyId}`, token.hr).send({ tongSoNgayPhep: 4.3 })).status).toBe(400);
    expect((await goi('patch', `/quyPhep/${quyId}`, token.hr).send({ tongSoNgayPhep: 10 })).status).toBe(400);
    expect((await goi('patch', `/quyPhep/${quyId}`, token.hr).send({})).status).toBe(400);
    expect((await goi('patch', '/quyPhep/999999', token.hr).send({ tongSoNgayPhep: 5 })).status).toBe(404);
    const res = await goi('patch', `/quyPhep/${quyId}`, token.hr).send({ tongSoNgayPhep: 4.5, lyDo: 'Điều chỉnh' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ tongSoNgayPhep: 4.5, soNgayDaNghi: 2 });
    expect(await layNhatKy('SUA_QUY_PHEP')).toHaveLength(1);
  });
  test('sửa quỹ phép của nhân viên đã nghỉ việc -> 409, quỹ không đổi', async () => {
    const { nhanVien } = await taoNhanVien();
    const quyId = await capQuy(nhanVien.id, 10, 0);
    await pool.execute("UPDATE nhanvien SET trangThaiLamViec = 'DA_NGHI_VIEC' WHERE id = ?", [nhanVien.id]);
    expect((await goi('patch', `/quyPhep/${quyId}`, token.hr).send({ tongSoNgayPhep: 12, lyDo: 'Thử' })).status).toBe(409);
    expect(await layQuy(quyId)).toEqual({ tong: 10, daNghi: 0 });
    expect(await layNhatKy('SUA_QUY_PHEP')).toHaveLength(0);
  });
  test('sửa quỹ với lyDo không phải chuỗi -> 400', async () => {
    const { nhanVien } = await taoNhanVien();
    const quyId = await capQuy(nhanVien.id, 10, 0);
    for (const lyDo of [123, { a: 1 }, ['x']]) {
      expect([lyDo, (await goi('patch', `/quyPhep/${quyId}`, token.hr).send({ tongSoNgayPhep: 11, lyDo })).status]).toEqual([lyDo, 400]);
    }
    expect(await layQuy(quyId)).toEqual({ tong: 10, daNghi: 0 });
  });
});

// ---------------------------------------------------------------------------
describe('Chốt công liên quan đơn nghỉ', () => {
  test('tháng còn đơn nghỉ CHO_DUYET -> chốt 409; xử lý xong thì chốt được', async () => {
    const { tk } = await taoNhanVien();
    const d = await taoDonOk(tk, { loaiNghiPhepId: LOAI_OM, ngayBatDau: '2021-05-31', ngayKetThuc: '2021-06-01' });
    const res = await goi('post', '/chamCong/chotCong', token.hr).send({ thang: '2021-06' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/đơn nghỉ phép/);
    expect(res.body.message).toContain(d.maDon);
    expect((await goi('post', '/chamCong/chotCong', token.hr).send({ thang: '2021-05' })).status).toBe(409);
    expect((await goi('post', `/donNghiPhep/${d.id}/huy`, tk)).status).toBe(200);
    expect((await goi('post', '/chamCong/chotCong', token.hr).send({ thang: '2021-06' })).status).toBe(200);
  });
});
