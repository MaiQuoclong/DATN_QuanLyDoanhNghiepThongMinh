const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const { demNgayCongChuan, tinhNgayCong, tinhBaoHiem, tinhThueTNCN, lapPhieu, tinhChiTietPhieu } = require('../src/utils/tinhLuong');
const { layNgayLamViec } = require('../src/utils/tinhNgayNghi');
const { khoangNgayCuaThang } = require('../src/utils/ngayThang');

// Dữ liệu mẫu (database/seed.sql mục 8): hợp đồng phủ năm 2020 gồm NV0002 (id 2, giamdoc, 45tr/5tr),
// NV0003 (id 3, HD2019-0001 22tr/2tr), NV0004 (id 4, hr, 16tr/1.5tr, vào làm 2020-03-01), NV0008 (id 8, giamdoc2, 38tr/4tr).
// Test chỉ dùng các tháng năm 2020 (seed không có bảng lương/chấm công năm này); bảng lương seed id=1 không bị đụng.
const MAT_KHAU = 'MatKhau@123';
const VAI_TRO_HR_ID = 4;
const LOAI_PHEP_NAM = 1;
const LOAI_KHONG_LUONG = 5;

const token = {};
let anhChup;
let mocNhatKy;
let demMa = 0;

const homNay = () => new Date().toLocaleDateString('sv-SE');
function congThang(soThang) {
  const [n, t] = homNay().slice(0, 7).split('-').map(Number);
  const d = new Date(Date.UTC(n, t - 1 + soThang, 1));
  return d.toISOString().slice(0, 7);
}

function dangNhap(tenDangNhap, matKhau = MAT_KHAU) {
  return request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap, matKhau });
}
const goi = (phuongThuc, duongDan, tk) => {
  const r = request(app)[phuongThuc](`/api/v1${duongDan}`);
  return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
};

async function chenChot(thang) {
  await pool.execute("INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, chiTiet) VALUES (4, 'CHOT_CONG_THANG', ?)", [thang]);
}
async function layNhatKy(hanhDong) {
  const [d] = await pool.execute('SELECT nguoiDungId, chiTiet FROM nhatkyhethong WHERE id > ? AND hanhDong = ? ORDER BY id', [
    mocNhatKy,
    hanhDong,
  ]);
  return d;
}
async function chenCong(nhanVienId, ngay, ot = 0) {
  await pool.execute(
    `INSERT INTO banghichamcong (nhanVienId, ngayChamCong, gioVao, gioRa, soGioLamThucTe, soGioLamThemOT, trangThai)
     VALUES (?, ?, '08:00:00', '17:00:00', 8, ?, 'HOP_LE')`,
    [nhanVienId, ngay, ot],
  );
}
const ngayLamViec = (thang) => {
  const { tuNgay, denNgay } = khoangNgayCuaThang(thang);
  return layNgayLamViec(tuNgay, denNgay);
};
async function chenDon(nhanVienId, loai, ngayBatDau, ngayKetThuc, soNgay, trangThai = 'DA_DUYET') {
  demMa += 1;
  await pool.execute(
    `INSERT INTO dondexuatnghiphep (maDon, nhanVienId, loaiNghiPhepId, ngayBatDau, ngayKetThuc, soNgayNghi, lyDo, trangThai)
     VALUES (?, ?, ?, ?, ?, ?, 'Test lương', ?)`,
    [`QALG${Date.now() % 100000}${demMa}`, nhanVienId, loai, ngayBatDau, ngayKetThuc, soNgay, trangThai],
  );
}
async function chenQuyetDinh(nhanVienId, loai, soTien, ngay) {
  demMa += 1;
  await pool.execute(
    `INSERT INTO quyetdinhkhenthuongkyluat (soQuyetDinh, nhanVienId, loaiQuyetDinh, tieuDe, soTien, lyDo, ngayBanHanh, nguoiKyDuyetId)
     VALUES (?, ?, ?, 'Test', ?, 'Test lương', ?, 2)`,
    [`QAQD${Date.now() % 100000}${demMa}`, nhanVienId, loai, soTien, ngay],
  );
}
// Nhân viên + hợp đồng tạo bằng SQL (không cần tài khoản)
async function chenNhanVien({
  hoVaTen = 'QA Lương',
  trangThaiLamViec = 'CHINH_THUC',
  luong = 10000000,
  phuCap = 1000000,
  ngayBatDau = '2020-01-06',
  ngayKetThuc = null,
  trangThaiHd = 'HIEU_LUC',
} = {}) {
  demMa += 1;
  const ma = `QL${Date.now() % 100000}${demMa}`;
  const [kq] = await pool.execute(
    `INSERT INTO nhanvien (maNhanVien, hoVaTen, gioiTinh, ngaySinh, chucDanhPhongBanId, ngayVaoLam, trangThaiLamViec)
     VALUES (?, ?, 'NAM', '1995-01-01', 5, '2020-01-06', ?)`,
    [ma, hoVaTen, trangThaiLamViec],
  );
  await pool.execute(
    `INSERT INTO hopdonglaodong (maHopDong, nhanVienId, loaiHopDong, ngayBatDau, ngayKetThuc, luongCoBan, mucPhuCap, trangThai)
     VALUES (?, ?, 'XAC_DINH_THOI_HAN', ?, ?, ?, ?, ?)`,
    [`HD${ma}`, kq.insertId, ngayBatDau, ngayKetThuc, luong, phuCap, trangThaiHd],
  );
  return { id: kq.insertId, maNhanVien: ma };
}

async function lapBangOk(thang, tk = token.hr) {
  await chenChot(thang);
  const res = await goi('post', '/bangLuong', tk).send({ thang });
  expect(res.status).toBe(201);
  return res.body.data;
}
async function layPhieuDb(bangId, nhanVienId) {
  const [[p]] = await pool.execute('SELECT * FROM phieuluongnhanvien WHERE bangTongHopLuongId = ? AND nhanVienId = ?', [
    bangId,
    nhanVienId,
  ]);
  return p;
}
async function layBangDb(id) {
  const [[b]] = await pool.execute('SELECT * FROM bangtonghopluong WHERE id = ?', [id]);
  return b;
}
const guiDuyet = (id) => goi('post', `/bangLuong/${id}/guiDuyet`, token.hr);

const BANG_DAT_LAI = [
  'bangtonghopluong',
  'phieuluongnhanvien',
  'banghichamcong',
  'dondexuatnghiphep',
  'quyetdinhkhenthuongkyluat',
  'hopdonglaodong',
  'nhanvien',
  'nhatkyhethong',
];
async function datLaiAutoIncrement() {
  for (const bang of BANG_DAT_LAI) await pool.query(`ALTER TABLE ${bang} AUTO_INCREMENT = 1`);
}

beforeAll(async () => {
  const lay = async (bang) => (await pool.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${bang}`))[0][0].m;
  anhChup = {};
  for (const bang of BANG_DAT_LAI) anhChup[bang] = await lay(bang);
  for (const ten of ['admin', 'giamdoc', 'giamdoc2', 'quanly', 'hr', 'nhanvien']) {
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
  await pool.execute('DELETE FROM nguoidungvaitro WHERE nguoiDungId = 8 AND vaiTroId = ?', [VAI_TRO_HR_ID]);
  await pool.execute('DELETE FROM bangtonghopluong WHERE id > ?', [anhChup.bangtonghopluong]); // phiếu CASCADE
  await pool.execute('DELETE FROM phieuluongnhanvien WHERE id > ?', [anhChup.phieuluongnhanvien]);
  for (const bang of ['banghichamcong', 'dondexuatnghiphep', 'quyetdinhkhenthuongkyluat', 'hopdonglaodong', 'nhanvien']) {
    await pool.execute(`DELETE FROM ${bang} WHERE id > ?`, [anhChup[bang]]);
  }
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKy]);
  await datLaiAutoIncrement();
});

afterAll(async () => {
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [anhChup.nhatkyhethong]);
  await datLaiAutoIncrement();
  await pool.end();
});

// ---------------------------------------------------------------------------
describe('Unit tinhLuong', () => {
  test('thuế TNCN lũy tiến: 0 khi ≤ 0, 5tr -> 250k, 20tr -> 2.350.000, 100tr -> bậc 7', () => {
    expect(tinhThueTNCN(0)).toBe(0);
    expect(tinhThueTNCN(-5)).toBe(0);
    expect(tinhThueTNCN(5000000)).toBe(250000);
    expect(tinhThueTNCN(10000000)).toBe(750000);
    expect(tinhThueTNCN(20000000)).toBe(2350000);
    // 250k + 500k + 1.2tr + 2.8tr + 5tr + 8.4tr + 20tr*35%
    expect(tinhThueTNCN(100000000)).toBe(25150000);
  });
  test('bảo hiểm 10.5% lương cơ bản, trần 46.8tr; nghỉ ≥ 14 ngày công chuẩn thì 0', () => {
    expect(tinhBaoHiem(10000000, 22, 22)).toBe(1050000);
    expect(tinhBaoHiem(60000000, 22, 22)).toBe(4914000);
    expect(tinhBaoHiem(46800000, 9, 22)).toBe(4914000); // nghỉ 13 ngày vẫn đóng
    expect(tinhBaoHiem(10000000, 8, 22)).toBe(0); // nghỉ 14 ngày
    expect(tinhBaoHiem(10000000, 1, 22)).toBe(0);
    expect(tinhBaoHiem(10000000, 0.5, 22)).toBe(0);
    expect(tinhBaoHiem(10000000, 0, 22)).toBe(0);
  });
  test('nhân viên 1 công / 0.5 công: BH 0, thực lĩnh ≥ 0', () => {
    for (const cong of [1, 0.5]) {
      const p = lapPhieu({ luongCoBan: 10000000, mucPhuCap: 500000, soNgayCongThucTe: cong, tongGioLamThem: 0, thuongPhat: 0 }, 22);
      expect(p.khauTruBaoHiem).toBe(0);
      expect(tinhChiTietPhieu(p, 22).thucLinh).toBeGreaterThanOrEqual(0);
    }
  });
  test('ngày công: chấm công, nghỉ có/không lương, nửa ngày', () => {
    const thang = '2020-06';
    const ngay = ngayLamViec(thang); // 22 ngày
    expect(ngay).toHaveLength(22);
    expect(demNgayCongChuan(thang)).toBe(22);
    const cham = new Set(ngay.slice(0, 18)); // 18 ngày đi làm
    const don = [
      { ngayBatDau: ngay[18], ngayKetThuc: ngay[18], soNgayNghi: 1, coLuong: true }, // +1
      { ngayBatDau: ngay[19], ngayKetThuc: ngay[19], soNgayNghi: 1, coLuong: false }, // +0
      { ngayBatDau: ngay[0], ngayKetThuc: ngay[0], soNgayNghi: 0.5, coLuong: false }, // ngày 0: 0.5 (chấm công nửa còn lại)
      { ngayBatDau: ngay[20], ngayKetThuc: ngay[20], soNgayNghi: 0.5, coLuong: true }, // +0.5 (không chấm công)
    ];
    expect(tinhNgayCong(thang, cham, don)).toBe(17.5 + 1 + 0.5);
    expect(tinhNgayCong(thang, new Set(), [])).toBe(0);
    expect(tinhNgayCong(thang, new Set(ngay), [])).toBe(22);
  });
  test('lapPhieu kẹp phạt để thực lĩnh không âm, ghi phatBiCat', () => {
    const p = lapPhieu({ luongCoBan: 10000000, mucPhuCap: 0, soNgayCongThucTe: 22, tongGioLamThem: 0, thuongPhat: -20000000 }, 22);
    expect(p.khauTruBaoHiem).toBe(1050000);
    expect(p.thuongKPI).toBe(-(10000000 - 1050000));
    expect(p.phatBiCat).toBe(20000000 - 8950000);
    expect(tinhChiTietPhieu(p, 22).thucLinh).toBe(0);
    const k = lapPhieu({ luongCoBan: 10000000, mucPhuCap: 0, soNgayCongThucTe: 22, tongGioLamThem: 0, thuongPhat: -100000 }, 22);
    expect(k).toMatchObject({ thuongKPI: -100000, phatBiCat: 0 });
  });
});

// ---------------------------------------------------------------------------
describe('Xác thực và phân quyền', () => {
  test('không token -> 401', async () => {
    for (const [pt, dd] of [
      ['get', '/bangLuong'],
      ['post', '/bangLuong'],
      ['get', '/phieuLuong/cuaToi'],
      ['get', '/phieuLuong/1'],
      ['patch', '/phieuLuong/1'],
      ['get', '/bangLuong/baoCao'],
    ]) {
      const res = await goi(pt, dd);
      expect([dd, res.status]).toEqual([dd, 401]);
      expect(res.body).toMatchObject({ success: false, code: 401, data: null });
    }
  });
  test('nhanVien/quanLy/Admin -> 403 với /bangLuong*', async () => {
    for (const ten of ['nhanvien', 'quanly', 'admin']) {
      for (const [pt, dd] of [
        ['get', '/bangLuong'],
        ['get', '/bangLuong/baoCao'],
        ['post', '/bangLuong'],
        ['get', '/bangLuong/1'],
        ['get', '/bangLuong/1/xuatExcel'],
        ['delete', '/bangLuong/1'],
        ['post', '/bangLuong/1/duyet'],
        ['patch', '/phieuLuong/1'],
      ]) {
        expect([ten, dd, (await goi(pt, dd, token[ten]).send({})).status]).toEqual([ten, dd, 403]);
      }
    }
  });
  test('giamDoc không lập/sửa/tính lại; HR không duyệt/trả lại', async () => {
    expect((await goi('post', '/bangLuong', token.giamdoc).send({ thang: '2020-06' })).status).toBe(403);
    expect((await goi('patch', '/phieuLuong/1', token.giamdoc).send({ thuongKPI: 1 })).status).toBe(403);
    expect((await goi('post', '/bangLuong/1/tinhLai', token.giamdoc)).status).toBe(403);
    expect((await goi('post', '/bangLuong/1/guiDuyet', token.giamdoc)).status).toBe(403);
    expect((await goi('post', '/bangLuong/1/duyet', token.hr)).status).toBe(403);
    expect((await goi('post', '/bangLuong/1/traLai', token.hr).send({ lyDo: 'Không hợp lệ' })).status).toBe(403);
    expect((await layBangDb(1)).trangThai).toBe('DA_DUYET');
  });
});

// ---------------------------------------------------------------------------
describe('Lập bảng lương', () => {
  test('thiếu/sai định dạng tháng -> 400', async () => {
    for (const body of [{}, { thang: '2020-6' }, { thang: '2020-13' }, { thang: 202006 }, { thang: 'abc' }]) {
      const res = await goi('post', '/bangLuong', token.hr).send(body);
      expect([body, res.status]).toEqual([body, 400]);
      expect(res.body).toMatchObject({ success: false, code: 400, data: null });
    }
  });
  test('tháng hiện tại/tương lai -> 409; tháng chưa chốt -> 409', async () => {
    for (const thang of [congThang(0), congThang(1)]) {
      await chenChot(thang);
      expect((await goi('post', '/bangLuong', token.hr).send({ thang })).status).toBe(409);
    }
    expect((await goi('post', '/bangLuong', token.hr).send({ thang: '2020-05' })).status).toBe(409);
    const [[d]] = await pool.execute('SELECT COUNT(*) AS n FROM bangtonghopluong WHERE nam = 2020');
    expect(Number(d.n)).toBe(0);
  });
  test('thành công 201: giá trị phiếu đúng, tổng chi phí = tổng thu nhập, nhật ký, trùng tháng 409', async () => {
    const thang = '2020-06';
    const ngay = ngayLamViec(thang); // 22 ngày công chuẩn
    // NV0008: 20 ngày chấm công (1 ngày OT 2h), 1 ngày phép năm (có lương), 1 ngày nghỉ không lương -> 21 công
    for (let i = 0; i < 20; i += 1) await chenCong(8, ngay[i], i === 0 ? 2 : 0);
    await chenDon(8, LOAI_PHEP_NAM, ngay[20], ngay[20], 1);
    await chenDon(8, LOAI_KHONG_LUONG, ngay[21], ngay[21], 1);
    await chenDon(3, LOAI_PHEP_NAM, ngay[0], ngay[1], 2, 'CHO_DUYET'); // chưa duyệt -> không tính
    await chenQuyetDinh(8, 'KHEN_THUONG', 1000000, '2020-06-10');
    await chenQuyetDinh(8, 'KY_LUAT', 300000, '2020-06-20');
    await chenQuyetDinh(8, 'KHEN_THUONG', 5000000, '2020-07-01'); // ngoài tháng

    await chenChot(thang);
    const res = await goi('post', '/bangLuong', token.hr).send({ thang });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      code: 201,
      data: { maBangLuong: 'BL2020-06', thang: 6, nam: 2020, trangThai: 'BAN_NHAP', nguoiLapId: 4, ngayCongChuan: 22, thangNam: thang },
    });
    const bang = res.body.data;
    expect(bang.soPhieu).toBe(4); // NV0002, NV0003, NV0004, NV0008

    const p = await layPhieuDb(bang.id, 8);
    expect(Number(p.soNgayCongThucTe)).toBe(21);
    expect(Number(p.luongCoBan)).toBe(38000000);
    expect(Number(p.luongLamThemOT)).toBe(647727); // 38tr/22/8 * 2h * 1.5
    expect(Number(p.thuongKPI)).toBe(700000);
    expect(Number(p.tongPhuCap)).toBe(3818182); // 4tr * 21/22
    expect(Number(p.khauTruBaoHiem)).toBe(3990000);
    // tổng thu nhập = 36.272.727 + 647.727 + 700.000 + 3.818.182 = 41.438.636; tính thuế 26.448.636
    expect(Number(p.khauTruThueTNCN)).toBe(3639727);

    const p0 = await layPhieuDb(bang.id, 4); // không chấm công -> 0
    expect([p0.soNgayCongThucTe, p0.tongPhuCap, p0.khauTruBaoHiem, p0.khauTruThueTNCN].map(Number)).toEqual([0, 0, 0, 0]);

    const ct = await goi('get', `/bangLuong/${bang.id}`, token.hr);
    expect(ct.status).toBe(200);
    expect(ct.body.data.items).toHaveLength(4);
    const tong = ct.body.data.items.reduce((s, x) => s + x.tongThuNhap, 0);
    expect(tong).toBe(41438636);
    expect(Number((await layBangDb(bang.id)).tongChiPhiLuong)).toBe(tong);
    expect(ct.body.data.bangLuong.tongChiPhiLuong).toBe(tong);
    const nv8 = ct.body.data.items.find((x) => x.nhanVienId === 8);
    expect(nv8).toMatchObject({ luongTheoCong: 36272727, tongThuNhap: 41438636, thucLinh: 41438636 - 3990000 - 3639727 });

    const nk = await layNhatKy('LAP_BANG_LUONG');
    expect(nk).toHaveLength(1);
    expect(nk[0]).toMatchObject({ nguoiDungId: 4 });
    expect(nk[0].chiTiet.startsWith('BL2020-06')).toBe(true);

    expect((await goi('post', '/bangLuong', token.hr).send({ thang })).status).toBe(409);
    expect(await layNhatKy('LAP_BANG_LUONG')).toHaveLength(1);
  });
  test('nhân viên chấm dứt hợp đồng giữa tháng vẫn có phiếu theo công thực tế', async () => {
    const thang = '2020-07';
    const nv = await chenNhanVien({ trangThaiLamViec: 'DA_NGHI_VIEC', ngayKetThuc: '2020-07-15', trangThaiHd: 'DA_CHAM_DUT' });
    const ngay = ngayLamViec(thang).filter((x) => x <= '2020-07-15');
    for (const x of ngay) await chenCong(nv.id, x);
    const bang = await lapBangOk(thang);
    const p = await layPhieuDb(bang.id, nv.id);
    expect(p).toBeDefined();
    expect(Number(p.soNgayCongThucTe)).toBe(ngay.length);
    expect(Number(p.khauTruBaoHiem)).toBe(1050000);
    // Người đã nghỉ việc, không chấm công trong tháng sau -> không có phiếu
    const bang8 = await lapBangOk('2020-08');
    expect(await layPhieuDb(bang8.id, nv.id)).toBeUndefined();
  });
  test('phạt vượt thu nhập bị cắt khi lập bảng, nhật ký ghi phần bị bỏ', async () => {
    const thang = '2020-09';
    await chenQuyetDinh(4, 'KY_LUAT', 2000000, '2020-09-15'); // NV0004 không có công -> thu nhập 0
    const bang = await lapBangOk(thang);
    const p = await layPhieuDb(bang.id, 4);
    expect(Number(p.thuongKPI)).toBe(0);
    const [nk] = await layNhatKy('LAP_BANG_LUONG');
    expect(nk.chiTiet).toContain('NV0004');
  });
});

// ---------------------------------------------------------------------------
describe('Sửa phiếu lương', () => {
  async function chuanBi(thang = '2020-08') {
    const ngay = ngayLamViec(thang);
    for (const x of ngay.slice(0, 15)) await chenCong(8, x);
    const bang = await lapBangOk(thang);
    const p = await layPhieuDb(bang.id, 8);
    return { bang, phieuId: p.id, chuan: ngay.length };
  }

  test('HR sửa phiếu của chính mình -> 403; không tồn tại -> 404; body rỗng -> 400', async () => {
    const { bang } = await chuanBi();
    const pHr = await layPhieuDb(bang.id, 4);
    expect((await goi('patch', `/phieuLuong/${pHr.id}`, token.hr).send({ thuongKPI: 100000 })).status).toBe(403);
    expect((await goi('patch', '/phieuLuong/99999999', token.hr).send({ thuongKPI: 100000 })).status).toBe(404);
    expect((await goi('patch', `/phieuLuong/${pHr.id}`, token.hr).send({})).status).toBe(400);
  });
  test('số tiền: 2 chữ số thập phân 200; 3 chữ số/chữ/âm -> 400; thuongKPI được âm', async () => {
    const { phieuId } = await chuanBi();
    const ok = await goi('patch', `/phieuLuong/${phieuId}`, token.hr).send({ luongLamThemOT: 1000000.29 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ success: true, code: 200, data: { id: phieuId, luongLamThemOT: 1000000.29 } });
    for (const body of [
      { luongLamThemOT: 1000000.299 },
      { luongLamThemOT: 'abc' },
      { luongLamThemOT: -5 },
      { tongPhuCap: -1 },
      { tongPhuCap: '1e6' },
      { thuongKPI: null },
      { soNgayCongThucTe: true },
    ]) {
      expect([body, (await goi('patch', `/phieuLuong/${phieuId}`, token.hr).send(body)).status]).toEqual([body, 400]);
    }
    const am = await goi('patch', `/phieuLuong/${phieuId}`, token.hr).send({ thuongKPI: -100000 });
    expect(am.status).toBe(200);
    expect(am.body.data.thuongKPI).toBe(-100000);
    expect(await layNhatKy('SUA_PHIEU_LUONG')).toHaveLength(2);
  });
  test('ngày công vượt công chuẩn hoặc sai bước 0.5 -> 400', async () => {
    const { phieuId, chuan } = await chuanBi();
    for (const so of [chuan + 0.5, 10.3, -1]) {
      expect([so, (await goi('patch', `/phieuLuong/${phieuId}`, token.hr).send({ soNgayCongThucTe: so })).status]).toEqual([so, 400]);
    }
    expect(
      Number((await pool.execute('SELECT soNgayCongThucTe FROM phieuluongnhanvien WHERE id = ?', [phieuId]))[0][0].soNgayCongThucTe),
    ).toBe(15);
  });
  test('đổi ngày công: phụ cấp chia lại, thuế tự tính lại, tổng bảng cập nhật, ghi nhật ký', async () => {
    const { bang, phieuId, chuan } = await chuanBi();
    const res = await goi('patch', `/phieuLuong/${phieuId}`, token.hr).send({ soNgayCongThucTe: 20.5 });
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.soNgayCongThucTe).toBe(20.5);
    expect(d.tongPhuCap).toBe(Math.round((4000000 * 20.5) / chuan));
    expect(d.khauTruThueTNCN).toBe(tinhThueTNCN(d.tongThuNhap - d.khauTruBaoHiem - 11000000));
    const db = await layPhieuDb(bang.id, 8);
    expect(Number(db.khauTruThueTNCN)).toBe(d.khauTruThueTNCN);
    // Gửi kèm tongPhuCap thì giữ giá trị nhập tay
    const tay = await goi('patch', `/phieuLuong/${phieuId}`, token.hr).send({ soNgayCongThucTe: 10, tongPhuCap: 123456.5 });
    expect(tay.status).toBe(200);
    expect(tay.body.data.tongPhuCap).toBe(123456.5);
    const ct = await goi('get', `/bangLuong/${bang.id}`, token.hr);
    const tong = ct.body.data.items.reduce((s, x) => s + x.tongThuNhap, 0);
    expect(Number((await layBangDb(bang.id)).tongChiPhiLuong)).toBeCloseTo(tong, 2);
    const nk = await layNhatKy('SUA_PHIEU_LUONG');
    expect(nk).toHaveLength(2);
    expect(nk[0].chiTiet).toContain('NV0008');
  });
  test('phạt làm thực lĩnh âm -> 400, phiếu không đổi', async () => {
    const { phieuId } = await chuanBi();
    const loi = await goi('patch', `/phieuLuong/${phieuId}`, token.hr).send({ thuongKPI: -1000000000 });
    expect(loi.status).toBe(400);
    expect(loi.body.message).toBe('Các khoản khấu trừ vượt quá thu nhập: thực lĩnh không được âm');
    const [[p]] = await pool.execute('SELECT thuongKPI FROM phieuluongnhanvien WHERE id = ?', [phieuId]);
    expect(Number(p.thuongKPI)).toBe(0);
    expect(await layNhatKy('SUA_PHIEU_LUONG')).toHaveLength(0);
  });
  test('đổi ngày công tính lại bảo hiểm: về 0 công -> 200, BH 0; về lại 15 công -> BH đóng lại', async () => {
    const { bang, phieuId } = await chuanBi();
    expect(Number((await layPhieuDb(bang.id, 8)).khauTruBaoHiem)).toBe(3990000);
    const res = await goi('patch', `/phieuLuong/${phieuId}`, token.hr).send({ soNgayCongThucTe: 0 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ soNgayCongThucTe: 0, khauTruBaoHiem: 0, tongPhuCap: 0, khauTruThueTNCN: 0 });
    expect(res.body.data.thucLinh).toBeGreaterThanOrEqual(0);
    expect(Number((await layPhieuDb(bang.id, 8)).khauTruBaoHiem)).toBe(0);
    const lai = await goi('patch', `/phieuLuong/${phieuId}`, token.hr).send({ soNgayCongThucTe: 15 });
    expect(lai.status).toBe(200);
    expect(lai.body.data.khauTruBaoHiem).toBe(3990000);
  });
  test('bảng không phải BAN_NHAP -> 409', async () => {
    const { bang, phieuId } = await chuanBi();
    expect((await guiDuyet(bang.id)).status).toBe(200);
    expect((await goi('patch', `/phieuLuong/${phieuId}`, token.hr).send({ thuongKPI: 5000 })).status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
describe('Luồng duyệt bảng lương', () => {
  test('duyệt khi BAN_NHAP 409; gửi duyệt; trả lại thiếu lý do 400; trả lại; duyệt DA_DUYET', async () => {
    const bang = await lapBangOk('2020-06');
    expect((await goi('post', `/bangLuong/${bang.id}/duyet`, token.giamdoc)).status).toBe(409);
    const gui = await guiDuyet(bang.id);
    expect(gui.status).toBe(200);
    expect(gui.body.data.trangThai).toBe('CHO_DUYET');
    expect(await layNhatKy('GUI_DUYET_BANG_LUONG')).toEqual([{ nguoiDungId: 4, chiTiet: 'BL2020-06' }]);
    for (const body of [{}, { lyDo: '' }, { lyDo: 'abc' }]) {
      expect([body, (await goi('post', `/bangLuong/${bang.id}/traLai`, token.giamdoc).send(body)).status]).toEqual([body, 400]);
    }
    const lyDo = 'Sai ngày công phòng kỹ thuật';
    const tl = await goi('post', `/bangLuong/${bang.id}/traLai`, token.giamdoc).send({ lyDo });
    expect(tl.status).toBe(200);
    expect(tl.body.data.trangThai).toBe('BAN_NHAP');
    const nk = await layNhatKy('TRA_LAI_BANG_LUONG');
    expect(nk).toHaveLength(1);
    expect(nk[0].chiTiet).toContain(lyDo);
    expect((await guiDuyet(bang.id)).status).toBe(200);
    const dy = await goi('post', `/bangLuong/${bang.id}/duyet`, token.giamdoc);
    expect(dy.status).toBe(200);
    expect(dy.body.data).toMatchObject({ trangThai: 'DA_DUYET', nguoiDuyetId: 2 });
    expect((await layBangDb(bang.id)).nguoiDuyetId).toBe(2);
    expect(await layNhatKy('DUYET_BANG_LUONG')).toHaveLength(1);
    // Đã duyệt: mọi thao tác HR/giamDoc đều 409
    for (const [pt, dd, tk] of [
      ['post', 'tinhLai', token.hr],
      ['delete', '', token.hr],
      ['post', 'guiDuyet', token.hr],
      ['post', 'duyet', token.giamdoc2],
      ['post', 'traLai', token.giamdoc2],
    ]) {
      const res = await goi(pt, `/bangLuong/${bang.id}${dd ? `/${dd}` : ''}`, tk).send({ lyDo: 'Trả lại lần nữa' });
      expect([dd, res.status]).toEqual([dd, 409]);
    }
  });
  test('tinhLai/xoa/guiDuyet khi CHO_DUYET -> 409', async () => {
    const bang = await lapBangOk('2020-06');
    await guiDuyet(bang.id);
    expect((await goi('post', `/bangLuong/${bang.id}/tinhLai`, token.hr)).status).toBe(409);
    expect((await goi('delete', `/bangLuong/${bang.id}`, token.hr)).status).toBe(409);
    expect((await guiDuyet(bang.id)).status).toBe(409);
    expect((await layBangDb(bang.id)).trangThai).toBe('CHO_DUYET');
  });
  test('người lập không được tự duyệt/trả lại -> 403', async () => {
    const bang = await lapBangOk('2020-06');
    await pool.execute('UPDATE bangtonghopluong SET nguoiLapId = 2 WHERE id = ?', [bang.id]);
    await guiDuyet(bang.id);
    expect((await goi('post', `/bangLuong/${bang.id}/duyet`, token.giamdoc)).status).toBe(403);
    expect((await goi('post', `/bangLuong/${bang.id}/traLai`, token.giamdoc).send({ lyDo: 'Tự trả lại' })).status).toBe(403);
    expect((await layBangDb(bang.id)).trangThai).toBe('CHO_DUYET');
    expect((await goi('post', `/bangLuong/${bang.id}/duyet`, token.giamdoc2)).status).toBe(200);
  });
  test('giám đốc kiêm HR đã sửa phiếu không được tự duyệt', async () => {
    await pool.execute('INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES (8, ?)', [VAI_TRO_HR_ID]);
    const bang = await lapBangOk('2020-06');
    const p2 = await layPhieuDb(bang.id, 2);
    expect((await goi('patch', `/phieuLuong/${p2.id}`, token.giamdoc2).send({ thuongKPI: 100000 })).status).toBe(200);
    await guiDuyet(bang.id);
    expect((await goi('post', `/bangLuong/${bang.id}/duyet`, token.giamdoc2)).status).toBe(403);
    expect((await goi('post', `/bangLuong/${bang.id}/duyet`, token.giamdoc)).status).toBe(200);
  });
  test('giám đốc kiêm HR đã tính lại bảng không được tự duyệt; tính lại bỏ chỉnh sửa tay', async () => {
    await pool.execute('INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES (8, ?)', [VAI_TRO_HR_ID]);
    const bang = await lapBangOk('2020-06');
    const p2 = await layPhieuDb(bang.id, 2);
    expect((await goi('patch', `/phieuLuong/${p2.id}`, token.hr).send({ thuongKPI: 100000 })).status).toBe(200);
    const tl = await goi('post', `/bangLuong/${bang.id}/tinhLai`, token.giamdoc2);
    expect(tl.status).toBe(200);
    expect(Number((await layPhieuDb(bang.id, 2)).thuongKPI)).toBe(0);
    expect(await layNhatKy('TINH_LAI_BANG_LUONG')).toHaveLength(1);
    await guiDuyet(bang.id);
    expect((await goi('post', `/bangLuong/${bang.id}/duyet`, token.giamdoc2)).status).toBe(403);
    expect((await goi('post', `/bangLuong/${bang.id}/traLai`, token.giamdoc2).send({ lyDo: 'Tự trả lại' })).status).toBe(403);
    expect((await goi('post', `/bangLuong/${bang.id}/duyet`, token.giamdoc)).status).toBe(200);
  });
  test('giám đốc kiêm HR đã gửi duyệt không được tự duyệt/trả lại', async () => {
    await pool.execute('INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES (8, ?)', [VAI_TRO_HR_ID]);
    const bang = await lapBangOk('2020-06');
    expect((await goi('post', `/bangLuong/${bang.id}/guiDuyet`, token.giamdoc2)).status).toBe(200);
    expect((await goi('post', `/bangLuong/${bang.id}/duyet`, token.giamdoc2)).status).toBe(403);
    expect((await goi('post', `/bangLuong/${bang.id}/traLai`, token.giamdoc2).send({ lyDo: 'Tự trả lại' })).status).toBe(403);
    expect((await layBangDb(bang.id)).trangThai).toBe('CHO_DUYET');
    expect((await goi('post', `/bangLuong/${bang.id}/duyet`, token.giamdoc)).status).toBe(200);
  });
  test('xóa bảng nháp xóa cả phiếu (CASCADE) và ghi nhật ký', async () => {
    const bang = await lapBangOk('2020-06');
    const res = await goi('delete', `/bangLuong/${bang.id}`, token.hr);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: null });
    expect(await layBangDb(bang.id)).toBeUndefined();
    const [[d]] = await pool.execute('SELECT COUNT(*) AS n FROM phieuluongnhanvien WHERE bangTongHopLuongId = ?', [bang.id]);
    expect(Number(d.n)).toBe(0);
    expect(await layNhatKy('XOA_BANG_LUONG')).toHaveLength(1);
    expect((await goi('delete', `/bangLuong/${bang.id}`, token.hr)).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
describe('Xem phiếu lương', () => {
  test('cuaToi: seed nhanvien có phiếu đã duyệt, chỉ trả phiếu bảng DA_DUYET', async () => {
    const bang = await lapBangOk('2020-06');
    // Chèn phiếu của nhanvien (NV0005) vào bảng nháp
    const [kq] = await pool.execute(
      `INSERT INTO phieuluongnhanvien (bangTongHopLuongId, nhanVienId, soNgayCongThucTe, luongCoBan, luongLamThemOT, thuongKPI,
         tongPhuCap, khauTruBaoHiem, khauTruThueTNCN) VALUES (?, 5, 10, 13000000, 0, 0, 0, 0, 0)`,
      [bang.id],
    );
    const res = await goi('get', '/phieuLuong/cuaToi', token.nhanvien);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.every((p) => p.trangThaiBangLuong === 'DA_DUYET' && p.nhanVienId === 5)).toBe(true);
    expect(res.body.data.some((p) => p.id === kq.insertId)).toBe(false);
    expect((await goi('get', `/phieuLuong/${kq.insertId}`, token.nhanvien)).status).toBe(404);
    expect((await goi('get', '/phieuLuong/cuaToi?nam=20', token.nhanvien)).status).toBe(400);

    await pool.execute("UPDATE bangtonghopluong SET trangThai = 'DA_DUYET', nguoiDuyetId = 2 WHERE id = ?", [bang.id]);
    expect((await goi('get', `/phieuLuong/${kq.insertId}`, token.nhanvien)).status).toBe(200);
    const nam2020 = await goi('get', '/phieuLuong/cuaToi?nam=2020', token.nhanvien);
    expect(nam2020.body.data.map((p) => p.id)).toEqual([kq.insertId]);
  });
  test('phiếu người khác: nhanVien 404, HR/giamDoc 200', async () => {
    const bang = await lapBangOk('2020-06');
    await pool.execute("UPDATE bangtonghopluong SET trangThai = 'DA_DUYET', nguoiDuyetId = 2 WHERE id = ?", [bang.id]);
    const p = await layPhieuDb(bang.id, 8);
    const loi = await goi('get', `/phieuLuong/${p.id}`, token.nhanvien);
    expect(loi.status).toBe(404);
    expect(loi.body).toMatchObject({ success: false, code: 404, data: null });
    expect((await goi('get', `/phieuLuong/${p.id}`, token.quanly)).status).toBe(404);
    for (const ten of ['hr', 'giamdoc']) {
      const res = await goi('get', `/phieuLuong/${p.id}`, token[ten]);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: p.id, nhanVienId: 8, maNhanVien: 'NV0008' });
      expect(res.body.data).not.toHaveProperty('soTaiKhoanNganHang');
    }
    expect((await goi('get', '/phieuLuong/abc', token.hr)).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('Xuất Excel và báo cáo', () => {
  test('xuatExcel: text/csv, BOM, dòng tiêu đề, chặn chèn công thức', async () => {
    const nv = await chenNhanVien({ hoVaTen: '=HYPERLINK("x")' });
    const bang = await lapBangOk('2020-10');
    const res = await goi('get', `/bangLuong/${bang.id}/xuatExcel`, token.giamdoc)
      .buffer(true)
      .parse((r, cb) => {
        let s = '';
        r.setEncoding('utf8');
        r.on('data', (c) => {
          s += c;
        });
        r.on('end', () => cb(null, s));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv/);
    expect(res.headers['content-disposition']).toContain('BL2020-10_2020-10.csv');
    const noiDung = res.body;
    expect(noiDung.charCodeAt(0)).toBe(0xfeff);
    const dong = noiDung.slice(1).split('\r\n');
    expect(dong[0]).toBe(
      'Mã NV,Họ và tên,Phòng ban,Chức danh,Ngày công chuẩn,Ngày công thực tế,Lương cơ bản,Lương theo công,' +
        'Lương làm thêm,Thưởng/Phạt,Trong đó thưởng KPI,Trong đó khen thưởng - kỷ luật,Phụ cấp,Tổng thu nhập,Bảo hiểm,Thuế TNCN,Thực lĩnh',
    );
    const dongNv = dong.find((x) => x.startsWith(nv.maNhanVien));
    expect(dongNv).toContain('"\'=HYPERLINK(""x"")"');
    expect((await goi('get', '/bangLuong/99999999/xuatExcel', token.hr)).status).toBe(404);
  });
  test('baoCao: chỉ tính bảng DA_DUYET, theo tháng và phòng ban; năm sai 400', async () => {
    const ngay = ngayLamViec('2020-11');
    for (const x of ngay) await chenCong(8, x);
    const daDuyet = await lapBangOk('2020-11');
    await pool.execute("UPDATE bangtonghopluong SET trangThai = 'DA_DUYET', nguoiDuyetId = 2 WHERE id = ?", [daDuyet.id]);
    for (const x of ngayLamViec('2020-12')) await chenCong(2, x);
    await lapBangOk('2020-12'); // nháp, không tính

    const res = await goi('get', '/bangLuong/baoCao?nam=2020', token.giamdoc);
    expect(res.status).toBe(200);
    const bc = res.body.data;
    const tong = Number((await layBangDb(daDuyet.id)).tongChiPhiLuong);
    expect(bc.nam).toBe(2020);
    expect(bc.theoThang.map((t) => t.thang)).toEqual([11]);
    expect(bc.tongNam).toBe(tong);
    expect(bc.theoThang[0]).toMatchObject({ soNhanVien: daDuyet.soPhieu, tongThuNhap: tong });
    expect(bc.theoPhongBan.reduce((s, p) => s + p.soNhanVien, 0)).toBe(daDuyet.soPhieu);
    expect(bc.theoPhongBan.reduce((s, p) => s + p.tongThuNhap, 0)).toBe(tong);
    expect((await goi('get', '/bangLuong/baoCao?nam=2019', token.hr)).body.data.theoThang).toEqual([]);
    for (const nam of ['abc', '1999', '20201']) {
      expect([nam, (await goi('get', `/bangLuong/baoCao?nam=${nam}`, token.hr)).status]).toEqual([nam, 400]);
    }
  });
  test('danh sách bảng lọc theo năm/trạng thái; trạng thái sai 400', async () => {
    const bang = await lapBangOk('2020-06');
    const res = await goi('get', '/bangLuong?nam=2020&trangThai=BAN_NHAP', token.hr);
    expect(res.status).toBe(200);
    expect(res.body.data.map((b) => b.id)).toEqual([bang.id]);
    expect((await goi('get', '/bangLuong?trangThai=PENDING', token.hr)).status).toBe(400);
  });
});
