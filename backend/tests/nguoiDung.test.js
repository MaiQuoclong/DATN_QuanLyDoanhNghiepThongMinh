const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const nguoiDungRepository = require('../src/repositories/nguoiDungRepository');

// Kiểm thử quản trị tài khoản (/nguoiDung, /vaiTro, /nhatKyHeThong) và các thay đổi xác thực
// (cookie httpOnly, X-Tra-Token, chặn Origin lạ). Mỗi test tự dọn: khôi phục nguoidung, nguoidungvaitro,
// nhanvien.trangThaiLamViec, xóa nhật ký phát sinh và đặt lại AUTO_INCREMENT.

jest.setTimeout(30000);

const MAT_KHAU = 'MatKhau@123';
const NGUON_HOP_LE = 'http://localhost:5173';
const NGUON_LA = 'http://evil.example.com';
const choMs = (ms) => new Promise((r) => setTimeout(r, ms));

let banSaoNguoiDung;
let banSaoVaiTro;
let banSaoNhanVien;
let idNhatKyMoc;
let idNguoiDungMoc;

function dangNhap(tenDangNhap, matKhau = MAT_KHAU, traToken = true) {
  const req = request(app).post('/api/v1/xacThuc/dangNhap');
  if (traToken) req.set('X-Tra-Token', '1');
  return req.send({ tenDangNhap, matKhau });
}
async function layToken(tenDangNhap, matKhau = MAT_KHAU) {
  const res = await dangNhap(tenDangNhap, matKhau);
  expect(res.status).toBe(200);
  return res.body.data.token;
}
const goi = (phuongThuc, duongDan, token) => {
  const req = request(app)[phuongThuc](`/api/v1${duongDan}`);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};
async function demNhatKy(nguoiDungId, hanhDong) {
  const [dong] = await pool.execute('SELECT COUNT(*) AS n FROM nhatkyhethong WHERE id > ? AND nguoiDungId = ? AND hanhDong = ?', [
    idNhatKyMoc,
    nguoiDungId,
    hanhDong,
  ]);
  return Number(dong[0].n);
}
async function layTrangThai(nguoiDungId) {
  const [dong] = await pool.execute('SELECT trangThai FROM nguoidung WHERE id = ?', [nguoiDungId]);
  return dong[0]?.trangThai;
}
async function layVaiTro(nguoiDungId) {
  return (await nguoiDungRepository.layDanhSachVaiTro(nguoiDungId)).sort();
}
async function ganVaiTroDb(nguoiDungId, maVaiTro) {
  await pool.execute('INSERT IGNORE INTO nguoidungvaitro (nguoiDungId, vaiTroId) SELECT ?, id FROM vaitro WHERE maVaiTro = ?', [
    nguoiDungId,
    maVaiTro,
  ]);
}
// Đếm từ CSDL để không phụ thuộc số lượng bản ghi seed
async function demSql(sql, thamSo = []) {
  const [dong] = await pool.execute(sql, thamSo);
  return Number(dong[0].n);
}
function layCookie(res) {
  return (res.headers['set-cookie'] || []).find((c) => c.startsWith('smartHrmToken='));
}

beforeEach(async () => {
  [banSaoNguoiDung] = await pool.execute('SELECT id, matKhauMaHoa, trangThai, lanDangNhapCuoi FROM nguoidung');
  [banSaoVaiTro] = await pool.execute('SELECT nguoiDungId, vaiTroId FROM nguoidungvaitro');
  [banSaoNhanVien] = await pool.execute('SELECT id, trangThaiLamViec FROM nhanvien');
  const [[nk]] = await pool.execute('SELECT COALESCE(MAX(id), 0) AS moc FROM nhatkyhethong');
  idNhatKyMoc = nk.moc;
  const [[nd]] = await pool.execute('SELECT COALESCE(MAX(id), 0) AS moc FROM nguoidung');
  idNguoiDungMoc = nd.moc;
});

afterEach(async () => {
  jest.restoreAllMocks();
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [idNhatKyMoc]);
  await pool.query('ALTER TABLE nhatkyhethong AUTO_INCREMENT = 1');
  await pool.execute('DELETE FROM nguoidungvaitro WHERE nguoiDungId > ?', [idNguoiDungMoc]);
  await pool.execute('DELETE FROM nguoidung WHERE id > ?', [idNguoiDungMoc]);
  await pool.query('ALTER TABLE nguoidung AUTO_INCREMENT = 1');
  for (const nd of banSaoNguoiDung) {
    await pool.execute('UPDATE nguoidung SET matKhauMaHoa = ?, trangThai = ?, lanDangNhapCuoi = ? WHERE id = ?', [
      nd.matKhauMaHoa,
      nd.trangThai,
      nd.lanDangNhapCuoi,
      nd.id,
    ]);
  }
  await pool.query('DELETE FROM nguoidungvaitro');
  await pool.query('INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES ?', [banSaoVaiTro.map((d) => [d.nguoiDungId, d.vaiTroId])]);
  for (const nv of banSaoNhanVien) {
    await pool.execute('UPDATE nhanvien SET trangThaiLamViec = ? WHERE id = ?', [nv.trangThaiLamViec, nv.id]);
  }
});

afterAll(() => pool.end());

// ---------------------------------------------------------------------------
describe('GET /api/v1/nguoiDung', () => {
  test('Admin lấy danh sách có phân trang chuẩn, vai trò dạng mảng, không lộ matKhauMaHoa', async () => {
    const res = await goi('get', '/nguoiDung', await layToken('admin'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200, message: expect.any(String) });
    const tongSo = await demSql('SELECT COUNT(*) AS n FROM nguoidung');
    expect(res.body.data.phanTrang).toEqual({ trang: 1, kichThuoc: 20, tongSo });
    const admin = res.body.data.items.find((x) => x.nguoiDungId === 1);
    expect(admin).toMatchObject({ tenDangNhap: 'admin', trangThai: 'DANG_HOAT_DONG', nhanVienId: 1 });
    expect(admin.vaiTro).toEqual(['Admin', 'nhanVien']);
    expect(JSON.stringify(res.body)).not.toMatch(/matKhauMaHoa|\$2[aby]\$/);
  });

  test('lọc theo tuKhoa (tên đăng nhập, họ tên, mã NV) và ký tự % được escape', async () => {
    const token = await layToken('admin');
    const theoTen = await goi('get', '/nguoiDung?tuKhoa=nhanvien2', token);
    expect(theoTen.body.data.items.map((x) => x.nguoiDungId)).toEqual([6]);
    const theoMa = await goi('get', '/nguoiDung?tuKhoa=NV0003', token);
    expect(theoMa.body.data.items.map((x) => x.nguoiDungId)).toEqual([3]);
    const theoHoTen = await goi('get', `/nguoiDung?tuKhoa=${encodeURIComponent('Phạm Thị Lan')}`, token);
    expect(theoHoTen.body.data.items.map((x) => x.nguoiDungId)).toEqual([4]);
    const phanTram = await goi('get', '/nguoiDung?tuKhoa=%25', token);
    expect(phanTram.status).toBe(200);
    expect(phanTram.body.data.items).toHaveLength(0);
  });

  test('lọc theo trangThai và vaiTro', async () => {
    const token = await layToken('admin');
    await pool.execute("UPDATE nguoidung SET trangThai = 'KHOA' WHERE id = 6");
    const khoa = await goi('get', '/nguoiDung?trangThai=KHOA', token);
    // Seed: tài khoản 12 (NV0012 đã nghỉ việc) sẵn KHOA
    const sapXep = (ds) => ds.sort((a, b) => a - b);
    expect(sapXep(khoa.body.data.items.map((x) => x.nguoiDungId))).toEqual([6, 12]);
    expect(khoa.body.data.phanTrang.tongSo).toBe(2);
    const hr = await goi('get', '/nguoiDung?vaiTro=HR', token);
    const [dsHr] = await pool.execute(
      "SELECT nv.nguoiDungId AS id FROM nguoidungvaitro nv JOIN vaitro v ON v.id = nv.vaiTroId WHERE v.maVaiTro = 'HR'",
    );
    const idHr = dsHr.map((d) => d.id).sort((a, b) => a - b);
    expect(idHr).toEqual(expect.arrayContaining([4, 7]));
    expect(hr.body.data.items.map((x) => x.nguoiDungId).sort((a, b) => a - b)).toEqual(idHr);
    const ketHop = await goi('get', '/nguoiDung?vaiTro=nhanVien&trangThai=DANG_HOAT_DONG', token);
    const soKetHop = await demSql(
      `SELECT COUNT(DISTINCT n.id) AS n FROM nguoidung n JOIN nguoidungvaitro nv ON nv.nguoiDungId = n.id
       JOIN vaitro v ON v.id = nv.vaiTroId WHERE v.maVaiTro = 'nhanVien' AND n.trangThai = 'DANG_HOAT_DONG'`,
    );
    expect(ketHop.body.data.phanTrang.tongSo).toBe(soKetHop);
  });

  test('phân trang trang=2&kichThuoc=2 và kichThuoc vượt 100 bị chặn về 100', async () => {
    const token = await layToken('admin');
    const res = await goi('get', '/nguoiDung?trang=2&kichThuoc=2', token);
    const tongSo = await demSql('SELECT COUNT(*) AS n FROM nguoidung');
    expect(res.body.data.phanTrang).toEqual({ trang: 2, kichThuoc: 2, tongSo });
    expect(res.body.data.items.map((x) => x.nguoiDungId)).toEqual([3, 4]);
    const lon = await goi('get', '/nguoiDung?kichThuoc=500', token);
    expect(lon.body.data.phanTrang.kichThuoc).toBe(100);
  });

  test.each([['trangThai=XYZ'], ['vaiTro=Boss'], ['trang=0'], ['trang=-1'], ['kichThuoc=abc'], ['trang=1.5']])(
    'tham số sai %s trả 400',
    async (q) => {
      const res = await goi('get', `/nguoiDung?${q}`, await layToken('admin'));
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, code: 400, message: expect.any(String), data: null });
    },
  );

  test('chưa đăng nhập trả 401', async () => {
    const res = await goi('get', '/nguoiDung');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: 401, data: null });
  });

  test.each(['giamdoc', 'quanly', 'hr', 'nhanvien'])('vai trò %s bị 403 ở danh sách và chi tiết', async (ten) => {
    const token = await layToken(ten);
    expect((await goi('get', '/nguoiDung', token)).status).toBe(403);
    expect((await goi('get', '/nguoiDung/1', token)).status).toBe(403);
  });
});

describe('GET /api/v1/nguoiDung/:id', () => {
  test('Admin xem chi tiết tài khoản kèm vai trò, không lộ mật khẩu', async () => {
    const res = await goi('get', '/nguoiDung/4', await layToken('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ nguoiDungId: 4, tenDangNhap: 'hr', nhanVienId: 4, maNhanVien: 'NV0004' });
    expect(res.body.data.vaiTro.sort()).toEqual(['HR', 'nhanVien']);
    expect(JSON.stringify(res.body)).not.toMatch(/matKhauMaHoa|\$2[aby]\$/);
  });

  test('id không tồn tại 404, id sai định dạng 400', async () => {
    const token = await layToken('admin');
    expect((await goi('get', '/nguoiDung/99999', token)).status).toBe(404);
    expect((await goi('get', '/nguoiDung/abc', token)).status).toBe(400);
    expect((await goi('get', '/nguoiDung/0', token)).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/v1/nguoiDung/:id/datLaiMatKhau', () => {
  test('Admin cấp mật khẩu tạm: no-store, đăng nhập bằng mật khẩu tạm có batBuocDoiMatKhau=true, ghi 2 nhật ký', async () => {
    const res = await goi('post', '/nguoiDung/2/datLaiMatKhau', await layToken('admin'));
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data).toEqual({ tenDangNhap: 'giamdoc', matKhauTam: expect.any(String), trangThai: 'DANG_HOAT_DONG' });
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);

    expect((await dangNhap('giamdoc')).status).toBe(401); // mật khẩu cũ hết dùng được
    const moi = await dangNhap('giamdoc', res.body.data.matKhauTam);
    expect(moi.status).toBe(200);
    expect(moi.body.data.nguoiDung.batBuocDoiMatKhau).toBe(true);
    // Đang dùng mật khẩu tạm: API nghiệp vụ bị chặn 403
    expect((await goi('get', '/nhatKyHeThong', moi.body.data.token)).status).toBe(403);

    expect(await demNhatKy(2, 'RESET_MAT_KHAU_TAM')).toBe(1);
    expect(await demNhatKy(1, 'CAP_MAT_KHAU_TAM')).toBe(1);
  });

  test('token cũ của người bị reset bị thu hồi (401)', async () => {
    const tokenCu = await layToken('nhanvien2');
    await choMs(2500);
    const res = await goi('post', '/nguoiDung/6/datLaiMatKhau', await layToken('admin'));
    expect(res.status).toBe(200);
    const toi = await goi('get', '/xacThuc/toi', tokenCu);
    expect(toi.status).toBe(401);
    expect(toi.body).toMatchObject({ success: false, code: 401, data: null });
  });

  test.each([
    ['quanly', 3],
    ['nhanvien', 5],
  ])('HR reset được tài khoản %s', async (ten, id) => {
    const res = await goi('post', `/nguoiDung/${id}/datLaiMatKhau`, await layToken('hr'));
    expect(res.status).toBe(200);
    expect(res.body.data.tenDangNhap).toBe(ten);
    expect(await demNhatKy(id, 'RESET_MAT_KHAU_TAM')).toBe(1);
    expect(await demNhatKy(4, 'CAP_MAT_KHAU_TAM')).toBe(1);
  });

  test.each([
    ['admin', 1],
    ['giamdoc', 2],
  ])('HR reset tài khoản %s bị 403, mật khẩu không đổi', async (ten, id) => {
    const res = await goi('post', `/nguoiDung/${id}/datLaiMatKhau`, await layToken('hr'));
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: 403, data: null });
    expect((await dangNhap(ten)).status).toBe(200);
    expect(await demNhatKy(id, 'RESET_MAT_KHAU_TAM')).toBe(0);
  });

  test('HR reset tài khoản HR khác bị 403', async () => {
    await ganVaiTroDb(6, 'HR');
    const res = await goi('post', '/nguoiDung/6/datLaiMatKhau', await layToken('hr'));
    expect(res.status).toBe(403);
    expect(await demNhatKy(6, 'RESET_MAT_KHAU_TAM')).toBe(0);
  });

  test.each([
    ['admin', 1],
    ['hr', 4],
  ])('%s tự reset mình bị 403', async (ten, id) => {
    const res = await goi('post', `/nguoiDung/${id}/datLaiMatKhau`, await layToken(ten));
    expect(res.status).toBe(403);
    expect(await demNhatKy(id, 'RESET_MAT_KHAU_TAM')).toBe(0);
  });

  test('tài khoản không tồn tại 404, id sai 400', async () => {
    const token = await layToken('admin');
    expect((await goi('post', '/nguoiDung/99999/datLaiMatKhau', token)).status).toBe(404);
    expect((await goi('post', '/nguoiDung/abc/datLaiMatKhau', token)).status).toBe(400);
  });

  test.each(['giamdoc', 'quanly', 'nhanvien'])('vai trò %s gọi datLaiMatKhau bị 403', async (ten) => {
    expect((await goi('post', '/nguoiDung/6/datLaiMatKhau', await layToken(ten))).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/v1/nguoiDung/:id/khoa và /moKhoa', () => {
  test('Admin khóa rồi mở khóa: trạng thái đổi, ghi nhật ký theo người bị tác động', async () => {
    const token = await layToken('admin');
    const khoa = await goi('post', '/nguoiDung/6/khoa', token).send({ lyDo: 'Nghi lộ mật khẩu' });
    expect(khoa.status).toBe(200);
    expect(khoa.body.data).toMatchObject({ nguoiDungId: 6, trangThai: 'KHOA' });
    expect(await layTrangThai(6)).toBe('KHOA');
    expect(await demNhatKy(6, 'KHOA_TAI_KHOAN')).toBe(1);
    expect((await dangNhap('nhanvien2')).status).toBe(403);

    const mo = await goi('post', '/nguoiDung/6/moKhoa', token).send({});
    expect(mo.status).toBe(200);
    expect(mo.body.data.trangThai).toBe('DANG_HOAT_DONG');
    expect(await demNhatKy(6, 'MO_KHOA_TAI_KHOAN')).toBe(1);
    expect((await dangNhap('nhanvien2')).status).toBe(200);
  });

  test('khóa lần 2 trả 400, mở khóa tài khoản đang hoạt động trả 400', async () => {
    const token = await layToken('admin');
    expect((await goi('post', '/nguoiDung/5/moKhoa', token)).status).toBe(400);
    expect((await goi('post', '/nguoiDung/5/khoa', token)).status).toBe(200);
    const lan2 = await goi('post', '/nguoiDung/5/khoa', token);
    expect(lan2.status).toBe(400);
    expect(await demNhatKy(5, 'KHOA_TAI_KHOAN')).toBe(1);
  });

  test('Admin tự khóa/tự mở khóa mình bị 403', async () => {
    const token = await layToken('admin');
    expect((await goi('post', '/nguoiDung/1/khoa', token)).status).toBe(403);
    expect((await goi('post', '/nguoiDung/1/moKhoa', token)).status).toBe(403);
    expect(await layTrangThai(1)).toBe('DANG_HOAT_DONG');
  });

  test('khóa Admin khác khi còn 2 Admin hoạt động thành công', async () => {
    await ganVaiTroDb(2, 'Admin');
    const res = await goi('post', '/nguoiDung/2/khoa', await layToken('admin'));
    expect(res.status).toBe(200);
    expect(await layTrangThai(2)).toBe('KHOA');
  });

  test('khóa Admin hoạt động cuối cùng trả 409 và rollback (giả lập bộ đếm Admin = 1)', async () => {
    // Bình thường không chạm được nhánh này qua API (người gọi cũng là Admin hoạt động) nên giả lập bộ đếm
    await ganVaiTroDb(2, 'Admin');
    const token = await layToken('admin');
    jest.spyOn(nguoiDungRepository, 'demAdminHoatDong').mockResolvedValue(1);
    const res = await goi('post', '/nguoiDung/2/khoa', token);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 409, data: null });
    expect(await layTrangThai(2)).toBe('DANG_HOAT_DONG');
    expect(await demNhatKy(2, 'KHOA_TAI_KHOAN')).toBe(0);
  });

  test('token cũ bị thu hồi sau khi khóa, kể cả khi đã mở khóa lại', async () => {
    const tokenCu = await layToken('nhanvien2');
    await choMs(2500);
    const token = await layToken('admin');
    expect((await goi('post', '/nguoiDung/6/khoa', token)).status).toBe(200);
    expect((await goi('get', '/xacThuc/toi', tokenCu)).status).toBe(401);
    expect((await goi('post', '/nguoiDung/6/moKhoa', token)).status).toBe(200);
    expect((await goi('get', '/xacThuc/toi', tokenCu)).status).toBe(401);
    // Đăng nhập lại sau khi mở khóa thì dùng được
    expect((await goi('get', '/xacThuc/toi', await layToken('nhanvien2'))).status).toBe(200);
  });

  test('mở khóa người DA_NGHI_VIEC trả 409', async () => {
    await pool.execute("UPDATE nhanvien SET trangThaiLamViec = 'DA_NGHI_VIEC' WHERE id = 6");
    await pool.execute("UPDATE nguoidung SET trangThai = 'KHOA' WHERE id = 6");
    const res = await goi('post', '/nguoiDung/6/moKhoa', await layToken('admin'));
    expect(res.status).toBe(409);
    expect(await layTrangThai(6)).toBe('KHOA');
    expect(await demNhatKy(6, 'MO_KHOA_TAI_KHOAN')).toBe(0);
  });

  test('lyDo quá 200 ký tự trả 400; tài khoản không tồn tại 404', async () => {
    const token = await layToken('admin');
    expect((await goi('post', '/nguoiDung/6/khoa', token).send({ lyDo: 'x'.repeat(201) })).status).toBe(400);
    expect((await goi('post', '/nguoiDung/99999/khoa', token)).status).toBe(404);
    expect((await goi('post', '/nguoiDung/99999/moKhoa', token)).status).toBe(404);
    expect(await layTrangThai(6)).toBe('DANG_HOAT_DONG');
  });

  test.each(['giamdoc', 'quanly', 'hr', 'nhanvien'])('vai trò %s khóa/mở khóa bị 403', async (ten) => {
    const token = await layToken(ten);
    expect((await goi('post', '/nguoiDung/6/khoa', token)).status).toBe(403);
    expect((await goi('post', '/nguoiDung/6/moKhoa', token)).status).toBe(403);
  });

  test('Admin khóa -> HR cho nghỉ việc -> HR cho quay lại: tài khoản KHÔNG tự mở khóa', async () => {
    const tokenAdmin = await layToken('admin');
    const tokenHr = await layToken('hr');
    expect((await goi('post', '/nguoiDung/6/khoa', tokenAdmin)).status).toBe(200);
    const nghi = await goi('post', '/nhanVien/6/doiTrangThai', tokenHr).send({ trangThaiLamViec: 'DA_NGHI_VIEC' });
    expect(nghi.status).toBe(200);
    expect(await demNhatKy(6, 'KHOA_TAI_KHOAN_NGHI_VIEC')).toBe(0); // đã khóa sẵn, không khóa đè
    const quayLai = await goi('post', '/nhanVien/6/doiTrangThai', tokenHr).send({ trangThaiLamViec: 'THU_VIEC' });
    expect(quayLai.status).toBe(200);
    expect(await layTrangThai(6)).toBe('KHOA');
    expect(await demNhatKy(6, 'MO_KHOA_TAI_KHOAN_NGHI_VIEC')).toBe(0);
    // Admin mở khóa thủ công được vì đã quay lại làm việc
    expect((await goi('post', '/nguoiDung/6/moKhoa', tokenAdmin)).status).toBe(200);
  });

  test.each(['DA_NGHI_VIEC', 'TAM_NGHI'])(
    'song song: Admin khóa cùng lúc HR đổi trạng thái %s, lặp 3 vòng: không 500, cuối cùng KHOA và trạng thái làm việc khớp',
    async (trangThaiMoi) => {
      const tokenAdmin = await layToken('admin');
      const tokenHr = await layToken('hr');
      for (let vong = 0; vong < 3; vong += 1) {
        await pool.execute("UPDATE nhanvien SET trangThaiLamViec = 'THU_VIEC' WHERE id = 6");
        await pool.execute("UPDATE nguoidung SET trangThai = 'DANG_HOAT_DONG' WHERE id = 6");
        const [khoa, doi] = await Promise.all([
          goi('post', '/nguoiDung/6/khoa', tokenAdmin).send({ lyDo: 'Kiểm thử song song' }),
          goi('post', '/nhanVien/6/doiTrangThai', tokenHr).send({ trangThaiLamViec: trangThaiMoi }),
        ]);
        // 400 = tài khoản đã bị khóa trước đó (nghỉ việc chạy trước tự khóa)
        expect([200, 400, 409]).toContain(khoa.status);
        expect([200, 409]).toContain(doi.status);
        const [nv] = await pool.execute('SELECT trangThaiLamViec FROM nhanvien WHERE id = 6');
        expect(nv[0].trangThaiLamViec).toBe(doi.status === 200 ? trangThaiMoi : 'THU_VIEC');
        // Cả khóa tay và nghỉ việc đều dẫn tới KHOA; TAM_NGHI chỉ khóa nếu Admin khóa thành công
        if (khoa.status === 400) expect(doi.status === 200 && trangThaiMoi === 'DA_NGHI_VIEC').toBe(true);
        if (khoa.status === 200 || (doi.status === 200 && trangThaiMoi === 'DA_NGHI_VIEC')) {
          expect(await layTrangThai(6)).toBe('KHOA');
        }
      }
    },
  );
});

// ---------------------------------------------------------------------------
describe('PUT /api/v1/nguoiDung/:id/vaiTro', () => {
  test('thay toàn bộ vai trò, tự giữ nhanVien khi có hồ sơ, ghi PHAN_QUYEN', async () => {
    const res = await goi('put', '/nguoiDung/6/vaiTro', await layToken('admin')).send({ vaiTro: ['quanLy', 'quanLy'] });
    expect(res.status).toBe(200);
    expect(res.body.data.vaiTro.sort()).toEqual(['nhanVien', 'quanLy']);
    expect(await layVaiTro(6)).toEqual(['nhanVien', 'quanLy']);
    expect(await demNhatKy(1, 'PHAN_QUYEN')).toBe(1);
    const [[nk]] = await pool.execute("SELECT chiTiet FROM nhatkyhethong WHERE id > ? AND hanhDong = 'PHAN_QUYEN'", [idNhatKyMoc]);
    expect(nk.chiTiet).toMatch(/nhanvien2/);
  });

  test('gỡ vai trò cũ: HR -> mảng rỗng còn lại nhanVien', async () => {
    const res = await goi('put', '/nguoiDung/4/vaiTro', await layToken('admin')).send({ vaiTro: [] });
    expect(res.status).toBe(200);
    expect(await layVaiTro(4)).toEqual(['nhanVien']);
  });

  test('tài khoản không có hồ sơ: mảng rỗng trả 400, không xóa vai trò', async () => {
    const [kq] = await pool.execute(
      "INSERT INTO nguoidung (tenDangNhap, email, matKhauMaHoa) VALUES ('qaTam', 'qatam@smarthrm.local', 'x')",
    );
    await ganVaiTroDb(kq.insertId, 'giamDoc');
    const token = await layToken('admin');
    const rong = await goi('put', `/nguoiDung/${kq.insertId}/vaiTro`, token).send({ vaiTro: [] });
    expect(rong.status).toBe(400);
    expect(await layVaiTro(kq.insertId)).toEqual(['giamDoc']);
    const ok = await goi('put', `/nguoiDung/${kq.insertId}/vaiTro`, token).send({ vaiTro: ['HR'] });
    expect(ok.status).toBe(200);
    expect(await layVaiTro(kq.insertId)).toEqual(['HR']); // không có hồ sơ -> không thêm nhanVien
  });

  test.each([[{ vaiTro: 'HR' }], [{ vaiTro: ['Boss'] }], [{ vaiTro: ['HR', 'admin'] }], [{ vaiTro: [1] }], [{}], [{ vaiTro: null }]])(
    'dữ liệu sai %j trả 400, vai trò không đổi',
    async (body) => {
      const res = await goi('put', '/nguoiDung/6/vaiTro', await layToken('admin')).send(body);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, code: 400, data: null });
      expect(await layVaiTro(6)).toEqual(['nhanVien']);
    },
  );

  test('Admin tự gỡ vai trò Admin của mình bị 403', async () => {
    const res = await goi('put', '/nguoiDung/1/vaiTro', await layToken('admin')).send({ vaiTro: ['HR'] });
    expect(res.status).toBe(403);
    expect(await layVaiTro(1)).toEqual(['Admin', 'nhanVien']);
  });

  test('Admin tự cấp thêm vai trò cho mình bị 403, giữ nguyên vai trò thì được', async () => {
    const res = await goi('put', '/nguoiDung/1/vaiTro', await layToken('admin')).send({ vaiTro: ['Admin', 'HR'] });
    expect(res.status).toBe(403);
    expect(await layVaiTro(1)).toEqual(['Admin', 'nhanVien']);
    const res2 = await goi('put', '/nguoiDung/1/vaiTro', await layToken('admin')).send({ vaiTro: ['Admin'] });
    expect(res2.status).toBe(200);
    expect(await layVaiTro(1)).toEqual(['Admin', 'nhanVien']);
  });

  test('Admin tự bớt vai trò không phải Admin (HR) của mình thì được', async () => {
    await pool.execute("INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) SELECT 1, id FROM vaitro WHERE maVaiTro = 'HR'");
    try {
      expect(await layVaiTro(1)).toEqual(['Admin', 'HR', 'nhanVien']);
      const res = await goi('put', '/nguoiDung/1/vaiTro', await layToken('admin')).send({ vaiTro: ['Admin'] });
      expect(res.status).toBe(200);
      expect(await layVaiTro(1)).toEqual(['Admin', 'nhanVien']);
    } finally {
      await pool.execute("DELETE FROM nguoidungvaitro WHERE nguoiDungId = 1 AND vaiTroId = (SELECT id FROM vaitro WHERE maVaiTro = 'HR')");
    }
  });

  test('gỡ Admin cuối cùng trả 409 và rollback (giả lập bộ đếm Admin = 1)', async () => {
    await ganVaiTroDb(2, 'Admin');
    const token = await layToken('admin');
    jest.spyOn(nguoiDungRepository, 'demAdminHoatDong').mockResolvedValue(1);
    const res = await goi('put', '/nguoiDung/2/vaiTro', token).send({ vaiTro: ['giamDoc'] });
    expect(res.status).toBe(409);
    expect(await layVaiTro(2)).toEqual(['Admin', 'giamDoc', 'nhanVien']);
    expect(await demNhatKy(1, 'PHAN_QUYEN')).toBe(0);
  });

  test('gỡ Admin khỏi Admin thứ hai khi còn 2 Admin hoạt động thành công', async () => {
    await ganVaiTroDb(2, 'Admin');
    const res = await goi('put', '/nguoiDung/2/vaiTro', await layToken('admin')).send({ vaiTro: ['giamDoc'] });
    expect(res.status).toBe(200);
    expect(await layVaiTro(2)).toEqual(['giamDoc', 'nhanVien']);
  });

  test('vai trò mới có hiệu lực ngay ở request kế tiếp với token cũ', async () => {
    const tokenNv = await layToken('nhanvien2');
    expect((await goi('get', '/vaiTro', tokenNv)).status).toBe(403);
    const tokenAdmin = await layToken('admin');
    expect((await goi('put', '/nguoiDung/6/vaiTro', tokenAdmin).send({ vaiTro: ['Admin'] })).status).toBe(200);
    expect((await goi('get', '/vaiTro', tokenNv)).status).toBe(200);
    expect((await goi('put', '/nguoiDung/6/vaiTro', tokenAdmin).send({ vaiTro: [] })).status).toBe(200);
    expect((await goi('get', '/vaiTro', tokenNv)).status).toBe(403);
  });

  test('tài khoản không tồn tại 404; vai trò khác Admin bị 403', async () => {
    expect((await goi('put', '/nguoiDung/99999/vaiTro', await layToken('admin')).send({ vaiTro: ['HR'] })).status).toBe(404);
    const res = await goi('put', '/nguoiDung/6/vaiTro', await layToken('hr')).send({ vaiTro: ['HR'] });
    expect(res.status).toBe(403);
    expect(await layVaiTro(6)).toEqual(['nhanVien']);
  });
});

// ---------------------------------------------------------------------------
describe('GET /api/v1/vaiTro', () => {
  test('Admin lấy đủ 5 vai trò', async () => {
    const res = await goi('get', '/vaiTro', await layToken('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.map((v) => v.maVaiTro)).toEqual(['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien']);
  });

  test.each(['giamdoc', 'quanly', 'hr', 'nhanvien'])('vai trò %s bị 403', async (ten) => {
    expect((await goi('get', '/vaiTro', await layToken(ten))).status).toBe(403);
  });

  test('chưa đăng nhập 401', async () => {
    expect((await goi('get', '/vaiTro')).status).toBe(401);
  });
});

describe('GET /api/v1/nhatKyHeThong', () => {
  test.each(['admin', 'giamdoc'])('%s xem được nhật ký có phân trang', async (ten) => {
    const res = await goi('get', '/nhatKyHeThong?kichThuoc=5', await layToken(ten));
    expect(res.status).toBe(200);
    expect(res.body.data.phanTrang).toMatchObject({ trang: 1, kichThuoc: 5, tongSo: expect.any(Number) });
    expect(res.body.data.items.length).toBeLessThanOrEqual(5);
  });

  test.each(['quanly', 'hr', 'nhanvien'])('vai trò %s bị 403', async (ten) => {
    expect((await goi('get', '/nhatKyHeThong', await layToken(ten))).status).toBe(403);
  });

  test('lọc theo nguoiDungId, hanhDong, tuNgay/denNgay', async () => {
    await pool.execute(
      "INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, diaChiIP, thoiGianTao) VALUES (6, 'QA_KIEM_THU', '127.0.0.1', '2020-05-10 08:00:00')",
    );
    const token = await layToken('admin');
    const theoNguoi = await goi('get', '/nhatKyHeThong?nguoiDungId=6&hanhDong=QA_KIEM_THU', token);
    expect(theoNguoi.body.data.items).toHaveLength(1);
    expect(theoNguoi.body.data.items[0]).toMatchObject({ nguoiDungId: 6, tenDangNhap: 'nhanvien2', hanhDong: 'QA_KIEM_THU' });
    const trongKhoang = await goi('get', '/nhatKyHeThong?hanhDong=QA_KIEM_THU&tuNgay=2020-05-10&denNgay=2020-05-10', token);
    expect(trongKhoang.body.data.phanTrang.tongSo).toBe(1);
    const ngoaiKhoang = await goi('get', '/nhatKyHeThong?hanhDong=QA_KIEM_THU&tuNgay=2020-05-11', token);
    expect(ngoaiKhoang.body.data.phanTrang.tongSo).toBe(0);
    const truoc = await goi('get', '/nhatKyHeThong?hanhDong=QA_KIEM_THU&denNgay=2020-05-09', token);
    expect(truoc.body.data.phanTrang.tongSo).toBe(0);
    const nguoiKhac = await goi('get', '/nhatKyHeThong?nguoiDungId=5&hanhDong=QA_KIEM_THU', token);
    expect(nguoiKhac.body.data.phanTrang.tongSo).toBe(0);
  });

  test.each([['tuNgay=2026-13-01'], ['denNgay=abc'], ['tuNgay=2026-02-30'], ['nguoiDungId=abc'], ['trang=0']])(
    'tham số sai %s trả 400',
    async (q) => {
      const res = await goi('get', `/nhatKyHeThong?${q}`, await layToken('admin'));
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, code: 400, data: null });
    },
  );
});

// ---------------------------------------------------------------------------
describe('Xác thực bằng cookie httpOnly và X-Tra-Token', () => {
  test('đăng nhập không có X-Tra-Token: body không có token, Set-Cookie HttpOnly/SameSite=Strict/Path=/api, no-store', async () => {
    const res = await dangNhap('nhanvien', MAT_KHAU, false);
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeUndefined();
    expect(res.body.data.nguoiDung.tenDangNhap).toBe('nhanvien');
    expect(res.headers['cache-control']).toBe('no-store');
    const cookie = layCookie(res);
    expect(cookie).toMatch(/^smartHrmToken=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+;/);
    expect(cookie).toMatch(/; HttpOnly/i);
    expect(cookie).toMatch(/; SameSite=Strict/i);
    expect(cookie).toMatch(/; Path=\/api(;|$)/);
  });

  test('X-Tra-Token khác "1" cũng không trả token', async () => {
    const res = await request(app)
      .post('/api/v1/xacThuc/dangNhap')
      .set('X-Tra-Token', 'true')
      .send({ tenDangNhap: 'nhanvien', matKhau: MAT_KHAU });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeUndefined();
  });

  test('đổi mật khẩu không có X-Tra-Token: body không có token, có Set-Cookie mới, no-store', async () => {
    const token = await layToken('nhanvien2');
    const res = await goi('post', '/xacThuc/doiMatKhau', token).send({ matKhauCu: MAT_KHAU, matKhauMoi: 'QaMatKhau2026' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
    expect(layCookie(res)).toMatch(/HttpOnly/i);
    // Cookie mới dùng được ngay
    const cookie = layCookie(res).split(';')[0];
    expect((await request(app).get('/api/v1/xacThuc/toi').set('Cookie', cookie)).status).toBe(200);
  });

  test('gọi API chỉ bằng cookie (không Bearer) hoạt động, phân quyền vẫn áp dụng', async () => {
    const cookieAdmin = layCookie(await dangNhap('admin', MAT_KHAU, false)).split(';')[0];
    const toi = await request(app).get('/api/v1/xacThuc/toi').set('Cookie', `khac=1; ${cookieAdmin}`);
    expect(toi.status).toBe(200);
    expect(toi.body.data.nguoiDungId).toBe(1);
    expect((await request(app).get('/api/v1/nguoiDung').set('Cookie', cookieAdmin)).status).toBe(200);
    const cookieNv = layCookie(await dangNhap('nhanvien', MAT_KHAU, false)).split(';')[0];
    expect((await request(app).get('/api/v1/nguoiDung').set('Cookie', cookieNv)).status).toBe(403);
  });

  test.each([
    ['smartHrmToken=rac'],
    ['smartHrmToken=a.b.c'],
    ['smartHrmToken='],
    ['smartHrmToken=%E0%A4%A'],
    ['smartHrmToken=eyJhbGciOiJIUzI1NiJ9.eyJub3QiOiJqc29uIn0.xyz;'],
    ['=;;smartHrmToken'],
    ['smartHrmToken=<script>alert(1)</script>'],
  ])('cookie rác %s trả 401 (không 500)', async (cookie) => {
    const res = await request(app).get('/api/v1/xacThuc/toi').set('Cookie', cookie);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, code: 401, message: expect.any(String), data: null });
  });

  test('dangXuat bằng cookie hợp lệ: 200, ghi DANG_XUAT và xóa cookie', async () => {
    const cookie = layCookie(await dangNhap('nhanvien', MAT_KHAU, false)).split(';')[0];
    const res = await request(app).post('/api/v1/xacThuc/dangXuat').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200, data: null });
    expect(await demNhatKy(5, 'DANG_XUAT')).toBe(1);
    const xoa = layCookie(res);
    expect(xoa).toMatch(/^smartHrmToken=;/);
    expect(xoa).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(xoa).toMatch(/Path=\/api/);
  });
});

describe('Chặn Origin lạ cho request ghi', () => {
  test('POST đăng nhập với Origin lạ trả 403 chuẩn, không ghi nhật ký đăng nhập', async () => {
    const res = await request(app)
      .post('/api/v1/xacThuc/dangNhap')
      .set('Origin', NGUON_LA)
      .send({ tenDangNhap: 'nhanvien', matKhau: MAT_KHAU });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, code: 403, message: expect.any(String), data: null });
    expect(layCookie(res)).toBeUndefined();
    expect(await demNhatKy(5, 'DANG_NHAP')).toBe(0);
  });

  test.each(['http://localhost:5174', 'http://localhost', 'null'])('Origin gần giống %s cũng bị 403', async (nguon) => {
    const res = await request(app)
      .post('/api/v1/xacThuc/dangNhap')
      .set('Origin', nguon)
      .send({ tenDangNhap: 'nhanvien', matKhau: MAT_KHAU });
    expect(res.status).toBe(403);
  });

  test('PUT và PATCH với Origin lạ bị 403 dù token Admin hợp lệ, dữ liệu không đổi', async () => {
    const token = await layToken('admin');
    const put = await goi('put', '/nguoiDung/6/vaiTro', token)
      .set('Origin', NGUON_LA)
      .send({ vaiTro: ['HR'] });
    expect(put.status).toBe(403);
    expect(await layVaiTro(6)).toEqual(['nhanVien']);
    const patch = await goi('patch', '/nhanVien/toi', token).set('Origin', NGUON_LA).send({ diaChi: 'Hà Nội' });
    expect(patch.status).toBe(403);
    const khoa = await goi('post', '/nguoiDung/6/khoa', token).set('Origin', NGUON_LA);
    expect(khoa.status).toBe(403);
    expect(await layTrangThai(6)).toBe('DANG_HOAT_DONG');
  });

  test('Origin hợp lệ http://localhost:5173 hoặc không có Origin hoạt động bình thường', async () => {
    const coNguon = await request(app)
      .post('/api/v1/xacThuc/dangNhap')
      .set('Origin', NGUON_HOP_LE)
      .send({ tenDangNhap: 'nhanvien', matKhau: MAT_KHAU });
    expect(coNguon.status).toBe(200);
    expect(coNguon.headers['access-control-allow-origin']).toBe(NGUON_HOP_LE);
    expect(coNguon.headers['access-control-allow-credentials']).toBe('true');
    expect((await dangNhap('nhanvien')).status).toBe(200);
  });

  test('GET với Origin lạ không bị lớp chặn Origin từ chối (CORS không cấp header cho origin lạ)', async () => {
    const res = await goi('get', '/nguoiDung', await layToken('admin')).set('Origin', NGUON_LA);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
