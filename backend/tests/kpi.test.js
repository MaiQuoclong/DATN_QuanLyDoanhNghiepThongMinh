const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const { xepLoaiTheoDiem } = require('../src/services/kpiService');

// Dữ liệu mẫu (database/seed.sql mục 13): kỳ 1 DA_DONG, kỳ 2 DANG_MO; phiếu 8/9/10 CHO_DUYET, 11/12/13 BAN_NHAP.
// Test không đụng dữ liệu seed: mỗi test tự mở một kỳ riêng (năm 2030+) và dọn sạch trong afterEach.
// NV0005 (nhanvien, vị trí 5 PKT-PT) có chỉ tiêu 1 (w1), 2 (w1), 3 (w3), 4 (w2) -> tổng trọng số 7.
const MAT_KHAU = 'MatKhau@123';
const NV_NHANVIEN = 5;
const NV_NHANVIEN2 = 6;
const NV_NHANVIEN3 = 10;
const NV_QUANLY = 3;

const token = {};
let anhChup;
let mocNhatKy;
let demKy = 0;

function dangNhap(tenDangNhap) {
  return request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap, matKhau: MAT_KHAU });
}
const goi = (phuongThuc, duongDan, tk) => {
  const r = request(app)[phuongThuc](`/api/v1${duongDan}`);
  return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
};

async function moKy() {
  demKy += 1;
  const nam = 2030 + demKy;
  const res = await goi('post', '/kyDanhGiaKPI', token.hr).send({
    tenKyDanhGia: `QA KPI ${Date.now() % 100000}-${demKy}`,
    ngayBatDau: `${nam}-01-01`,
    ngayKetThuc: `${nam}-03-31`,
  });
  expect(res.status).toBe(201);
  return res.body.data;
}
async function taoPhieu(kyId, nhanVienId = NV_NHANVIEN, tk = token.hr) {
  const res = await goi('post', '/phieuDanhGiaKPI', tk).send({ kyDanhGiaId: kyId, nhanVienId });
  expect(res.status).toBe(201);
  return res.body.data;
}
// Nhân viên tự chấm đủ rồi gửi -> CHO_DUYET
async function phieuChoDuyet(kyId, nhanVienId = NV_NHANVIEN, tkNhanVien = token.nhanvien) {
  const phieu = await taoPhieu(kyId, nhanVienId);
  const r1 = await goi('patch', `/phieuDanhGiaKPI/${phieu.id}/tuCham`, tkNhanVien).send({
    giaiTrinhNhanVien: 'Đã làm',
    chiTiet: phieu.chiTiet.map((c) => ({ id: c.id, diemTuCham: 8, ketQuaThucTe: 'Đạt' })),
  });
  expect(r1.status).toBe(200);
  const r2 = await goi('post', `/phieuDanhGiaKPI/${phieu.id}/guiDuyet`, tkNhanVien);
  expect(r2.status).toBe(200);
  return r2.body.data;
}
// Điểm theo mã chỉ tiêu cho NV0005: CHUNG-01 10, CHUNG-02 8, LTV-01 9, LTV-02 7 -> 59/7 = 8.43 TOT
const DIEM_MAU = { 'CHUNG-01': 10, 'CHUNG-02': 8, 'LTV-01': 9, 'LTV-02': 7 };
const bodyNghiemThu = (phieu, diem = (c) => DIEM_MAU[c.maChiTieu] ?? 8) => ({
  nhanXetQuanLy: 'Tốt',
  chiTiet: phieu.chiTiet.map((c) => ({ id: c.id, diemNghiemThu: diem(c), nhanXet: 'OK' })),
});
async function layNhatKy(hanhDong) {
  const [d] = await pool.execute('SELECT nguoiDungId, chiTiet FROM nhatkyhethong WHERE id > ? AND hanhDong = ? ORDER BY id', [
    mocNhatKy,
    hanhDong,
  ]);
  return d;
}

const BANG_DAT_LAI = ['chitietdanhgiakpi', 'phieudanhgiakpi', 'chitieukpi', 'kydanhgiakpi', 'nhatkyhethong'];
async function datLaiAutoIncrement() {
  for (const bang of BANG_DAT_LAI) await pool.query(`ALTER TABLE ${bang} AUTO_INCREMENT = 1`);
}

beforeAll(async () => {
  anhChup = {};
  for (const bang of BANG_DAT_LAI) {
    anhChup[bang] = (await pool.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${bang}`))[0][0].m;
  }
  for (const ten of ['admin', 'giamdoc', 'quanly', 'quanly2', 'hr', 'hr2', 'nhanvien', 'nhanvien2', 'nhanvien3']) {
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
  await pool.execute('UPDATE phongban SET truongBoPhanId = NULL WHERE id = 4');
  await pool.execute('DELETE FROM phieudanhgiakpi WHERE id > ?', [anhChup.phieudanhgiakpi]); // chi tiết CASCADE
  await pool.execute('DELETE FROM chitietdanhgiakpi WHERE id > ?', [anhChup.chitietdanhgiakpi]);
  await pool.execute('DELETE FROM chitieukpi WHERE id > ?', [anhChup.chitieukpi]);
  await pool.execute('DELETE FROM kydanhgiakpi WHERE id > ?', [anhChup.kydanhgiakpi]);
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKy]);
  await datLaiAutoIncrement();
});

afterAll(async () => {
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [anhChup.nhatkyhethong]);
  await datLaiAutoIncrement();
  await pool.end();
});

// ---------------------------------------------------------------------------
describe('Unit xếp loại và điểm tổng KPI', () => {
  test('xếp loại theo ngưỡng THAM_SO_KPI (biên 9 / 8 / 6.5 / 5)', () => {
    expect(xepLoaiTheoDiem(10)).toBe('XUAT_SAC');
    expect(xepLoaiTheoDiem(9)).toBe('XUAT_SAC');
    expect(xepLoaiTheoDiem(8.99)).toBe('TOT');
    expect(xepLoaiTheoDiem(8)).toBe('TOT');
    expect(xepLoaiTheoDiem(6.5)).toBe('KHA');
    expect(xepLoaiTheoDiem(6.49)).toBe('TRUNG_BINH');
    expect(xepLoaiTheoDiem(5)).toBe('TRUNG_BINH');
    expect(xepLoaiTheoDiem(4.99)).toBe('YEU');
    expect(xepLoaiTheoDiem(0)).toBe('YEU');
  });
});

// ---------------------------------------------------------------------------
describe('Kỳ đánh giá KPI', () => {
  test('chưa đăng nhập bị từ chối 401', async () => {
    const res = await goi('get', '/kyDanhGiaKPI');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: 401, data: null });
  });

  test('mọi vai trò xem được danh sách kỳ, có kỳ seed DANG_MO và DA_DONG', async () => {
    for (const ten of ['admin', 'giamdoc', 'quanly', 'hr', 'nhanvien']) {
      const res = await goi('get', '/kyDanhGiaKPI', token[ten]);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const trangThai = res.body.data.map((k) => k.trangThai);
      expect(trangThai).toEqual(expect.arrayContaining(['DANG_MO', 'DA_DONG']));
    }
    const loc = await goi('get', '/kyDanhGiaKPI?trangThai=DA_DONG', token.nhanvien);
    expect(loc.body.data.every((k) => k.trangThai === 'DA_DONG')).toBe(true);
  });

  test('HR mở kỳ: 201, trạng thái DANG_MO, ghi nhật ký MO_KY_KPI', async () => {
    const ky = await moKy();
    expect(ky.trangThai).toBe('DANG_MO');
    const nk = await layNhatKy('MO_KY_KPI');
    expect(nk).toHaveLength(1);
    expect(nk[0]).toMatchObject({ nguoiDungId: 4, chiTiet: ky.tenKyDanhGia });
    const ct = await goi('get', `/kyDanhGiaKPI/${ky.id}`, token.nhanvien);
    expect(ct.status).toBe(200);
    expect(ct.body.data.id).toBe(ky.id);
  });

  test('chỉ HR được mở/sửa/đóng/xóa kỳ: admin, giamDoc, quanLy, nhanVien bị 403', async () => {
    const ky = await moKy();
    const body = { tenKyDanhGia: 'QA cấm', ngayBatDau: '2040-01-01', ngayKetThuc: '2040-02-01' };
    for (const ten of ['admin', 'giamdoc', 'quanly', 'nhanvien']) {
      expect((await goi('post', '/kyDanhGiaKPI', token[ten]).send(body)).status).toBe(403);
      expect((await goi('patch', `/kyDanhGiaKPI/${ky.id}`, token[ten]).send({ tenKyDanhGia: 'Đổi tên' })).status).toBe(403);
      expect((await goi('post', `/kyDanhGiaKPI/${ky.id}/dong`, token[ten])).status).toBe(403);
      expect((await goi('delete', `/kyDanhGiaKPI/${ky.id}`, token[ten])).status).toBe(403);
    }
  });

  test('dữ liệu kỳ sai trả 400: thiếu tên, ngày sai, ngày kết thúc trước ngày bắt đầu', async () => {
    expect((await goi('post', '/kyDanhGiaKPI', token.hr).send({ ngayBatDau: '2040-01-01', ngayKetThuc: '2040-02-01' })).status).toBe(400);
    expect(
      (await goi('post', '/kyDanhGiaKPI', token.hr).send({ tenKyDanhGia: 'QA sai', ngayBatDau: '2040-13-01', ngayKetThuc: '2040-02-01' }))
        .status,
    ).toBe(400);
    const res = await goi('post', '/kyDanhGiaKPI', token.hr).send({
      tenKyDanhGia: 'QA sai',
      ngayBatDau: '2040-03-01',
      ngayKetThuc: '2040-02-01',
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 400, data: null });
  });

  test('trùng tên kỳ trả 409 (khi tạo và khi sửa)', async () => {
    const ky = await moKy();
    const ky2 = await moKy();
    const res = await goi('post', '/kyDanhGiaKPI', token.hr).send({
      tenKyDanhGia: ky.tenKyDanhGia,
      ngayBatDau: '2040-01-01',
      ngayKetThuc: '2040-02-01',
    });
    expect(res.status).toBe(409);
    expect((await goi('patch', `/kyDanhGiaKPI/${ky2.id}`, token.hr).send({ tenKyDanhGia: ky.tenKyDanhGia })).status).toBe(409);
  });

  test('sửa kỳ: thành công, không thay đổi gì -> 400, khoảng ngày sai -> 400, kỳ không tồn tại -> 404', async () => {
    const ky = await moKy();
    const res = await goi('patch', `/kyDanhGiaKPI/${ky.id}`, token.hr).send({ ngayKetThuc: ky.ngayKetThuc.slice(0, 4) + '-06-30' });
    expect(res.status).toBe(200);
    expect(res.body.data.ngayKetThuc).toBe(ky.ngayKetThuc.slice(0, 4) + '-06-30');
    expect(await layNhatKy('SUA_KY_KPI')).toHaveLength(1);
    expect((await goi('patch', `/kyDanhGiaKPI/${ky.id}`, token.hr).send({ tenKyDanhGia: ky.tenKyDanhGia })).status).toBe(400);
    expect((await goi('patch', `/kyDanhGiaKPI/${ky.id}`, token.hr).send({ ngayKetThuc: '2000-01-01' })).status).toBe(400);
    expect((await goi('patch', '/kyDanhGiaKPI/999999', token.hr).send({ tenKyDanhGia: 'Không có' })).status).toBe(404);
  });

  test('đóng kỳ, đóng lại -> 409, sửa kỳ đã đóng -> 409, mở lại -> DANG_MO, mở lại kỳ đang mở -> 409', async () => {
    const ky = await moKy();
    const dong = await goi('post', `/kyDanhGiaKPI/${ky.id}/dong`, token.hr);
    expect(dong.status).toBe(200);
    expect(dong.body.data.trangThai).toBe('DA_DONG');
    expect((await goi('post', `/kyDanhGiaKPI/${ky.id}/dong`, token.hr)).status).toBe(409);
    expect((await goi('patch', `/kyDanhGiaKPI/${ky.id}`, token.hr).send({ tenKyDanhGia: 'QA đổi tên đã đóng' })).status).toBe(409);
    const moLai = await goi('post', `/kyDanhGiaKPI/${ky.id}/moLai`, token.hr);
    expect(moLai.status).toBe(200);
    expect(moLai.body.data.trangThai).toBe('DANG_MO');
    expect((await goi('post', `/kyDanhGiaKPI/${ky.id}/moLai`, token.hr)).status).toBe(409);
    expect(await layNhatKy('DONG_KY_KPI')).toHaveLength(1);
    expect(await layNhatKy('MO_LAI_KY_KPI')).toHaveLength(1);
  });

  test('không đóng được kỳ còn phiếu CHO_DUYET (409); kỳ seed 2 cũng bị chặn', async () => {
    const ky = await moKy();
    await phieuChoDuyet(ky.id);
    const res = await goi('post', `/kyDanhGiaKPI/${ky.id}/dong`, token.hr);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/chờ nghiệm thu/);
    expect((await goi('post', '/kyDanhGiaKPI/2/dong', token.hr)).status).toBe(409);
    const [[k2]] = await pool.execute('SELECT trangThai FROM kydanhgiakpi WHERE id = 2');
    expect(k2.trangThai).toBe('DANG_MO');
  });

  test('xóa kỳ: kỳ trống xóa được, kỳ đã có phiếu -> 409, không tồn tại -> 404', async () => {
    const trong = await moKy();
    expect((await goi('delete', `/kyDanhGiaKPI/${trong.id}`, token.hr)).status).toBe(200);
    expect((await goi('get', `/kyDanhGiaKPI/${trong.id}`, token.hr)).status).toBe(404);
    expect(await layNhatKy('XOA_KY_KPI')).toHaveLength(1);
    const ky = await moKy();
    await taoPhieu(ky.id);
    expect((await goi('delete', `/kyDanhGiaKPI/${ky.id}`, token.hr)).status).toBe(409);
    expect((await goi('delete', '/kyDanhGiaKPI/999999', token.hr)).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
describe('Chỉ tiêu KPI', () => {
  test('HR, giamDoc, quanLy xem được; admin và nhanVien bị 403', async () => {
    for (const ten of ['hr', 'giamdoc', 'quanly']) expect((await goi('get', '/chiTieuKPI', token[ten])).status).toBe(200);
    for (const ten of ['admin', 'nhanvien']) expect((await goi('get', '/chiTieuKPI', token[ten])).status).toBe(403);
  });

  test('quanLy chỉ thấy chỉ tiêu chung + phòng mình (không thấy NVKD/TPKD của PKD)', async () => {
    const res = await goi('get', '/chiTieuKPI', token.quanly);
    const ma = res.body.data.map((c) => c.maChiTieu);
    expect(ma).toEqual(expect.arrayContaining(['CHUNG-01', 'LTV-01', 'TPKT-01', 'QTHT-01']));
    expect(ma).not.toContain('NVKD-01');
    expect(ma).not.toContain('TPKD-01');
    const hr = await goi('get', '/chiTieuKPI', token.hr);
    expect(hr.body.data.map((c) => c.maChiTieu)).toContain('NVKD-01');
  });

  test('GET /viTri: HR thấy mọi vị trí, quanLy chỉ phòng mình, giamDoc bị 403', async () => {
    const hr = await goi('get', '/chiTieuKPI/viTri', token.hr);
    expect(hr.status).toBe(200);
    expect(hr.body.data.map((v) => v.id)).toEqual(expect.arrayContaining([1, 2, 5, 8]));
    const ql = await goi('get', '/chiTieuKPI/viTri', token.quanly);
    expect(ql.body.data.every((v) => [3, 4].includes(v.phongBanId))).toBe(true);
    expect((await goi('get', '/chiTieuKPI/viTri', token.giamdoc)).status).toBe(403);
  });

  test('HR thêm chỉ tiêu chung (mã viết hoa, trọng số mặc định 1), ghi nhật ký; sửa và xóa được', async () => {
    const res = await goi('post', '/chiTieuKPI', token.hr).send({ maChiTieu: 'qa-chung', tenChiTieu: 'QA chỉ tiêu chung' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ maChiTieu: 'QA-CHUNG', chucDanhPhongBanId: null });
    expect(Number(res.body.data.trongSoMacDinh)).toBe(1);
    expect(await layNhatKy('THEM_CHI_TIEU_KPI')).toHaveLength(1);
    const sua = await goi('patch', `/chiTieuKPI/${res.body.data.id}`, token.hr).send({ trongSoMacDinh: 2.5 });
    expect(sua.status).toBe(200);
    expect(Number(sua.body.data.trongSoMacDinh)).toBe(2.5);
    expect((await goi('delete', `/chiTieuKPI/${res.body.data.id}`, token.hr)).status).toBe(200);
  });

  test('quanLy thêm chỉ tiêu cho vị trí phòng mình; vị trí phòng khác 403; chỉ tiêu chung 403', async () => {
    const ok = await goi('post', '/chiTieuKPI', token.quanly).send({
      maChiTieu: 'QA-LTV',
      tenChiTieu: 'QA LTV',
      chucDanhPhongBanId: 5,
      trongSoMacDinh: 2,
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data.phongBanId).toBe(4);
    expect(
      (await goi('post', '/chiTieuKPI', token.quanly).send({ maChiTieu: 'QA-KD', tenChiTieu: 'QA KD', chucDanhPhongBanId: 8 })).status,
    ).toBe(403);
    expect((await goi('post', '/chiTieuKPI', token.quanly).send({ maChiTieu: 'QA-CH', tenChiTieu: 'QA chung' })).status).toBe(403);
  });

  test('quanLy sửa chỉ tiêu phòng khác -> 404, sửa chỉ tiêu chung -> 403; giamDoc/nhanVien thêm -> 403', async () => {
    expect((await goi('patch', '/chiTieuKPI/5', token.quanly).send({ tenChiTieu: 'Hack' })).status).toBe(404);
    expect((await goi('delete', '/chiTieuKPI/5', token.quanly)).status).toBe(404);
    expect((await goi('patch', '/chiTieuKPI/1', token.quanly).send({ tenChiTieu: 'Hack' })).status).toBe(403);
    for (const ten of ['giamdoc', 'nhanvien', 'admin']) {
      expect((await goi('post', '/chiTieuKPI', token[ten]).send({ maChiTieu: 'QA-X', tenChiTieu: 'QA X' })).status).toBe(403);
    }
  });

  test('dữ liệu chỉ tiêu sai -> 400; trùng mã -> 409', async () => {
    expect((await goi('post', '/chiTieuKPI', token.hr).send({ tenChiTieu: 'Thiếu mã' })).status).toBe(400);
    expect((await goi('post', '/chiTieuKPI', token.hr).send({ maChiTieu: 'QA MA', tenChiTieu: 'Mã có dấu cách' })).status).toBe(400);
    expect(
      (await goi('post', '/chiTieuKPI', token.hr).send({ maChiTieu: 'QA-0', tenChiTieu: 'Trọng số 0', trongSoMacDinh: 0 })).status,
    ).toBe(400);
    expect(
      (await goi('post', '/chiTieuKPI', token.hr).send({ maChiTieu: 'QA-1', tenChiTieu: 'Trọng số lẻ', trongSoMacDinh: 1.234 })).status,
    ).toBe(400);
    expect(
      (await goi('post', '/chiTieuKPI', token.hr).send({ maChiTieu: 'QA-2', tenChiTieu: 'Vị trí sai', chucDanhPhongBanId: 'abc' })).status,
    ).toBe(400);
    const trung = await goi('post', '/chiTieuKPI', token.hr).send({ maChiTieu: 'ltv-01', tenChiTieu: 'Trùng mã seed' });
    expect(trung.status).toBe(409);
    expect(trung.body).toMatchObject({ success: false, code: 409, data: null });
  });

  test('chỉ tiêu đã dùng trong phiếu: không xóa được và không đổi vị trí được (409)', async () => {
    expect((await goi('delete', '/chiTieuKPI/3', token.hr)).status).toBe(409);
    expect((await goi('patch', '/chiTieuKPI/3', token.hr).send({ chucDanhPhongBanId: 8 })).status).toBe(409);
    const [[ct]] = await pool.execute('SELECT chucDanhPhongBanId FROM chitieukpi WHERE id = 3');
    expect(ct.chucDanhPhongBanId).toBe(5);
  });
});

// ---------------------------------------------------------------------------
describe('Phiếu đánh giá KPI: tạo, sửa, xóa', () => {
  test('HR tạo phiếu: BAN_NHAP, chi tiết chép từ chỉ tiêu vị trí + chỉ tiêu chung, ghi nhật ký', async () => {
    const ky = await moKy();
    const phieu = await taoPhieu(ky.id);
    expect(phieu).toMatchObject({ trangThai: 'BAN_NHAP', nhanVienId: NV_NHANVIEN, kyDanhGiaId: ky.id });
    expect(phieu.chiTiet.map((c) => c.maChiTieu).sort()).toEqual(['CHUNG-01', 'CHUNG-02', 'LTV-01', 'LTV-02']);
    expect(phieu.chiTiet.find((c) => c.maChiTieu === 'LTV-01').trongSo).toBe(3);
    expect(phieu.quyen.quanTri).toBe(true);
    const nk = await layNhatKy('TAO_PHIEU_KPI');
    expect(nk).toHaveLength(1);
    expect(nk[0].chiTiet).toContain('NV0005');
  });

  test('trùng phiếu cùng nhân viên cùng kỳ -> 409', async () => {
    const ky = await moKy();
    await taoPhieu(ky.id);
    expect((await goi('post', '/phieuDanhGiaKPI', token.hr).send({ kyDanhGiaId: ky.id, nhanVienId: NV_NHANVIEN })).status).toBe(409);
  });

  test('dữ liệu tạo phiếu sai -> 400; kỳ/nhân viên không tồn tại -> 404; kỳ đã đóng -> 409', async () => {
    const ky = await moKy();
    expect((await goi('post', '/phieuDanhGiaKPI', token.hr).send({ nhanVienId: NV_NHANVIEN })).status).toBe(400);
    expect((await goi('post', '/phieuDanhGiaKPI', token.hr).send({ kyDanhGiaId: 'x', nhanVienId: NV_NHANVIEN })).status).toBe(400);
    expect((await goi('post', '/phieuDanhGiaKPI', token.hr).send({ kyDanhGiaId: 999999, nhanVienId: NV_NHANVIEN })).status).toBe(404);
    expect((await goi('post', '/phieuDanhGiaKPI', token.hr).send({ kyDanhGiaId: ky.id, nhanVienId: 999999 })).status).toBe(404);
    expect((await goi('post', '/phieuDanhGiaKPI', token.hr).send({ kyDanhGiaId: 1, nhanVienId: NV_NHANVIEN2 })).status).toBe(409);
  });

  test('không được tự tạo phiếu cho chính mình (HR, quanLy) -> 403', async () => {
    const ky = await moKy();
    expect((await goi('post', '/phieuDanhGiaKPI', token.hr).send({ kyDanhGiaId: ky.id, nhanVienId: 4 })).status).toBe(403);
    expect((await goi('post', '/phieuDanhGiaKPI', token.quanly).send({ kyDanhGiaId: ky.id, nhanVienId: NV_QUANLY })).status).toBe(403);
  });

  test('quanLy tạo phiếu cho nhân viên phòng mình; nhân viên phòng khác -> 404; giamDoc/nhanVien/admin -> 403', async () => {
    const ky = await moKy();
    const phieu = await taoPhieu(ky.id, NV_NHANVIEN2, token.quanly);
    expect(phieu.nhanVienId).toBe(NV_NHANVIEN2);
    expect((await goi('post', '/phieuDanhGiaKPI', token.quanly).send({ kyDanhGiaId: ky.id, nhanVienId: NV_NHANVIEN3 })).status).toBe(404);
    for (const ten of ['giamdoc', 'nhanvien', 'admin']) {
      expect((await goi('post', '/phieuDanhGiaKPI', token[ten]).send({ kyDanhGiaId: ky.id, nhanVienId: NV_NHANVIEN })).status).toBe(403);
    }
  });

  test('tạo hàng loạt: quanLy tạo cho cả phòng (trừ bản thân), lần 2 không tạo thêm; phòng ngoài phạm vi -> 403', async () => {
    const ky = await moKy();
    const res = await goi('post', '/phieuDanhGiaKPI/taoHangLoat', token.quanly).send({ kyDanhGiaId: ky.id });
    expect(res.status).toBe(201);
    expect(res.body.data.soPhieuTao).toBe(3); // NV0001 (PKT), NV0005, NV0006 (PKT-PT)
    const [ds] = await pool.execute('SELECT nhanVienId FROM phieudanhgiakpi WHERE kyDanhGiaId = ? ORDER BY nhanVienId', [ky.id]);
    expect(ds.map((d) => d.nhanVienId)).toEqual([1, 5, 6]);
    const lai = await goi('post', '/phieuDanhGiaKPI/taoHangLoat', token.quanly).send({ kyDanhGiaId: ky.id });
    expect(lai.body.data.soPhieuTao).toBe(0);
    expect((await goi('post', '/phieuDanhGiaKPI/taoHangLoat', token.quanly).send({ kyDanhGiaId: ky.id, phongBanId: 5 })).status).toBe(403);
    expect((await goi('post', '/phieuDanhGiaKPI/taoHangLoat', token.hr).send({ kyDanhGiaId: 1 })).status).toBe(409);
  });

  test('HR tạo hàng loạt toàn công ty: bỏ qua chính HR, mọi người còn lại có phiếu', async () => {
    const ky = await moKy();
    const res = await goi('post', '/phieuDanhGiaKPI/taoHangLoat', token.hr).send({ kyDanhGiaId: ky.id });
    expect(res.status).toBe(201);
    const [ds] = await pool.execute('SELECT nhanVienId FROM phieudanhgiakpi WHERE kyDanhGiaId = ?', [ky.id]);
    const ids = ds.map((d) => d.nhanVienId);
    expect(ids).not.toContain(4);
    // NV0002, NV0008 có vai trò giamDoc -> tự bỏ qua
    expect(ids).not.toContain(2);
    expect(ids).not.toContain(8);
    expect(ids.sort((a, b) => a - b)).toEqual([1, 3, 5, 6, 7, 9, 10]);
    expect(ds.length).toBe(res.body.data.soPhieuTao);
  });

  test('không tạo phiếu cho nhân viên có vai trò giamDoc -> 400', async () => {
    const ky = await moKy();
    for (const nvId of [2, 8]) {
      const res = await goi('post', '/phieuDanhGiaKPI', token.hr).send({ kyDanhGiaId: ky.id, nhanVienId: nvId });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Ban Giám đốc/);
    }
    const [[d]] = await pool.execute('SELECT COUNT(*) AS so FROM phieudanhgiakpi WHERE kyDanhGiaId = ?', [ky.id]);
    expect(Number(d.so)).toBe(0);
  });

  test('sửa mục tiêu/trọng số phiếu nháp: HR được; trọng số sai, chỉ tiêu lạ -> 400; nhanVien -> 403', async () => {
    const ky = await moKy();
    const phieu = await taoPhieu(ky.id);
    const ctId = phieu.chiTiet[0].id;
    const res = await goi('patch', `/phieuDanhGiaKPI/${phieu.id}`, token.hr).send({
      chiTiet: [{ id: ctId, mucTieu: '>= 99%', trongSo: 4 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.chiTiet[0]).toMatchObject({ mucTieu: '>= 99%', trongSo: 4 });
    expect(await layNhatKy('SUA_PHIEU_KPI')).toHaveLength(1);
    expect((await goi('patch', `/phieuDanhGiaKPI/${phieu.id}`, token.hr).send({ chiTiet: [{ id: ctId, trongSo: 0 }] })).status).toBe(400);
    expect((await goi('patch', `/phieuDanhGiaKPI/${phieu.id}`, token.hr).send({ chiTiet: [{ id: 999999, trongSo: 1 }] })).status).toBe(400);
    expect((await goi('patch', `/phieuDanhGiaKPI/${phieu.id}`, token.hr).send({ chiTiet: [] })).status).toBe(400);
    expect((await goi('patch', `/phieuDanhGiaKPI/${phieu.id}`, token.nhanvien).send({ chiTiet: [{ id: ctId, trongSo: 9 }] })).status).toBe(
      403,
    );
  });

  test('quanLy phòng khác không sửa/xóa được phiếu (404); phiếu đã gửi không sửa/xóa được (409)', async () => {
    const ky = await moKy();
    const phieu = await taoPhieu(ky.id);
    const ctId = phieu.chiTiet[0].id;
    expect((await goi('patch', `/phieuDanhGiaKPI/${phieu.id}`, token.quanly2).send({ chiTiet: [{ id: ctId, trongSo: 5 }] })).status).toBe(
      404,
    );
    expect((await goi('delete', `/phieuDanhGiaKPI/${phieu.id}`, token.quanly2)).status).toBe(404);
    const daGui = await phieuChoDuyet(ky.id, NV_NHANVIEN2, token.nhanvien2);
    expect(
      (await goi('patch', `/phieuDanhGiaKPI/${daGui.id}`, token.hr).send({ chiTiet: [{ id: daGui.chiTiet[0].id, trongSo: 5 }] })).status,
    ).toBe(409);
    expect((await goi('delete', `/phieuDanhGiaKPI/${daGui.id}`, token.hr)).status).toBe(409);
  });

  test('xóa phiếu nháp: HR xóa được, chi tiết bị xóa theo (CASCADE), ghi nhật ký', async () => {
    const ky = await moKy();
    const phieu = await taoPhieu(ky.id);
    expect((await goi('delete', `/phieuDanhGiaKPI/${phieu.id}`, token.hr)).status).toBe(200);
    const [[d]] = await pool.execute('SELECT COUNT(*) AS so FROM chitietdanhgiakpi WHERE phieuDanhGiaKPIId = ?', [phieu.id]);
    expect(Number(d.so)).toBe(0);
    expect(await layNhatKy('XOA_PHIEU_KPI')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
describe('Phiếu đánh giá KPI: xem và phạm vi', () => {
  test('danh sách phiếu: HR/giamDoc toàn công ty, có phân trang; admin và nhanVien -> 403', async () => {
    for (const ten of ['hr', 'giamdoc']) {
      const res = await goi('get', '/phieuDanhGiaKPI?kyDanhGiaId=2', token[ten]);
      expect(res.status).toBe(200);
      expect(res.body.data.phanTrang).toBeDefined();
      expect(res.body.data.items.map((p) => p.id)).toEqual(expect.arrayContaining([8, 9, 10, 11, 12, 13, 14]));
    }
    for (const ten of ['admin', 'nhanvien']) expect((await goi('get', '/phieuDanhGiaKPI', token[ten])).status).toBe(403);
  });

  test('quanLy chỉ thấy phiếu phòng mình (PKT + PKT-PT), không thấy PKD', async () => {
    const res = await goi('get', '/phieuDanhGiaKPI?kyDanhGiaId=2', token.quanly);
    const ids = res.body.data.items.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([8, 10, 11, 13]));
    expect(ids).not.toContain(9);
    expect(res.body.data.items.find((p) => p.id === 8).duocNghiemThu).toBe(true);
    expect(res.body.data.items.find((p) => p.id === 10).duocNghiemThu).toBe(false); // phiếu của chính mình
  });

  test('GET /cuaToi: chỉ phiếu của mình, mọi vai trò có hồ sơ dùng được', async () => {
    const res = await goi('get', '/phieuDanhGiaKPI/cuaToi', token.nhanvien);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((p) => p.nhanVienId === NV_NHANVIEN)).toBe(true);
    const admin = await goi('get', '/phieuDanhGiaKPI/cuaToi?kyDanhGiaId=2', token.admin);
    expect(admin.status).toBe(200);
    expect(admin.body.data.map((p) => p.id)).toEqual([13]);
  });

  test('chi tiết phiếu: chính chủ xem được; nhanVien khác -> 404; quanLy phòng khác -> 404; giamDoc xem được', async () => {
    const chu = await goi('get', '/phieuDanhGiaKPI/8', token.nhanvien);
    expect(chu.status).toBe(200);
    expect(chu.body.data.chiTiet.length).toBe(4);
    expect((await goi('get', '/phieuDanhGiaKPI/8', token.nhanvien2)).status).toBe(404);
    expect((await goi('get', '/phieuDanhGiaKPI/8', token.quanly2)).status).toBe(404);
    expect((await goi('get', '/phieuDanhGiaKPI/9', token.quanly)).status).toBe(404);
    expect((await goi('get', '/phieuDanhGiaKPI/8', token.giamdoc)).status).toBe(200);
    expect((await goi('get', '/phieuDanhGiaKPI/999999', token.hr)).status).toBe(404);
    expect((await goi('get', '/phieuDanhGiaKPI/abc', token.hr)).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('Phiếu đánh giá KPI: tự chấm, gửi, nghiệm thu, trả lại', () => {
  test('nhân viên tự chấm và gửi duyệt; ghi nhật ký GUI_PHIEU_KPI', async () => {
    const ky = await moKy();
    const phieu = await phieuChoDuyet(ky.id);
    expect(phieu.trangThai).toBe('CHO_DUYET');
    expect(phieu.diemTuChamTong).toBe(8);
    expect(phieu.giaiTrinhNhanVien).toBe('Đã làm');
    expect(await layNhatKy('GUI_PHIEU_KPI')).toHaveLength(1);
  });

  test('không tự chấm phiếu người khác (403 cho HR, 404 cho nhanVien khác)', async () => {
    const ky = await moKy();
    const phieu = await taoPhieu(ky.id);
    const body = { chiTiet: [{ id: phieu.chiTiet[0].id, diemTuCham: 10 }] };
    expect((await goi('patch', `/phieuDanhGiaKPI/${phieu.id}/tuCham`, token.hr).send(body)).status).toBe(403);
    expect((await goi('patch', `/phieuDanhGiaKPI/${phieu.id}/tuCham`, token.nhanvien2).send(body)).status).toBe(404);
    expect((await goi('post', `/phieuDanhGiaKPI/${phieu.id}/guiDuyet`, token.hr)).status).toBe(403);
  });

  test('tự chấm sai dữ liệu -> 400; gửi khi còn chỉ tiêu chưa chấm -> 400', async () => {
    const ky = await moKy();
    const phieu = await taoPhieu(ky.id);
    const url = `/phieuDanhGiaKPI/${phieu.id}/tuCham`;
    expect((await goi('patch', url, token.nhanvien).send({ chiTiet: [{ id: phieu.chiTiet[0].id, diemTuCham: 11 }] })).status).toBe(400);
    expect((await goi('patch', url, token.nhanvien).send({ chiTiet: [{ id: phieu.chiTiet[0].id, diemTuCham: -1 }] })).status).toBe(400);
    expect((await goi('patch', url, token.nhanvien).send({ chiTiet: [{ id: phieu.chiTiet[0].id, diemTuCham: 7.123 }] })).status).toBe(400);
    const id0 = phieu.chiTiet[0].id;
    expect(
      (
        await goi('patch', url, token.nhanvien).send({
          chiTiet: [
            { id: id0, diemTuCham: 7 },
            { id: id0, diemTuCham: 8 },
          ],
        })
      ).status,
    ).toBe(400);
    expect((await goi('patch', url, token.nhanvien).send({})).status).toBe(400);
    expect((await goi('patch', url, token.nhanvien).send({ chiTiet: [{ id: id0, diemTuCham: 7 }] })).status).toBe(200);
    const gui = await goi('post', `/phieuDanhGiaKPI/${phieu.id}/guiDuyet`, token.nhanvien);
    expect(gui.status).toBe(400);
    expect(gui.body.message).toMatch(/chưa tự chấm/);
  });

  test('tự chấm gửi lại y nguyên (điểm, kết quả, giải trình) -> 400 "Không có thông tin nào thay đổi"', async () => {
    const ky = await moKy();
    const phieu = await taoPhieu(ky.id);
    const url = `/phieuDanhGiaKPI/${phieu.id}/tuCham`;
    const body = {
      giaiTrinhNhanVien: 'Hoàn thành đúng hạn',
      chiTiet: [{ id: phieu.chiTiet[0].id, diemTuCham: 7.5, ketQuaThucTe: 'Đạt 95%' }],
    };
    const lan1 = await goi('patch', url, token.nhanvien).send(body);
    expect(lan1.status).toBe(200);
    expect(lan1.body).toMatchObject({ success: true, code: 200 });
    const lan2 = await goi('patch', url, token.nhanvien).send(body);
    expect(lan2.status).toBe(400);
    expect(lan2.body).toEqual({ success: false, code: 400, message: 'Không có thông tin nào thay đổi', data: null });
    // Điểm gửi dạng chuỗi tương đương cũng coi là không đổi
    const lan3 = await goi('patch', url, token.nhanvien).send({ chiTiet: [{ id: phieu.chiTiet[0].id, diemTuCham: '7.5' }] });
    expect(lan3.status).toBe(400);
    // Chỉ đổi giải trình -> 200
    expect((await goi('patch', url, token.nhanvien).send({ ...body, giaiTrinhNhanVien: 'Bổ sung' })).status).toBe(200);
  });

  test('phiếu đã gửi không tự chấm/gửi lại được (409)', async () => {
    const ky = await moKy();
    const phieu = await phieuChoDuyet(ky.id);
    expect((await goi('patch', `/phieuDanhGiaKPI/${phieu.id}/tuCham`, token.nhanvien).send({ giaiTrinhNhanVien: 'x' })).status).toBe(409);
    expect((await goi('post', `/phieuDanhGiaKPI/${phieu.id}/guiDuyet`, token.nhanvien)).status).toBe(409);
  });

  test('quanLy nghiệm thu: điểm tổng theo trọng số 8.43 -> TOT, DA_DUYET, ghi nhật ký', async () => {
    const ky = await moKy();
    const phieu = await phieuChoDuyet(ky.id);
    const res = await goi('post', `/phieuDanhGiaKPI/${phieu.id}/nghiemThu`, token.quanly).send(bodyNghiemThu(phieu));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200 });
    expect(res.body.data).toMatchObject({
      trangThai: 'DA_DUYET',
      diemTong: 8.43,
      xepLoaiChung: 'TOT',
      nguoiDanhGiaId: NV_QUANLY,
      nhanXetQuanLy: 'Tốt',
    });
    expect(res.body.data.ngayNghiemThu).toBeTruthy();
    const nk = await layNhatKy('NGHIEM_THU_KPI');
    expect(nk).toHaveLength(1);
    expect(nk[0]).toMatchObject({ nguoiDungId: 3 });
    expect(nk[0].chiTiet).toContain('8.43 TOT');
    // Đã nghiệm thu thì không nghiệm thu lại được
    expect((await goi('post', `/phieuDanhGiaKPI/${phieu.id}/nghiemThu`, token.quanly).send(bodyNghiemThu(phieu))).status).toBe(409);
  });

  test('xếp loại theo các mức điểm: 9.5 XUAT_SAC, 7 KHA, 5 TRUNG_BINH, 4 YEU', async () => {
    const cases = [
      [9.5, 'XUAT_SAC'],
      [7, 'KHA'],
      [5, 'TRUNG_BINH'],
      [4, 'YEU'],
    ];
    for (const [diem, xepLoai] of cases) {
      const ky = await moKy();
      const phieu = await phieuChoDuyet(ky.id);
      const res = await goi('post', `/phieuDanhGiaKPI/${phieu.id}/nghiemThu`, token.giamdoc).send(bodyNghiemThu(phieu, () => diem));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ diemTong: diem, xepLoaiChung: xepLoai });
    }
  });

  test('nghiệm thu sai dữ liệu -> 400 và không đổi trạng thái (rollback)', async () => {
    const ky = await moKy();
    const phieu = await phieuChoDuyet(ky.id);
    const url = `/phieuDanhGiaKPI/${phieu.id}/nghiemThu`;
    const thieu = { chiTiet: phieu.chiTiet.slice(1).map((c) => ({ id: c.id, diemNghiemThu: 8 })) };
    expect((await goi('post', url, token.quanly).send(thieu)).status).toBe(400);
    // Mục đầu hợp lệ, mục cuối sai: không được lưu dở điểm mục đầu
    const saiCuoi = bodyNghiemThu(phieu, (c) => (c.id === phieu.chiTiet[phieu.chiTiet.length - 1].id ? 11 : 9));
    expect((await goi('post', url, token.quanly).send(saiCuoi)).status).toBe(400);
    expect((await goi('post', url, token.quanly).send({})).status).toBe(400);
    const [[p]] = await pool.execute('SELECT trangThai, xepLoaiChung FROM phieudanhgiakpi WHERE id = ?', [phieu.id]);
    expect(p).toMatchObject({ trangThai: 'CHO_DUYET', xepLoaiChung: null });
    const [[d]] = await pool.execute('SELECT COUNT(diemNghiemThu) AS so FROM chitietdanhgiakpi WHERE phieuDanhGiaKPIId = ?', [phieu.id]);
    expect(Number(d.so)).toBe(0);
  });

  test('nghiệm thu: HR/nhanVien/admin -> 403; quanLy phòng khác -> 404', async () => {
    const ky = await moKy();
    const phieu = await phieuChoDuyet(ky.id);
    const url = `/phieuDanhGiaKPI/${phieu.id}/nghiemThu`;
    for (const ten of ['hr', 'nhanvien', 'admin']) expect((await goi('post', url, token[ten]).send(bodyNghiemThu(phieu))).status).toBe(403);
    expect((await goi('post', url, token.quanly2).send(bodyNghiemThu(phieu))).status).toBe(404);
  });

  test('phiếu của trưởng bộ phận: quanLy không nghiệm thu được (403), giamDoc nghiệm thu được', async () => {
    // Tạm cho NV0006 làm trưởng Nhóm Phát triển (PKT-PT thuộc PKT của quanly); afterEach đặt lại NULL
    await pool.execute('UPDATE phongban SET truongBoPhanId = ? WHERE id = 4', [NV_NHANVIEN2]);
    const ky = await moKy();
    const phieu = await phieuChoDuyet(ky.id, NV_NHANVIEN2, token.nhanvien2);
    expect(phieu.laTruongBoPhan).toBe(true);
    const ql = await goi('post', `/phieuDanhGiaKPI/${phieu.id}/nghiemThu`, token.quanly).send(bodyNghiemThu(phieu));
    expect(ql.status).toBe(403);
    expect(ql.body.message).toMatch(/Ban Giám đốc/);
    expect((await goi('post', `/phieuDanhGiaKPI/${phieu.id}/traLai`, token.quanly).send({ lyDo: 'x' })).status).toBe(403);
    const gd = await goi('post', `/phieuDanhGiaKPI/${phieu.id}/nghiemThu`, token.giamdoc).send(bodyNghiemThu(phieu));
    expect(gd.status).toBe(200);
    expect(gd.body.data.nguoiDanhGiaId).toBe(2);
  });

  test('phiếu seed 10 (trưởng PKT NV0003): quanly tự nghiệm thu -> 403, giamDoc được quyền nghiệm thu', async () => {
    const chiTiet = (await goi('get', '/phieuDanhGiaKPI/10', token.giamdoc)).body.data;
    expect(chiTiet.quyen.nghiemThu).toBe(true);
    const res = await goi('post', '/phieuDanhGiaKPI/10/nghiemThu', token.quanly).send(bodyNghiemThu(chiTiet));
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/chính mình/);
    const [[p]] = await pool.execute('SELECT trangThai FROM phieudanhgiakpi WHERE id = 10');
    expect(p.trangThai).toBe('CHO_DUYET');
  });

  test('trả lại: về BAN_NHAP, lý do ghi vào nhận xét, nhân viên chấm lại và gửi lại được; thiếu lý do -> 400', async () => {
    const ky = await moKy();
    const phieu = await phieuChoDuyet(ky.id);
    const url = `/phieuDanhGiaKPI/${phieu.id}/traLai`;
    expect((await goi('post', url, token.quanly).send({})).status).toBe(400);
    expect((await goi('post', url, token.quanly2).send({ lyDo: 'x' })).status).toBe(404);
    const res = await goi('post', url, token.quanly).send({ lyDo: 'Thiếu minh chứng' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ trangThai: 'BAN_NHAP', nhanXetQuanLy: 'Trả lại: Thiếu minh chứng' });
    expect(await layNhatKy('TRA_LAI_PHIEU_KPI')).toHaveLength(1);
    expect((await goi('post', `/phieuDanhGiaKPI/${phieu.id}/guiDuyet`, token.nhanvien)).status).toBe(200);
  });

  test('kỳ đã đóng: không tự chấm, không tạo, không sửa, không xóa phiếu (409)', async () => {
    const ky = await moKy();
    const phieu = await taoPhieu(ky.id);
    expect((await goi('post', `/kyDanhGiaKPI/${ky.id}/dong`, token.hr)).status).toBe(200);
    const ct = { chiTiet: [{ id: phieu.chiTiet[0].id, diemTuCham: 8 }] };
    expect((await goi('patch', `/phieuDanhGiaKPI/${phieu.id}/tuCham`, token.nhanvien).send(ct)).status).toBe(409);
    expect((await goi('post', `/phieuDanhGiaKPI/${phieu.id}/guiDuyet`, token.nhanvien)).status).toBe(409);
    expect(
      (await goi('patch', `/phieuDanhGiaKPI/${phieu.id}`, token.hr).send({ chiTiet: [{ id: phieu.chiTiet[0].id, trongSo: 2 }] })).status,
    ).toBe(409);
    expect((await goi('delete', `/phieuDanhGiaKPI/${phieu.id}`, token.hr)).status).toBe(409);
    expect((await goi('post', '/phieuDanhGiaKPI', token.hr).send({ kyDanhGiaId: ky.id, nhanVienId: NV_NHANVIEN2 })).status).toBe(409);
    const xem = await goi('get', `/phieuDanhGiaKPI/${phieu.id}`, token.nhanvien);
    expect(xem.status).toBe(200);
    expect(xem.body.data.quyen).toEqual({ tuCham: false, nghiemThu: false, quanTri: false });
  });
});

// ---------------------------------------------------------------------------
describe('Báo cáo xếp loại KPI', () => {
  test('báo cáo theo kỳ: tổng hợp trạng thái, xếp loại, điểm trung bình theo phòng ban', async () => {
    const ky = await moKy();
    const phieu = await phieuChoDuyet(ky.id);
    await goi('post', `/phieuDanhGiaKPI/${phieu.id}/nghiemThu`, token.quanly).send(bodyNghiemThu(phieu));
    await taoPhieu(ky.id, NV_NHANVIEN3);
    const res = await goi('get', `/phieuDanhGiaKPI/baoCao?kyDanhGiaId=${ky.id}`, token.hr);
    expect(res.status).toBe(200);
    const { tongHop, theoPhongBan } = res.body.data;
    expect(tongHop).toMatchObject({ soPhieu: 2, theoTrangThai: { BAN_NHAP: 1, CHO_DUYET: 0, DA_DUYET: 1 }, diemTrungBinh: 8.43 });
    expect(tongHop.theoXepLoai.TOT).toBe(1);
    expect(theoPhongBan).toHaveLength(2);
    // quanLy chỉ thấy phòng mình
    const ql = await goi('get', `/phieuDanhGiaKPI/baoCao?kyDanhGiaId=${ky.id}`, token.quanly);
    expect(ql.body.data.tongHop.soPhieu).toBe(1);
  });

  test('báo cáo: thiếu kỳ -> 400, kỳ không tồn tại -> 404, nhanVien/admin -> 403', async () => {
    expect((await goi('get', '/phieuDanhGiaKPI/baoCao', token.hr)).status).toBe(400);
    expect((await goi('get', '/phieuDanhGiaKPI/baoCao?kyDanhGiaId=999999', token.hr)).status).toBe(404);
    for (const ten of ['nhanvien', 'admin'])
      expect((await goi('get', '/phieuDanhGiaKPI/baoCao?kyDanhGiaId=1', token[ten])).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
describe('Sửa lỗi nhẹ sau review KPI', () => {
  test('tên kỳ dưới 3 ký tự sau khi trim bị 400 (tạo và sửa), không tạo/đổi bản ghi', async () => {
    for (const ten of ['ab', '   ab   ', '  ']) {
      const res = await goi('post', '/kyDanhGiaKPI', token.hr).send({
        tenKyDanhGia: ten,
        ngayBatDau: '2045-01-01',
        ngayKetThuc: '2045-02-01',
      });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, code: 400, data: null });
    }
    const [[d]] = await pool.execute('SELECT COUNT(*) AS so FROM kydanhgiakpi WHERE id > ?', [anhChup.kydanhgiakpi]);
    expect(Number(d.so)).toBe(0);
    const ky = await moKy();
    expect((await goi('patch', `/kyDanhGiaKPI/${ky.id}`, token.hr).send({ tenKyDanhGia: '  xy ' })).status).toBe(400);
    const [[k]] = await pool.execute('SELECT tenKyDanhGia FROM kydanhgiakpi WHERE id = ?', [ky.id]);
    expect(k.tenKyDanhGia).toBe(ky.tenKyDanhGia);
    const ok = await goi('patch', `/kyDanhGiaKPI/${ky.id}`, token.hr).send({ tenKyDanhGia: '  Kỳ QA  ' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.tenKyDanhGia).toBe('Kỳ QA');
  });

  test('sửa phiếu mà không mục nào có mucTieu/trongSo -> 400, không ghi nhật ký SUA_PHIEU_KPI', async () => {
    const ky = await moKy();
    const phieu = await taoPhieu(ky.id);
    const res = await goi('patch', `/phieuDanhGiaKPI/${phieu.id}`, token.hr).send({ chiTiet: phieu.chiTiet.map((c) => ({ id: c.id })) });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 400, message: 'Không có thông tin nào thay đổi', data: null });
    expect(await layNhatKy('SUA_PHIEU_KPI')).toHaveLength(0);
  });

  test('tuKhoa chỉ tiêu: ký tự %, _ và \\ được thoát, không khớp đại trà', async () => {
    const goc = await goi('get', '/chiTieuKPI?tuKhoa=LTV-01', token.hr);
    expect(goc.body.data.map((c) => c.maChiTieu)).toContain('LTV-01');
    for (const tk of ['%', '_', 'LTV_01', '\\']) {
      const res = await goi('get', `/chiTieuKPI?tuKhoa=${encodeURIComponent(tk)}`, token.hr);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    }
  });

  test('tuKhoa danh sách phiếu: ký tự %, _ được thoát', async () => {
    const goc = await goi('get', '/phieuDanhGiaKPI?kyDanhGiaId=2&tuKhoa=NV000', token.hr);
    expect(goc.status).toBe(200);
    expect(goc.body.data.items.length).toBeGreaterThan(0);
    for (const tk of ['%', '_', 'NV000_']) {
      const res = await goi('get', `/phieuDanhGiaKPI?kyDanhGiaId=2&tuKhoa=${encodeURIComponent(tk)}`, token.hr);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(0);
    }
  });

  test('tạo phiếu (khóa chia sẻ chỉ tiêu) song song với thêm chỉ tiêu cùng vị trí: cả hai thành công, không deadlock', async () => {
    const ky = await moKy();
    const [tao, them] = await Promise.all([
      goi('post', '/phieuDanhGiaKPI', token.hr).send({ kyDanhGiaId: ky.id, nhanVienId: NV_NHANVIEN }),
      goi('post', '/chiTieuKPI', token.hr).send({ maChiTieu: 'QA-KHOA', tenChiTieu: 'QA khóa', chucDanhPhongBanId: 5 }),
    ]);
    expect(tao.status).toBe(201);
    expect(them.status).toBe(201);
    const ma = tao.body.data.chiTiet.map((c) => c.maChiTieu);
    expect(ma).toEqual(expect.arrayContaining(['CHUNG-01', 'CHUNG-02', 'LTV-01', 'LTV-02']));
  });
});

// ---------------------------------------------------------------------------
describe('Sửa lỗi nhẹ sau review KPI (lượt 2)', () => {
  test('sửa phiếu gửi lại y hệt mucTieu/trongSo cũ -> 400 "Không có thông tin nào thay đổi", không ghi SUA_PHIEU_KPI', async () => {
    const ky = await moKy();
    const phieu = await taoPhieu(ky.id);
    const res = await goi('patch', `/phieuDanhGiaKPI/${phieu.id}`, token.hr).send({
      chiTiet: phieu.chiTiet.map((c) => ({ id: c.id, mucTieu: c.mucTieu, trongSo: c.trongSo })),
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 400, message: 'Không có thông tin nào thay đổi', data: null });
    expect(await layNhatKy('SUA_PHIEU_KPI')).toHaveLength(0);
    // trọng số dạng chuỗi tương đương số cũ cũng coi như không đổi
    const res2 = await goi('patch', `/phieuDanhGiaKPI/${phieu.id}`, token.hr).send({
      chiTiet: phieu.chiTiet.map((c) => ({ id: c.id, trongSo: String(c.trongSo) })),
    });
    expect(res2.status).toBe(400);
  });

  test('sửa phiếu gửi đủ mọi mục nhưng chỉ một mục khác: chỉ mục đó đổi, ghi đúng 1 nhật ký SUA_PHIEU_KPI', async () => {
    const ky = await moKy();
    const phieu = await taoPhieu(ky.id);
    const [dau, ...conLai] = phieu.chiTiet;
    const body = {
      chiTiet: [
        { id: dau.id, mucTieu: 'QA mục tiêu mới', trongSo: dau.trongSo },
        ...conLai.map((c) => ({ id: c.id, mucTieu: c.mucTieu, trongSo: c.trongSo })),
      ],
    };
    const res = await goi('patch', `/phieuDanhGiaKPI/${phieu.id}`, token.hr).send(body);
    expect(res.status).toBe(200);
    const moi = res.body.data.chiTiet;
    expect(moi.find((c) => c.id === dau.id)).toMatchObject({ mucTieu: 'QA mục tiêu mới', trongSo: dau.trongSo });
    for (const c of conLai) expect(moi.find((m) => m.id === c.id)).toMatchObject({ mucTieu: c.mucTieu, trongSo: c.trongSo });
    expect(await layNhatKy('SUA_PHIEU_KPI')).toHaveLength(1);
  });

  test('trả lại phiếu: nhật ký TRA_LAI_PHIEU_KPI có chiTiet chứa lý do trả lại', async () => {
    const ky = await moKy();
    const phieu = await phieuChoDuyet(ky.id);
    const res = await goi('post', `/phieuDanhGiaKPI/${phieu.id}/traLai`, token.quanly).send({ lyDo: 'QA thiếu minh chứng số liệu' });
    expect(res.status).toBe(200);
    const nk = await layNhatKy('TRA_LAI_PHIEU_KPI');
    expect(nk).toHaveLength(1);
    expect(nk[0].chiTiet).toContain('QA thiếu minh chứng số liệu');
    expect(nk[0].chiTiet).toContain('NV0005');
  });
});

// ---------------------------------------------------------------------------
describe('nhatKyRepository.themNhatKy', () => {
  const { themNhatKy } = require('../src/repositories/nhatKyRepository');
  test('diaChiIP và chiTiet undefined -> ghi NULL, không lỗi', async () => {
    await expect(themNhatKy(null, 'QA_NHAT_KY_UNDEFINED', undefined, undefined)).resolves.toBeUndefined();
    await expect(themNhatKy(null, 'QA_NHAT_KY_UNDEFINED', undefined)).resolves.toBeUndefined();
    const nk = await pool.execute('SELECT diaChiIP, chiTiet FROM nhatkyhethong WHERE id > ? AND hanhDong = ?', [
      mocNhatKy,
      'QA_NHAT_KY_UNDEFINED',
    ]);
    expect(nk[0]).toHaveLength(2);
    for (const d of nk[0]) expect(d).toEqual({ diaChiIP: null, chiTiet: null });
  });
});
