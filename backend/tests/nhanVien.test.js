const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');

// Dữ liệu mẫu (database/seed.sql):
//  nhân viên 1 admin (PKT, cdpb 4), 2 giamdoc (BGD, cdpb 1, trưởng BGD), 3 quanly (PKT, cdpb 3, trưởng PKT),
//  4 hr (PNS, cdpb 2), 5 nhanvien (PKT-PT, cdpb 5), 6 nhanvien2 (PKT-PT, cdpb 5, THU_VIEC)
//  Định biên: cdpb1=1, cdpb2=3, cdpb3=1, cdpb4=1, cdpb5=10
const MAT_KHAU = 'MatKhau@123';
const URL = '/api/v1/nhanVien';
const COT_HO_SO = [
  'hoVaTen', 'gioiTinh', 'ngaySinh', 'soDienThoai', 'diaChi', 'soTaiKhoanNganHang', 'tenNganHang',
  'chucDanhPhongBanId', 'ngayVaoLam', 'trangThaiLamViec',
];

const token = {};
let mocNhatKyDau;
let mocNhatKy;
let anhChup; // ảnh chụp dữ liệu gốc để khôi phục sau mỗi test
let demTen = 0;

function dangNhap(tenDangNhap, matKhau = MAT_KHAU) {
  return request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap, matKhau });
}
const goi = (phuongThuc, duongDan, tk) => {
  const r = request(app)[phuongThuc](`${URL}${duongDan}`);
  return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
};

function duLieuMoi(ghiDe = {}) {
  demTen += 1;
  const ten = `qatest${Date.now() % 100000}${demTen}`;
  return {
    hoVaTen: 'Nguyễn Văn Kiểm',
    gioiTinh: 'NAM',
    ngaySinh: '1999-05-20',
    ngayVaoLam: '2026-10-15',
    chucDanhPhongBanId: 5,
    tenDangNhap: ten,
    email: `${ten}@smarthrm.local`,
    ...ghiDe,
  };
}
const themNhanVien = (body, tk = token.hr) => goi('post', '', tk).send(body);

async function taoNhanVien(ghiDe) {
  const res = await themNhanVien(duLieuMoi(ghiDe));
  expect(res.status).toBe(201);
  return res.body.data;
}

async function demNhatKy(hanhDong, nguoiDungId) {
  const [dong] = await pool.execute(
    'SELECT COUNT(*) AS n FROM nhatkyhethong WHERE id > ? AND hanhDong = ? AND (? IS NULL OR nguoiDungId = ?)',
    [mocNhatKy, hanhDong, nguoiDungId ?? null, nguoiDungId ?? null]
  );
  return Number(dong[0].n);
}
async function layNhatKy(hanhDong) {
  const [dong] = await pool.execute(
    'SELECT nguoiDungId, chiTiet FROM nhatkyhethong WHERE id > ? AND hanhDong = ? ORDER BY id',
    [mocNhatKy, hanhDong]
  );
  return dong;
}
async function trangThaiTaiKhoan(nguoiDungId) {
  const [dong] = await pool.execute('SELECT trangThai FROM nguoidung WHERE id = ?', [nguoiDungId]);
  return dong[0]?.trangThai;
}
async function datDinhBien(cdpbId, dinhBien) {
  await pool.execute('UPDATE chucdanhphongban SET dinhBien = ? WHERE id = ?', [dinhBien, cdpbId]);
}

// Giá trị kỳ vọng tính từ CSDL để không vỡ khi seed thay đổi
async function demBang(bang) {
  const [d] = await pool.query(`SELECT COUNT(*) AS n FROM ${bang}`);
  return Number(d[0].n);
}
// Mã nhân viên kế tiếp thứ k (k = 1 là mã sẽ sinh tiếp theo) dựa trên MAX(maNhanVien) dạng NVxxxx
async function maKeTiep(k = 1) {
  const [d] = await pool.query(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(maNhanVien, 3) AS UNSIGNED)), 0) AS so FROM nhanvien WHERE maNhanVien REGEXP '^NV[0-9]+$'"
  );
  return `NV${String(Number(d[0].so) + k).padStart(4, '0')}`;
}
async function layMaToanCongTy() {
  const [d] = await pool.query('SELECT maNhanVien FROM nhanvien ORDER BY maNhanVien');
  return d.map((x) => x.maNhanVien);
}

async function datLaiAutoIncrement() {
  // InnoDB tự nâng về MAX(id)+1 nếu giá trị nhỏ hơn
  for (const bang of ['nhanvien', 'nguoidung', 'nhatkyhethong']) {
    await pool.query(`ALTER TABLE ${bang} AUTO_INCREMENT = 1`);
  }
}

beforeAll(async () => {
  const [moc] = await pool.execute('SELECT COALESCE(MAX(id), 0) AS moc FROM nhatkyhethong');
  mocNhatKyDau = moc[0].moc;
  const [nv] = await pool.query(`SELECT id, ${COT_HO_SO.join(', ')} FROM nhanvien`);
  const [nd] = await pool.query('SELECT id, trangThai FROM nguoidung');
  const [cdpb] = await pool.query('SELECT id, dinhBien FROM chucdanhphongban');
  const [ndvt] = await pool.query('SELECT nguoiDungId, vaiTroId FROM nguoidungvaitro');
  const [vt] = await pool.query('SELECT id, maVaiTro FROM vaitro');
  anhChup = {
    nv, nd, cdpb, ndvt, vt,
    maxNhanVien: Math.max(...nv.map((d) => d.id)),
    maxNguoiDung: Math.max(...nd.map((d) => d.id)),
  };
  for (const ten of ['admin', 'giamdoc', 'quanly', 'hr', 'nhanvien', 'nhanvien2', 'hr2', 'giamdoc2', 'quanly2', 'nhanvien3']) {
    const res = await dangNhap(ten);
    expect(res.status).toBe(200);
    token[ten] = res.body.data.token;
  }
});

beforeEach(async () => {
  const [moc] = await pool.execute('SELECT COALESCE(MAX(id), 0) AS moc FROM nhatkyhethong');
  mocNhatKy = moc[0].moc;
});

// Dọn dữ liệu do test sinh ra và khôi phục các cột đã đổi -> test không phụ thuộc thứ tự chạy
afterEach(async () => {
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKy]);
  await pool.execute('DELETE FROM nhanvien WHERE id > ?', [anhChup.maxNhanVien]);
  await pool.execute('DELETE FROM nguoidungvaitro WHERE nguoiDungId > ?', [anhChup.maxNguoiDung]);
  await pool.execute('DELETE FROM nguoidung WHERE id > ?', [anhChup.maxNguoiDung]);
  for (const v of anhChup.vt) {
    await pool.execute('UPDATE vaitro SET maVaiTro = ? WHERE id = ?', [v.maVaiTro, v.id]);
  }
  for (const d of anhChup.nv) {
    await pool.execute(
      `UPDATE nhanvien SET ${COT_HO_SO.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...COT_HO_SO.map((c) => d[c]), d.id]
    );
  }
  for (const d of anhChup.nd) {
    await pool.execute('UPDATE nguoidung SET trangThai = ? WHERE id = ?', [d.trangThai, d.id]);
  }
  for (const d of anhChup.cdpb) await datDinhBien(d.id, d.dinhBien);
  await pool.execute('DELETE FROM nguoidungvaitro');
  for (const d of anhChup.ndvt) {
    await pool.execute('INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES (?, ?)', [d.nguoiDungId, d.vaiTroId]);
  }
  await datLaiAutoIncrement();
});

afterAll(async () => {
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKyDau]);
  await datLaiAutoIncrement();
  await pool.end();
});

// ---------------------------------------------------------------------------
describe('GET /api/v1/nhanVien - danh sách theo vai trò', () => {
  test('chưa đăng nhập trả 401 chuẩn', async () => {
    const res = await goi('get', '');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, code: 401, message: expect.any(String), data: null });
  });

  test.each(['nhanvien', 'admin'])('tài khoản %s không được xem danh sách (403)', async (ten) => {
    const res = await goi('get', '', token[ten]);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: 403, data: null });
  });

  test.each(['hr', 'giamdoc'])('%s xem toàn công ty, cấu trúc phân trang chuẩn, không lộ ngân hàng', async (ten) => {
    const res = await goi('get', '', token[ten]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200, message: expect.any(String) });
    const dsMa = await layMaToanCongTy();
    expect(dsMa).toEqual(expect.arrayContaining(['NV0001', 'NV0007', 'NV0008', 'NV0009', 'NV0010']));
    expect(res.body.data.phanTrang).toEqual({ trang: 1, kichThuoc: 20, tongSo: dsMa.length });
    expect(res.body.data.items.map((nv) => nv.maNhanVien)).toEqual(dsMa.slice(0, 20));
    const chuoi = JSON.stringify(res.body);
    expect(chuoi).not.toMatch(/soTaiKhoanNganHang|tenNganHang|matKhauMaHoa/);
  });

  test('quanLy chỉ thấy nhân viên PKT và phòng con PKT-PT', async () => {
    const res = await goi('get', '', token.quanly);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((nv) => nv.id).sort()).toEqual([1, 3, 5, 6]);
    expect(new Set(res.body.data.items.map((nv) => nv.phongBanId))).toEqual(new Set([3, 4]));
    expect(res.body.data.phanTrang.tongSo).toBe(4);
  });

  test('quanLy lọc phòng ngoài phạm vi (PNS) nhận danh sách rỗng', async () => {
    const res = await goi('get', '?phongBanId=2', token.quanly);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ items: [], phanTrang: { trang: 1, kichThuoc: 20, tongSo: 0 } });
  });
});

describe('GET /api/v1/nhanVien - lọc, tìm kiếm, phân trang', () => {
  test.each([
    ['?tuKhoa=Th%E1%BB%8B%20Hoa', ['NV0006']], // "Thị Hoa"
    // collation utf8mb4_general_ci không phân biệt dấu: "Hoa" khớp cả "Hoàng"
    ['?tuKhoa=Hoa', ['NV0005', 'NV0006']],
    ['?tuKhoa=NV0003', ['NV0003']],
    ['?tuKhoa=0905000004', ['NV0004']],
    ['?phongBanId=4', ['NV0005', 'NV0006']],
    ['?trangThaiLamViec=THU_VIEC', ['NV0006']],
    ['?phongBanId=4&trangThaiLamViec=CHINH_THUC', ['NV0005']],
    ['?tuKhoa=%25', []], // ký tự % phải được escape, không khớp tất cả
    ['?tuKhoa=_', []],
  ])('lọc %s', async (query, mong) => {
    const res = await goi('get', query, token.hr);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((nv) => nv.maNhanVien)).toEqual(mong);
    expect(res.body.data.phanTrang.tongSo).toBe(mong.length);
  });

  test('phân trang trang=2, kichThuoc=2', async () => {
    const res = await goi('get', '?trang=2&kichThuoc=2', token.hr);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((nv) => nv.maNhanVien)).toEqual(['NV0003', 'NV0004']);
    expect(res.body.data.phanTrang).toEqual({ trang: 2, kichThuoc: 2, tongSo: await demBang('nhanvien') });
  });

  test('kichThuoc lớn hơn 100 bị giới hạn về 100', async () => {
    const res = await goi('get', '?kichThuoc=1000', token.hr);
    expect(res.status).toBe(200);
    expect(res.body.data.phanTrang.kichThuoc).toBe(100);
  });

  test.each([
    '?trang=0', '?trang=abc', '?kichThuoc=-1', '?kichThuoc=1.5', '?phongBanId=x', '?trangThaiLamViec=PENDING',
  ])('tham số sai %s trả 400', async (query) => {
    const res = await goi('get', query, token.hr);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, code: 400, message: expect.any(String), data: null });
  });
});

// ---------------------------------------------------------------------------
describe('GET /api/v1/nhanVien/:id và /toi - chi tiết và phạm vi', () => {
  test.each(['hr', 'giamdoc'])('%s xem đầy đủ hồ sơ người khác kèm ngân hàng và tài khoản', async (ten) => {
    const res = await goi('get', '/5', token[ten]);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: 5, maNhanVien: 'NV0005', soTaiKhoanNganHang: '0011000000005', tenNganHang: 'MB Bank',
      tenDangNhap: 'nhanvien', trangThaiTaiKhoan: 'DANG_HOAT_DONG',
    });
    expect(res.body.data).not.toHaveProperty('matKhauMaHoa');
  });

  test('quanLy xem nhân viên trong phạm vi bị ẩn ngân hàng và thông tin tài khoản', async () => {
    const res = await goi('get', '/6', token.quanly);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 6, maNhanVien: 'NV0006', hoVaTen: 'Võ Thị Hoa' });
    for (const cot of ['soTaiKhoanNganHang', 'tenNganHang', 'nguoiDungId', 'tenDangNhap', 'email', 'trangThaiTaiKhoan']) {
      expect(res.body.data).not.toHaveProperty(cot);
    }
  });

  test('quanLy xem chính mình thấy đầy đủ ngân hàng', async () => {
    const res = await goi('get', '/3', token.quanly);
    expect(res.status).toBe(200);
    expect(res.body.data.soTaiKhoanNganHang).toBe('0011000000003');
  });

  test('quanLy xem hr (PNS, ngoài phạm vi) trả 403', async () => {
    const res = await goi('get', '/4', token.quanly);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: 403, data: null });
  });

  test.each([
    ['nhanvien', 6],
    ['nhanvien', 3],
    ['admin', 5],
    ['admin', 2],
  ])('%s xem hồ sơ người khác (id %i) trả 403', async (ten, id) => {
    const res = await goi('get', `/${id}`, token[ten]);
    expect(res.status).toBe(403);
  });

  test.each([['nhanvien', 5], ['admin', 1]])('%s xem hồ sơ của chính mình (id %i) thành công', async (ten, id) => {
    const res = await goi('get', `/${id}`, token[ten]);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data).toHaveProperty('soTaiKhoanNganHang');
  });

  test('id không tồn tại trả 404, id sai định dạng trả 400', async () => {
    expect((await goi('get', '/99999', token.hr)).status).toBe(404);
    expect((await goi('get', '/abc', token.hr)).status).toBe(400);
    expect((await goi('get', '/0', token.hr)).status).toBe(400);
  });

  test('chưa đăng nhập xem chi tiết trả 401', async () => {
    expect((await goi('get', '/5')).status).toBe(401);
  });

  test.each([
    ['admin', 1], ['giamdoc', 2], ['quanly', 3], ['hr', 4], ['nhanvien', 5], ['nhanvien2', 6],
  ])('GET /toi của %s trả đúng hồ sơ id %i', async (ten, id) => {
    const res = await goi('get', '/toi', token[ten]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200 });
    expect(res.body.data.id).toBe(id);
    expect(res.body.data).not.toHaveProperty('matKhauMaHoa');
  });

  test('GET /toi chưa đăng nhập trả 401', async () => {
    expect((await goi('get', '/toi')).status).toBe(401);
  });

  async function vaiTroTrongDb(nguoiDungId) {
    const [d] = await pool.execute(
      'SELECT v.maVaiTro FROM nguoidungvaitro nv JOIN vaitro v ON v.id = nv.vaiTroId WHERE nv.nguoiDungId = ?',
      [nguoiDungId]
    );
    return d.map((x) => x.maVaiTro).sort();
  }

  test.each([['hr', 5], ['hr', 3], ['giamdoc', 1], ['giamdoc', 4]])('%s xem hồ sơ id %i có vaiTroTaiKhoan khớp CSDL', async (ten, id) => {
    const res = await goi('get', `/${id}`, token[ten]);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.vaiTroTaiKhoan)).toBe(true);
    expect([...res.body.data.vaiTroTaiKhoan].sort()).toEqual(await vaiTroTrongDb(id));
  });

  test('vaiTroTaiKhoan phản ánh vai trò mới sau khi Admin phân quyền', async () => {
    const gan = await request(app).put('/api/v1/nguoiDung/6/vaiTro').set('Authorization', `Bearer ${token.admin}`)
      .send({ vaiTro: ['nhanVien', 'HR'] });
    expect(gan.status).toBe(200);
    const res = await goi('get', '/6', token.hr);
    expect([...res.body.data.vaiTroTaiKhoan].sort()).toEqual(['HR', 'nhanVien']);
  });

  test.each([['quanly', 6], ['quanly', 5], ['nhanvien', 5], ['nhanvien2', 6], ['quanly', 3]])(
    '%s xem hồ sơ id %i không có trường vaiTroTaiKhoan',
    async (ten, id) => {
      const res = await goi('get', `/${id}`, token[ten]);
      expect(res.status).toBe(200);
      expect(res.body.data).not.toHaveProperty('vaiTroTaiKhoan');
    }
  );
});

// ---------------------------------------------------------------------------
describe('POST /api/v1/nhanVien - thêm nhân viên', () => {
  test('HR thêm thành công: sinh mã kế tiếp, tài khoản vai trò nhanVien, trả matKhauTam, ghi nhật ký', async () => {
    const maMong = await maKeTiep();
    const body = duLieuMoi({ soTaiKhoanNganHang: '123456789', tenNganHang: 'ACB' });
    const res = await themNhanVien(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, code: 201, message: expect.any(String) });
    const { nhanVien, taiKhoan } = res.body.data;
    expect(nhanVien).toMatchObject({
      maNhanVien: maMong, hoVaTen: body.hoVaTen, chucDanhPhongBanId: 5, phongBanId: 4,
      trangThaiLamViec: 'THU_VIEC', tenDangNhap: body.tenDangNhap, trangThaiTaiKhoan: 'DANG_HOAT_DONG',
    });
    expect(taiKhoan.tenDangNhap).toBe(body.tenDangNhap);
    expect(taiKhoan.matKhauTam).toMatch(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{10}$/);
    expect(JSON.stringify(res.body)).not.toMatch(/matKhauMaHoa|\$2[aby]\$/);

    const [vt] = await pool.execute(
      'SELECT v.maVaiTro FROM nguoidungvaitro n JOIN vaitro v ON v.id = n.vaiTroId WHERE n.nguoiDungId = ?',
      [nhanVien.nguoiDungId]
    );
    expect(vt.map((d) => d.maVaiTro)).toEqual(['nhanVien']);

    const nhatKy = await layNhatKy('THEM_NHAN_VIEN');
    expect(nhatKy).toHaveLength(1);
    expect(nhatKy[0].nguoiDungId).toBe(4);
    expect(nhatKy[0].chiTiet).toContain(maMong);
    expect(await demNhatKy('RESET_MAT_KHAU_TAM', nhanVien.nguoiDungId)).toBe(1);
  });

  test('tên đăng nhập/email được chuẩn hóa chữ thường, trạng thái CHINH_THUC theo yêu cầu', async () => {
    const body = duLieuMoi({ trangThaiLamViec: 'CHINH_THUC' });
    const res = await themNhanVien({ ...body, tenDangNhap: body.tenDangNhap.toUpperCase(), email: body.email.toUpperCase() });
    expect(res.status).toBe(201);
    expect(res.body.data.nhanVien).toMatchObject({
      tenDangNhap: body.tenDangNhap, email: body.email, trangThaiLamViec: 'CHINH_THUC',
    });
  });

  test('đăng nhập bằng mật khẩu tạm: batBuocDoiMatKhau = true và bị chặn ở API hồ sơ', async () => {
    const res = await themNhanVien(duLieuMoi());
    expect(res.status).toBe(201);
    const { tenDangNhap, matKhauTam } = res.body.data.taiKhoan;
    const dn = await dangNhap(tenDangNhap, matKhauTam);
    expect(dn.status).toBe(200);
    expect(dn.body.data.nguoiDung.batBuocDoiMatKhau).toBe(true);
    const toi = await goi('get', '/toi', dn.body.data.token);
    expect(toi.status).toBe(403);
  });

  test('hai lần thêm liên tiếp sinh mã tăng dần không trùng', async () => {
    const [ma1, ma2] = [await maKeTiep(1), await maKeTiep(2)];
    const a = await taoNhanVien();
    const b = await taoNhanVien();
    expect(a.nhanVien.maNhanVien).toBe(ma1);
    expect(b.nhanVien.maNhanVien).toBe(ma2);
  });

  test.each([
    ['tên đăng nhập trùng', { tenDangNhap: 'nhanvien' }],
    ['tên đăng nhập trùng khác hoa thường', { tenDangNhap: 'NhanVien2' }],
    ['email trùng', { email: 'hr@smarthrm.local' }],
  ])('%s trả 409 và không tạo bản ghi', async (_ten, ghiDe) => {
    const [soNv, soNd] = [await demBang('nhanvien'), await demBang('nguoidung')];
    const res = await themNhanVien(duLieuMoi(ghiDe));
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 409, data: null });
    expect(await demBang('nhanvien')).toBe(soNv);
    expect(await demBang('nguoidung')).toBe(soNd);
    expect(await demNhatKy('THEM_NHAN_VIEN')).toBe(0);
  });

  test('vị trí đã đủ định biên (Trưởng phòng PKT) trả 409', async () => {
    const res = await themNhanVien(duLieuMoi({ chucDanhPhongBanId: 3 }));
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/định biên/);
  });

  test('người đã nghỉ việc không chiếm định biên', async () => {
    await pool.execute("UPDATE nhanvien SET trangThaiLamViec = 'DA_NGHI_VIEC' WHERE id = 3");
    const res = await themNhanVien(duLieuMoi({ chucDanhPhongBanId: 3 }));
    expect(res.status).toBe(201);
  });

  test('vị trí không tồn tại trả 404', async () => {
    expect((await themNhanVien(duLieuMoi({ chucDanhPhongBanId: 99999 }))).status).toBe(404);
  });

  test.each([
    ['chưa đủ 15 tuổi tại ngày vào làm', { ngaySinh: '2012-01-01' }],
    ['ngày sinh quá xa (trên 80 tuổi)', { ngaySinh: '1900-01-01' }],
    ['ngày vào làm sau hôm nay quá 180 ngày', { ngayVaoLam: '2027-12-01' }],
    ['ngày không có thật', { ngaySinh: '1999-02-30' }],
    ['ngày sai định dạng', { ngaySinh: '20/05/1999' }],
    ['họ tên chứa số', { hoVaTen: 'Nguyen Van 123' }],
    ['họ tên quá ngắn', { hoVaTen: 'A' }],
    ['họ tên ký tự đặc biệt', { hoVaTen: '<script>' }],
    ['thiếu họ tên', { hoVaTen: undefined }],
    ['giới tính sai', { gioiTinh: 'MALE' }],
    ['trạng thái ban đầu không cho phép', { trangThaiLamViec: 'DA_NGHI_VIEC' }],
    ['email sai', { email: 'khongphaiemail' }],
    ['tên đăng nhập có dấu', { tenDangNhap: 'nguyễn' }],
    ['số điện thoại sai', { soDienThoai: '12345' }],
    ['vị trí không phải số nguyên dương', { chucDanhPhongBanId: 'abc' }],
  ])('%s trả 400', async (_ten, ghiDe) => {
    const res = await themNhanVien(duLieuMoi(ghiDe));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, code: 400, message: expect.any(String), data: null });
  });

  test.each(['admin', 'giamdoc', 'quanly', 'nhanvien'])('%s thêm nhân viên trả 403', async (ten) => {
    const res = await themNhanVien(duLieuMoi(), token[ten]);
    expect(res.status).toBe(403);
  });

  test('chưa đăng nhập thêm nhân viên trả 401', async () => {
    expect((await goi('post', '').send(duLieuMoi())).status).toBe(401);
  });

  test('lỗi giữa transaction (gán vai trò thất bại) thì rollback, không còn người dùng mồ côi', async () => {
    // Làm hỏng tạm vai trò nhanVien để ganVaiTro trả 0 dòng -> service ném lỗi sau khi đã INSERT nguoidung
    await pool.execute("UPDATE vaitro SET maVaiTro = 'nhanVien_tamQA' WHERE maVaiTro = 'nhanVien'");
    const body = duLieuMoi();
    let res;
    try {
      res = await themNhanVien(body);
    } finally {
      await pool.execute("UPDATE vaitro SET maVaiTro = 'nhanVien' WHERE maVaiTro = 'nhanVien_tamQA'");
    }
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false, code: 500, data: null });
    const [nd] = await pool.execute('SELECT id FROM nguoidung WHERE tenDangNhap = ?', [body.tenDangNhap]);
    expect(nd).toHaveLength(0);
    expect(await demNhatKy('THEM_NHAN_VIEN')).toBe(0);
    expect(await demNhatKy('RESET_MAT_KHAU_TAM')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('PATCH /api/v1/nhanVien/:id - HR sửa hồ sơ', () => {
  test('HR sửa hồ sơ người khác thành công và ghi SUA_NHAN_VIEN', async () => {
    const res = await goi('patch', '/5', token.hr).send({ hoVaTen: 'Hoàng Văn Nam Mới', diaChi: 'Đà Nẵng' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200 });
    expect(res.body.data).toMatchObject({ hoVaTen: 'Hoàng Văn Nam Mới', diaChi: 'Đà Nẵng' });
    const nk = await layNhatKy('SUA_NHAN_VIEN');
    expect(nk).toHaveLength(1);
    expect(nk[0].nguoiDungId).toBe(4);
    expect(nk[0].chiTiet).toContain('NV0005');
  });

  test('ngày vào làm sau ngày bắt đầu hợp đồng sớm nhất trả 409, bằng ngày đó thì được', async () => {
    const [[{ somNhat, sauMotNgay }]] = await pool.execute(
      `SELECT DATE_FORMAT(MIN(ngayBatDau), '%Y-%m-%d') AS somNhat,
              DATE_FORMAT(DATE_ADD(MIN(ngayBatDau), INTERVAL 1 DAY), '%Y-%m-%d') AS sauMotNgay
         FROM hopdonglaodong WHERE nhanVienId = 5`);
    const [[truoc]] = await pool.execute("SELECT DATE_FORMAT(ngayVaoLam, '%Y-%m-%d') AS ngay FROM nhanvien WHERE id = 5");
    const res = await goi('patch', '/5', token.hr).send({ ngayVaoLam: sauMotNgay });
    expect(res.status).toBe(409);
    const [[sau]] = await pool.execute("SELECT DATE_FORMAT(ngayVaoLam, '%Y-%m-%d') AS ngay FROM nhanvien WHERE id = 5");
    expect(sau.ngay).toBe(truoc.ngay);
    expect(await layNhatKy('SUA_NHAN_VIEN')).toHaveLength(0);
    expect((await goi('patch', '/5', token.hr).send({ ngayVaoLam: somNhat })).status).toBe(200);
  });

  test('nhật ký che số tài khoản ngân hàng cũ và mới (chỉ giữ 4 số cuối)', async () => {
    const res = await goi('patch', '/5', token.hr).send({ soTaiKhoanNganHang: '9988776655' });
    expect(res.status).toBe(200);
    const [{ chiTiet }] = await layNhatKy('SUA_NHAN_VIEN');
    expect(chiTiet).toContain('****0005');
    expect(chiTiet).toContain('****6655');
    expect(chiTiet).not.toContain('0011000000005');
    expect(chiTiet).not.toContain('9988776655');
  });

  test('HR tự sửa hồ sơ của mình trả 403', async () => {
    const res = await goi('patch', '/4', token.hr).send({ diaChi: 'Huế' });
    expect(res.status).toBe(403);
    expect(await demNhatKy('SUA_NHAN_VIEN')).toBe(0);
  });

  test.each(['admin', 'giamdoc', 'quanly', 'nhanvien'])('%s sửa hồ sơ người khác trả 403', async (ten) => {
    expect((await goi('patch', '/6', token[ten]).send({ diaChi: 'Huế' })).status).toBe(403);
  });

  test.each([
    ['body rỗng', {}],
    ['chỉ gửi trường không được sửa', { trangThaiLamViec: 'TAM_NGHI', chucDanhPhongBanId: 3 }],
    ['xóa họ tên', { hoVaTen: '' }],
    ['ngày sinh khiến chưa đủ 15 tuổi', { ngaySinh: '2015-01-01' }],
    ['giới tính sai', { gioiTinh: 'X' }],
  ])('%s trả 400', async (_ten, body) => {
    const res = await goi('patch', '/5', token.hr).send(body);
    expect(res.status).toBe(400);
  });

  test('PATCH không đổi được vị trí/trạng thái dù gửi kèm trường hợp lệ', async () => {
    const res = await goi('patch', '/5', token.hr).send({ diaChi: 'Huế', trangThaiLamViec: 'TAM_NGHI', chucDanhPhongBanId: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ trangThaiLamViec: 'CHINH_THUC', chucDanhPhongBanId: 5 });
  });

  test('nhân viên không tồn tại trả 404', async () => {
    expect((await goi('patch', '/99999', token.hr).send({ diaChi: 'Huế' })).status).toBe(404);
  });
});

describe('PATCH /api/v1/nhanVien/toi - tự sửa hồ sơ', () => {
  test('nhanVien chỉ đổi được SĐT, địa chỉ, ngân hàng; trường khác bị bỏ qua', async () => {
    const res = await goi('patch', '/toi', token.nhanvien).send({
      soDienThoai: '0912345678', diaChi: '', tenNganHang: 'VPBank', soTaiKhoanNganHang: '1234567890',
      hoVaTen: 'Ten Bi Doi', trangThaiLamViec: 'DA_NGHI_VIEC', chucDanhPhongBanId: 3, ngayVaoLam: '2020-01-01',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: 5, soDienThoai: '0912345678', diaChi: null, tenNganHang: 'VPBank', soTaiKhoanNganHang: '1234567890',
      hoVaTen: 'Hoàng Văn Nam', trangThaiLamViec: 'CHINH_THUC', chucDanhPhongBanId: 5, ngayVaoLam: '2024-06-03',
    });
    const nk = await layNhatKy('CAP_NHAT_HO_SO_CA_NHAN');
    expect(nk).toHaveLength(1);
    expect(nk[0].nguoiDungId).toBe(5);
    expect(nk[0].chiTiet).not.toContain('1234567890');
    expect(nk[0].chiTiet).toContain('****7890');
  });

  test('nhật ký chỉ ghi trường thật sự đổi', async () => {
    const [[cu]] = await pool.execute('SELECT soDienThoai, diaChi FROM nhanvien WHERE id = 5');
    const soMoi = cu.soDienThoai === '0987001122' ? '0987003344' : '0987001122';
    const res = await goi('patch', '/toi', token.nhanvien).send({ soDienThoai: soMoi, diaChi: cu.diaChi ?? '' });
    expect(res.status).toBe(200);
    const nk = await layNhatKy('CAP_NHAT_HO_SO_CA_NHAN');
    expect(nk).toHaveLength(1);
    expect(nk[0].chiTiet).toContain('soDienThoai');
    expect(nk[0].chiTiet).not.toContain('diaChi');
  });

  test('gửi lại đúng giá trị cũ: nhật ký ghi "không có trường nào thay đổi"', async () => {
    const [[cu]] = await pool.execute('SELECT soDienThoai, tenNganHang FROM nhanvien WHERE id = 5');
    const res = await goi('patch', '/toi', token.nhanvien).send({ soDienThoai: cu.soDienThoai, tenNganHang: cu.tenNganHang });
    expect(res.status).toBe(200);
    const nk = await layNhatKy('CAP_NHAT_HO_SO_CA_NHAN');
    expect(nk).toHaveLength(1);
    expect(nk[0].chiTiet).toContain('không có trường nào thay đổi');
    expect(nk[0].chiTiet).not.toContain('soDienThoai');
  });

  test('chỉ gửi trường không cho phép trả 400', async () => {
    const res = await goi('patch', '/toi', token.nhanvien).send({ hoVaTen: 'Ten Moi' });
    expect(res.status).toBe(400);
  });

  test.each([
    ['số điện thoại sai', { soDienThoai: 'abc' }],
    ['số tài khoản có chữ', { soTaiKhoanNganHang: '12ab5678' }],
    ['địa chỉ quá dài', { diaChi: 'x'.repeat(256) }],
  ])('%s trả 400', async (_ten, body) => {
    expect((await goi('patch', '/toi', token.nhanvien).send(body)).status).toBe(400);
  });

  test('HR được tự sửa SĐT của mình qua /toi', async () => {
    const res = await goi('patch', '/toi', token.hr).send({ soDienThoai: '0987654321' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 4, soDienThoai: '0987654321' });
  });

  test('chưa đăng nhập trả 401', async () => {
    expect((await goi('patch', '/toi').send({ diaChi: 'Huế' })).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/v1/nhanVien/:id/doiTrangThai', () => {
  const doi = (id, body, tk = token.hr) => goi('post', `/${id}/doiTrangThai`, tk).send(body);

  test('CHINH_THUC -> THU_VIEC không hợp lệ trả 400', async () => {
    const res = await doi(5, { trangThaiLamViec: 'THU_VIEC' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 400, data: null });
  });

  test.each([
    ['giữ nguyên trạng thái', { trangThaiLamViec: 'CHINH_THUC' }],
    ['giá trị không có trong danh sách', { trangThaiLamViec: 'PENDING' }],
    ['thiếu trạng thái', {}],
  ])('%s trả 400', async (_ten, body) => {
    expect((await doi(5, body)).status).toBe(400);
  });

  test('THU_VIEC -> CHINH_THUC thành công và ghi nhật ký kèm lý do', async () => {
    const res = await doi(6, { trangThaiLamViec: 'CHINH_THUC', lyDo: 'Hết thử việc' });
    expect(res.status).toBe(200);
    expect(res.body.data.trangThaiLamViec).toBe('CHINH_THUC');
    const nk = await layNhatKy('DOI_TRANG_THAI_LAM_VIEC');
    expect(nk).toHaveLength(1);
    expect(nk[0].chiTiet).toContain('THU_VIEC -> CHINH_THUC');
    expect(nk[0].chiTiet).toContain('Hết thử việc');
  });

  test('DA_NGHI_VIEC khóa tài khoản, không đăng nhập được; quay lại làm việc thì mở khóa', async () => {
    const nghi = await doi(5, { trangThaiLamViec: 'DA_NGHI_VIEC', lyDo: 'Xin nghỉ' });
    expect(nghi.status).toBe(200);
    expect(nghi.body.data).toMatchObject({ trangThaiLamViec: 'DA_NGHI_VIEC', trangThaiTaiKhoan: 'KHOA' });
    expect(await trangThaiTaiKhoan(5)).toBe('KHOA');
    expect(await demNhatKy('KHOA_TAI_KHOAN_NGHI_VIEC', 5)).toBe(1);

    expect((await dangNhap('nhanvien')).status).toBe(403);
    expect((await goi('get', '/toi', token.nhanvien)).status).toBe(401);

    const quayLai = await doi(5, { trangThaiLamViec: 'CHINH_THUC' });
    expect(quayLai.status).toBe(200);
    expect(await trangThaiTaiKhoan(5)).toBe('DANG_HOAT_DONG');
    expect(await demNhatKy('MO_KHOA_TAI_KHOAN_NGHI_VIEC', 5)).toBe(1);
    expect((await dangNhap('nhanvien')).status).toBe(200);
  });

  test('quay lại làm việc không mở khóa nếu lần khóa gần nhất do Admin khóa vì lý do khác', async () => {
    expect((await doi(6, { trangThaiLamViec: 'DA_NGHI_VIEC' })).status).toBe(200);
    await pool.execute(
      "INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, diaChiIP, chiTiet) VALUES (6, 'KHOA_TAI_KHOAN', '127.0.0.1', 'test')"
    );
    expect((await doi(6, { trangThaiLamViec: 'THU_VIEC' })).status).toBe(200);
    expect(await trangThaiTaiKhoan(6)).toBe('KHOA');
  });

  test('quay lại làm việc khi vị trí cũ đã đủ định biên trả 409', async () => {
    expect((await doi(6, { trangThaiLamViec: 'DA_NGHI_VIEC' })).status).toBe(200);
    await datDinhBien(5, 1); // chỉ còn NV0005 giữ vị trí
    const res = await doi(6, { trangThaiLamViec: 'THU_VIEC' });
    expect(res.status).toBe(409);
    expect(await trangThaiTaiKhoan(6)).toBe('KHOA');
  });

  test('cho trưởng bộ phận (id 3) nghỉ việc trả 409, không khóa tài khoản', async () => {
    const res = await doi(3, { trangThaiLamViec: 'DA_NGHI_VIEC' });
    expect(res.status).toBe(409);
    expect(await trangThaiTaiKhoan(3)).toBe('DANG_HOAT_DONG');
  });

  test('HR cho người có vai trò Admin (id 1) nghỉ việc trả 403', async () => {
    const res = await doi(1, { trangThaiLamViec: 'DA_NGHI_VIEC' });
    expect(res.status).toBe(403);
    expect(await trangThaiTaiKhoan(1)).toBe('DANG_HOAT_DONG');
  });

  test.each([['giamDoc', 2], ['HR', 4]])('HR cho người có vai trò %s nghỉ việc trả 403', async (_vt, vaiTroId) => {
    const { nhanVien } = await taoNhanVien();
    await pool.execute('INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES (?, ?)', [nhanVien.nguoiDungId, vaiTroId]);
    const res = await doi(nhanVien.id, { trangThaiLamViec: 'DA_NGHI_VIEC' });
    expect(res.status).toBe(403);
    expect(await trangThaiTaiKhoan(nhanVien.nguoiDungId)).toBe('DANG_HOAT_DONG');
  });

  test('HR vẫn cho người có vai trò cấp cao tạm nghỉ (TAM_NGHI) được', async () => {
    expect((await doi(1, { trangThaiLamViec: 'TAM_NGHI' })).status).toBe(200);
    expect(await trangThaiTaiKhoan(1)).toBe('DANG_HOAT_DONG');
  });

  test('HR đổi trạng thái của chính mình trả 403', async () => {
    expect((await doi(4, { trangThaiLamViec: 'TAM_NGHI' })).status).toBe(403);
  });

  test.each(['admin', 'giamdoc', 'quanly', 'nhanvien'])('%s đổi trạng thái trả 403', async (ten) => {
    expect((await doi(6, { trangThaiLamViec: 'CHINH_THUC' }, token[ten])).status).toBe(403);
  });

  test('nhân viên không tồn tại trả 404', async () => {
    expect((await doi(99999, { trangThaiLamViec: 'TAM_NGHI' })).status).toBe(404);
  });

  // --- Bổ sung sau review lần 2: máy trạng thái TAM_NGHI ---
  test('vòng CHINH_THUC -> TAM_NGHI -> THU_VIEC bị chặn ở bước 2 (400), giữ nguyên TAM_NGHI', async () => {
    expect((await doi(5, { trangThaiLamViec: 'TAM_NGHI' })).status).toBe(200);
    const res = await doi(5, { trangThaiLamViec: 'THU_VIEC' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, code: 400, message: expect.stringContaining('TAM_NGHI'), data: null });
    const [dong] = await pool.execute('SELECT trangThaiLamViec FROM nhanvien WHERE id = 5');
    expect(dong[0].trangThaiLamViec).toBe('TAM_NGHI');
    expect(await demNhatKy('DOI_TRANG_THAI_LAM_VIEC')).toBe(1); // chỉ bước 1 được ghi
  });

  test('nhân viên thử việc tạm nghỉ cũng không quay về THU_VIEC được (400)', async () => {
    expect((await doi(6, { trangThaiLamViec: 'TAM_NGHI' })).status).toBe(200);
    expect((await doi(6, { trangThaiLamViec: 'THU_VIEC' })).status).toBe(400);
  });

  test.each(['CHINH_THUC', 'DA_NGHI_VIEC'])('TAM_NGHI -> %s hợp lệ (200)', async (dich) => {
    expect((await doi(5, { trangThaiLamViec: 'TAM_NGHI' })).status).toBe(200);
    const res = await doi(5, { trangThaiLamViec: dich });
    expect(res.status).toBe(200);
    expect(res.body.data.trangThaiLamViec).toBe(dich);
  });

  // --- Thu hồi token theo mốc khóa tài khoản do nghỉ việc ---
  test('token lấy trước khi khóa nghỉ việc vẫn 401 sau khi mở khóa; đăng nhập lại thì token mới dùng được', async () => {
    const dn = await dangNhap('nhanvien');
    expect(dn.status).toBe(200);
    const tokenCu = dn.body.data.token;
    expect((await goi('get', '/toi', tokenCu)).status).toBe(200);

    // Dung sai 1 giây trong kiemTraPhien: chờ > 2 giây để token chắc chắn cũ hơn mốc khóa
    await new Promise((r) => setTimeout(r, 2500));
    expect((await doi(5, { trangThaiLamViec: 'DA_NGHI_VIEC' })).status).toBe(200);
    expect(await demNhatKy('KHOA_TAI_KHOAN_NGHI_VIEC', 5)).toBe(1);
    expect((await doi(5, { trangThaiLamViec: 'CHINH_THUC' })).status).toBe(200);
    expect(await trangThaiTaiKhoan(5)).toBe('DANG_HOAT_DONG');

    const cu = await goi('get', '/toi', tokenCu);
    expect(cu.status).toBe(401);
    expect(cu.body).toEqual({ success: false, code: 401, message: expect.any(String), data: null });

    const dnLai = await dangNhap('nhanvien');
    expect(dnLai.status).toBe(200);
    const moi = await goi('get', '/toi', dnLai.body.data.token);
    expect(moi.status).toBe(200);
    expect(moi.body.data.id).toBe(5);
  }, 15000);
});

// ---------------------------------------------------------------------------
describe('Nhật ký che dữ liệu cá nhân (SĐT, địa chỉ, ngân hàng)', () => {
  async function hoSoGoc(id) {
    const [dong] = await pool.execute('SELECT soDienThoai, diaChi, tenNganHang FROM nhanvien WHERE id = ?', [id]);
    return dong[0];
  }
  function kiemTraChe(chiTiet, cu, moi) {
    expect(chiTiet).toContain(`soDienThoai: ${cu.soDienThoai ? `****${cu.soDienThoai.slice(-4)}` : 'trống'} -> ****${moi.soDienThoai.slice(-4)}`);
    expect(chiTiet).toContain('diaChi: đã thay đổi');
    expect(chiTiet).toContain('tenNganHang: đã thay đổi');
    for (const giaTri of [cu.soDienThoai, cu.diaChi, cu.tenNganHang, moi.soDienThoai, moi.diaChi, moi.tenNganHang]) {
      if (giaTri) expect(chiTiet).not.toContain(giaTri);
    }
  }
  const moi = { soDienThoai: '0911222333', diaChi: 'Số 99 Đường Kiểm Thử', tenNganHang: 'NganHangQA' };

  test('SUA_NHAN_VIEN: SĐT che còn 4 số cuối, địa chỉ và tên ngân hàng chỉ ghi "đã thay đổi"', async () => {
    const cu = await hoSoGoc(5);
    expect((await goi('patch', '/5', token.hr).send(moi)).status).toBe(200);
    const nk = await layNhatKy('SUA_NHAN_VIEN');
    expect(nk).toHaveLength(1);
    kiemTraChe(nk[0].chiTiet, cu, moi);
  });

  test('CAP_NHAT_HO_SO_CA_NHAN: SĐT che còn 4 số cuối, địa chỉ và tên ngân hàng chỉ ghi "đã thay đổi"', async () => {
    const cu = await hoSoGoc(5);
    expect((await goi('patch', '/toi', token.nhanvien).send(moi)).status).toBe(200);
    const nk = await layNhatKy('CAP_NHAT_HO_SO_CA_NHAN');
    expect(nk).toHaveLength(1);
    kiemTraChe(nk[0].chiTiet, cu, moi);
  });
});

describe('kiemTraDuLieu: toiThieu đo sau trim', () => {
  test('thêm nhân viên với họ tên "A   " trả 400', async () => {
    const res = await themNhanVien(duLieuMoi({ hoVaTen: 'A   ' }));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, code: 400, message: expect.stringMatching(/ít nhất 2/), data: null });
  });

  test('HR sửa họ tên thành "A   " trả 400, hồ sơ không đổi', async () => {
    const res = await goi('patch', '/5', token.hr).send({ hoVaTen: 'A   ' });
    expect(res.status).toBe(400);
    const [dong] = await pool.execute('SELECT hoVaTen FROM nhanvien WHERE id = 5');
    expect(dong[0].hoVaTen).toBe('Hoàng Văn Nam');
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/v1/nhanVien/:id/dieuChuyen', () => {
  const chuyen = (id, body, tk = token.hr) => goi('post', `/${id}/dieuChuyen`, tk).send(body);

  test('điều chuyển thành công sang Chuyên viên nhân sự (PNS) và ghi nhật ký', async () => {
    const res = await chuyen(5, { chucDanhPhongBanId: 2, lyDo: 'Theo nhu cầu' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 5, chucDanhPhongBanId: 2, phongBanId: 2 });
    const nk = await layNhatKy('DIEU_CHUYEN_NHAN_VIEN');
    expect(nk).toHaveLength(1);
    expect(nk[0].chiTiet).toContain('NV0005');
    expect(nk[0].chiTiet).toContain('Theo nhu cầu');
  });

  test('vị trí mới đã đủ định biên trả 409', async () => {
    const res = await chuyen(5, { chucDanhPhongBanId: 3 });
    expect(res.status).toBe(409);
    const [dong] = await pool.execute('SELECT chucDanhPhongBanId FROM nhanvien WHERE id = 5');
    expect(dong[0].chucDanhPhongBanId).toBe(5);
  });

  test('tái tuyển: vị trí cũ đã ngừng → điều chuyển người đã nghỉ việc rồi cho quay lại', async () => {
    await pool.execute("UPDATE nhanvien SET trangThaiLamViec = 'DA_NGHI_VIEC' WHERE id = 6");
    const [[{ chucDanhPhongBanId: viTriCu }]] = await pool.execute('SELECT chucDanhPhongBanId FROM nhanvien WHERE id = 6');
    await pool.execute("UPDATE chucdanhphongban SET trangThai = 'NGUNG_AP_DUNG' WHERE id = ?", [viTriCu]);
    try {
      expect((await goi('post', '/6/doiTrangThai', token.hr).send({ trangThaiLamViec: 'CHINH_THUC' })).status).toBe(409);
      expect((await chuyen(6, { chucDanhPhongBanId: 2 })).status).toBe(200);
      const res = await goi('post', '/6/doiTrangThai', token.hr).send({ trangThaiLamViec: 'CHINH_THUC' });
      expect(res.status).toBe(200);
      const [[nv]] = await pool.execute('SELECT chucDanhPhongBanId, trangThaiLamViec FROM nhanvien WHERE id = 6');
      expect(nv).toEqual({ chucDanhPhongBanId: 2, trangThaiLamViec: 'CHINH_THUC' });
    } finally {
      await pool.execute("UPDATE chucdanhphongban SET trangThai = 'DANG_AP_DUNG' WHERE id = ?", [viTriCu]);
    }
  });

  test('người đã nghỉ việc điều chuyển sang vị trí đủ định biên hoặc đã ngừng vẫn 409, không đổi dữ liệu', async () => {
    await pool.execute("UPDATE nhanvien SET trangThaiLamViec = 'DA_NGHI_VIEC' WHERE id = 6");
    const [[{ chucDanhPhongBanId: viTriCu }]] = await pool.execute('SELECT chucDanhPhongBanId FROM nhanvien WHERE id = 6');
    expect((await chuyen(6, { chucDanhPhongBanId: 3 })).status).toBe(409);
    await pool.execute("UPDATE chucdanhphongban SET trangThai = 'NGUNG_AP_DUNG' WHERE id = 2");
    try {
      expect((await chuyen(6, { chucDanhPhongBanId: 2 })).status).toBe(409);
    } finally {
      await pool.execute("UPDATE chucdanhphongban SET trangThai = 'DANG_AP_DUNG' WHERE id = 2");
    }
    const [[nv]] = await pool.execute('SELECT chucDanhPhongBanId, trangThaiLamViec FROM nhanvien WHERE id = 6');
    expect(nv).toEqual({ chucDanhPhongBanId: viTriCu, trangThaiLamViec: 'DA_NGHI_VIEC' });
    expect(await layNhatKy('DIEU_CHUYEN_NHAN_VIEN')).toHaveLength(0);
  });

  test('điều chuyển về đúng vị trí hiện tại trả 400', async () => {
    expect((await chuyen(5, { chucDanhPhongBanId: 5 })).status).toBe(400);
  });

  test('trưởng bộ phận PKT (id 3) rời phòng mình phụ trách trả 409', async () => {
    expect((await chuyen(3, { chucDanhPhongBanId: 2 })).status).toBe(409);
  });

  test.each([
    ['vị trí không tồn tại', { chucDanhPhongBanId: 99999 }, 404],
    ['vị trí sai định dạng', { chucDanhPhongBanId: 'abc' }, 400],
    ['thiếu vị trí', {}, 400],
  ])('%s trả %i', async (_ten, body, ma) => {
    expect((await chuyen(5, body)).status).toBe(ma);
  });

  test('HR tự điều chuyển mình trả 403', async () => {
    expect((await chuyen(4, { chucDanhPhongBanId: 5 })).status).toBe(403);
  });

  test.each(['admin', 'giamdoc', 'quanly', 'nhanvien'])('%s điều chuyển trả 403', async (ten) => {
    expect((await chuyen(6, { chucDanhPhongBanId: 2 }, token[ten])).status).toBe(403);
  });

  test('điều chuyển rồi đổi trạng thái liên tiếp (khóa phòng ban trước hồ sơ) vẫn đúng dữ liệu', async () => {
    const dc = await chuyen(6, { chucDanhPhongBanId: 2 });
    expect(dc.status).toBe(200);
    expect(dc.body.data).toMatchObject({ id: 6, chucDanhPhongBanId: 2, phongBanId: 2 });
    const tt = await goi('post', '/6/doiTrangThai', token.hr).send({ trangThaiLamViec: 'TAM_NGHI' });
    expect(tt.status).toBe(200);
    expect(tt.body.data).toMatchObject({ id: 6, trangThaiLamViec: 'TAM_NGHI', chucDanhPhongBanId: 2 });
    expect(await demNhatKy('DIEU_CHUYEN_NHAN_VIEN', 4)).toBe(1);
    expect(await demNhatKy('DOI_TRANG_THAI_LAM_VIEC', 4)).toBe(1);
  });

  test('điều chuyển và đổi trạng thái cùng một nhân viên song song: không 500, dữ liệu khớp kết quả', async () => {
    const [dc, tt] = await Promise.all([
      chuyen(6, { chucDanhPhongBanId: 2 }),
      goi('post', '/6/doiTrangThai', token.hr).send({ trangThaiLamViec: 'CHINH_THUC' }),
    ]);
    expect([200, 409]).toContain(dc.status);
    expect([200, 409]).toContain(tt.status);
    const [d] = await pool.execute('SELECT chucDanhPhongBanId, trangThaiLamViec FROM nhanvien WHERE id = 6');
    expect(d[0].chucDanhPhongBanId).toBe(dc.status === 200 ? 2 : 5);
    expect(d[0].trangThaiLamViec).toBe(tt.status === 200 ? 'CHINH_THUC' : 'THU_VIEC');
  });
});

// ---------------------------------------------------------------------------
// Seed nhiều người mỗi vai trò: hr2 (NV0007), giamdoc2 (NV0008), quanly2 (NV0009, trưởng PKD), nhanvien3 (NV0010, PKD)
describe('Nhiều người cùng vai trò', () => {
  test('quanly2 chỉ thấy nhân viên PKD (NV0009, NV0010), không thấy PKT', async () => {
    const res = await goi('get', '', token.quanly2);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((nv) => nv.maNhanVien).sort()).toEqual(['NV0009', 'NV0010']);
    expect(res.body.data.phanTrang.tongSo).toBe(2);
    expect((await goi('get', '/3', token.quanly2)).status).toBe(403);
    expect((await goi('get', '/5', token.quanly2)).status).toBe(403);
    expect((await goi('get', '?phongBanId=3', token.quanly2)).body.data.items).toEqual([]);
  });

  test('quanly (PKT) không thấy nhân viên PKD', async () => {
    const res = await goi('get', '', token.quanly);
    expect(res.status).toBe(200);
    const ma = res.body.data.items.map((nv) => nv.maNhanVien);
    expect(ma).not.toContain('NV0009');
    expect(ma).not.toContain('NV0010');
    expect((await goi('get', '/10', token.quanly)).status).toBe(403);
    expect((await goi('get', '/9', token.quanly)).status).toBe(403);
  });

  test('quanly2 xem nhanvien3 trong phạm vi bị ẩn ngân hàng', async () => {
    const res = await goi('get', '/10', token.quanly2);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 10, maNhanVien: 'NV0010' });
    expect(res.body.data).not.toHaveProperty('soTaiKhoanNganHang');
  });

  test.each([['hr2', 4, 7], ['hr', 7, 4]])('%s sửa được hồ sơ của HR khác (id %i) và ghi nhật ký', async (ten, id, nguoiDungId) => {
    const res = await goi('patch', `/${id}`, token[ten]).send({ diaChi: 'Quảng Nam' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200 });
    const [d] = await pool.execute('SELECT diaChi FROM nhanvien WHERE id = ?', [id]);
    expect(d[0].diaChi).toBe('Quảng Nam');
    expect(await demNhatKy('SUA_NHAN_VIEN', nguoiDungId)).toBe(1);
  });

  test('hr2 vẫn không tự sửa hồ sơ của chính mình (403)', async () => {
    expect((await goi('patch', '/7', token.hr2).send({ diaChi: 'Huế' })).status).toBe(403);
  });

  test('giamdoc2 xem được toàn công ty và chi tiết đầy đủ', async () => {
    const res = await goi('get', '?kichThuoc=100', token.giamdoc2);
    expect(res.status).toBe(200);
    const dsMa = await layMaToanCongTy();
    expect(res.body.data.phanTrang.tongSo).toBe(dsMa.length);
    expect(res.body.data.items.map((nv) => nv.maNhanVien)).toEqual(dsMa);
    const ct = await goi('get', '/10', token.giamdoc2);
    expect(ct.status).toBe(200);
    expect(ct.body.data).toHaveProperty('soTaiKhoanNganHang');
  });

  test('nhanvien3 không xem được hồ sơ đồng nghiệp cùng PKD', async () => {
    expect((await goi('get', '/9', token.nhanvien3)).status).toBe(403);
    expect((await goi('get', '/toi', token.nhanvien3)).body.data.id).toBe(10);
  });
});

// ---------------------------------------------------------------------------
describe('Chạy song song', () => {
  test('2 request thêm nhân viên cùng lúc vào vị trí chỉ còn 1 chỗ: chỉ 1 thành công', async () => {
    await datDinhBien(5, 3); // đang có NV0005, NV0006 -> còn đúng 1 chỗ
    const soNd = await demBang('nguoidung');
    const [a, b] = await Promise.all([themNhanVien(duLieuMoi()), themNhanVien(duLieuMoi())]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const [dem] = await pool.execute(
      "SELECT COUNT(*) AS n FROM nhanvien WHERE chucDanhPhongBanId = 5 AND trangThaiLamViec <> 'DA_NGHI_VIEC'"
    );
    expect(Number(dem[0].n)).toBe(3);
    const [nd] = await pool.execute('SELECT COUNT(*) AS n FROM nguoidung');
    expect(Number(nd[0].n)).toBe(soNd + 1); // bên thất bại phải rollback cả tài khoản
  });

  test('2 request thêm cùng lúc khi còn chỗ: cả hai thành công với mã khác nhau', async () => {
    const mong = [await maKeTiep(1), await maKeTiep(2)];
    const [a, b] = await Promise.all([themNhanVien(duLieuMoi()), themNhanVien(duLieuMoi())]);
    expect([a.status, b.status]).toEqual([201, 201]);
    const ma = [a.body.data.nhanVien.maNhanVien, b.body.data.nhanVien.maNhanVien].sort();
    expect(ma).toEqual(mong);
  });

  test('4 request thêm cùng lúc vào vị trí còn đúng 1 chỗ, lặp 3 vòng: mỗi vòng đúng 1 thành công, không 500', async () => {
    const demDangLam = async () => {
      const [d] = await pool.execute(
        "SELECT COUNT(*) AS n FROM nhanvien WHERE chucDanhPhongBanId = 5 AND trangThaiLamViec <> 'DA_NGHI_VIEC'"
      );
      return Number(d[0].n);
    };
    for (let vong = 0; vong < 3; vong += 1) {
      const truoc = await demDangLam();
      await datDinhBien(5, truoc + 1); // còn đúng 1 chỗ, tính từ CSDL
      const soNd = await demBang('nguoidung');
      const kq = await Promise.all([1, 2, 3, 4].map(() => themNhanVien(duLieuMoi())));
      const ma = kq.map((r) => r.status).sort();
      expect(ma).toEqual([201, 409, 409, 409]);
      for (const r of kq.filter((x) => x.status === 409)) {
        expect(r.body).toMatchObject({ success: false, code: 409, data: null });
      }
      expect(await demDangLam()).toBe(truoc + 1);
      expect(await demBang('nguoidung')).toBe(soNd + 1);
    }
  });
});
