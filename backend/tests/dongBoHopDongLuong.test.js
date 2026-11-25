const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const luongRepository = require('../src/repositories/luongRepository');
const chamCongRepository = require('../src/repositories/chamCongRepository');

// Đề xuất 4b: đổi hợp đồng ở tháng đã có bảng lương -> cảnh báo; bảng nháp cũ hơn hợp đồng -> chặn gửi duyệt.
// Bảng lương chèn thẳng vào CSDL (tháng 2019 / tháng tương lai, seed không có) để không cần chốt công.
const MAT_KHAU = 'MatKhau@123';
const NV_HR = 4; // NV0004 (hr) làm người lập bảng
const NGAY_VAO_LAM = '2019-01-02';

const token = {};
let anhChup;
let mocNhatKyDau;
let demTen = 0;

function ngay(soNgay = 0) {
  const d = new Date();
  d.setDate(d.getDate() + soNgay);
  return d.toLocaleDateString('sv-SE');
}

const dangNhap = (tenDangNhap) =>
  request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap, matKhau: MAT_KHAU });
const goi = (phuongThuc, duongDan) => request(app)[phuongThuc](`/api/v1${duongDan}`).set('Authorization', `Bearer ${token.hr}`);

async function taoNhanVien(ngayVaoLam = NGAY_VAO_LAM) {
  demTen += 1;
  const ten = `qadb${Date.now() % 100000}${demTen}`;
  const res = await goi('post', '/nhanVien').send({
    hoVaTen: 'Lê Đồng Bộ',
    gioiTinh: 'NU',
    ngaySinh: '1990-05-20',
    ngayVaoLam,
    chucDanhPhongBanId: 5,
    tenDangNhap: ten,
    email: `${ten}@smarthrm.local`,
  });
  expect(res.status).toBe(201);
  return res.body.data.nhanVien;
}

async function taoHopDong(nhanVienId, ghiDe = {}) {
  const res = await goi('post', '/hopDong').send({
    nhanVienId,
    loaiHopDong: 'KHONG_XAC_DINH_THOI_HAN',
    ngayBatDau: NGAY_VAO_LAM,
    luongCoBan: 12000000,
    mucPhuCap: 500000,
    ...ghiDe,
  });
  expect(res.status).toBe(201);
  return res.body.data;
}

// Bảng lương tháng YYYY-MM chèn thẳng; coPhieuCua: thêm phiếu cho nhân viên đó
async function taoBang(thangNam, trangThai = 'BAN_NHAP', coPhieuCua = null) {
  const [nam, thang] = thangNam.split('-').map(Number);
  const ma = `BL${thangNam}`;
  const [kq] = await pool.execute(
    'INSERT INTO bangtonghopluong (maBangLuong, thang, nam, trangThai, nguoiLapId, nguoiDuyetId) VALUES (?, ?, ?, ?, ?, ?)',
    [ma, thang, nam, trangThai, NV_HR, trangThai === 'DA_DUYET' ? 2 : null],
  );
  if (coPhieuCua) {
    await pool.execute(
      'INSERT INTO phieuluongnhanvien (bangTongHopLuongId, nhanVienId, soNgayCongThucTe, luongCoBan) VALUES (?, ?, 20, 12000000)',
      [kq.insertId, coPhieuCua],
    );
  }
  return { id: kq.insertId, ma };
}

// Mô phỏng lần lập/tính lại bảng (nhật ký là mốc "đã tính" của bảng)
const ghiLanTinh = (ma, hanhDong = 'LAP_BANG_LUONG') =>
  pool.execute('INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, chiTiet) VALUES (NULL, ?, ?)', [hanhDong, `${ma}: 1 phiếu`]);

const thangCua = (chuoiNgay) => chuoiNgay.slice(0, 7);

async function datLaiAutoIncrement() {
  for (const bang of [
    'hopdonglaodong',
    'lichsuhopdong',
    'nhanvien',
    'nguoidung',
    'nhatkyhethong',
    'bangtonghopluong',
    'phieuluongnhanvien',
  ]) {
    await pool.query(`ALTER TABLE ${bang} AUTO_INCREMENT = 1`);
  }
}

beforeAll(async () => {
  const lay = async (bang) => (await pool.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${bang}`))[0][0].m;
  mocNhatKyDau = await lay('nhatkyhethong');
  const res = await dangNhap('hr');
  expect(res.status).toBe(200);
  token.hr = res.body.data.token;
  anhChup = {
    hopDong: await lay('hopdonglaodong'),
    lichSu: await lay('lichsuhopdong'),
    nhanVien: await lay('nhanvien'),
    nguoiDung: await lay('nguoidung'),
    bang: await lay('bangtonghopluong'),
    nhatKy: await lay('nhatkyhethong'),
  };
});

afterEach(async () => {
  jest.restoreAllMocks();
  await pool.execute('DELETE FROM bangtonghopluong WHERE id > ?', [anhChup.bang]); // phiếu CASCADE
  await pool.execute('DELETE FROM hopdonglaodong WHERE id > ?', [anhChup.hopDong]); // lịch sử CASCADE
  await pool.execute('DELETE FROM lichsuhopdong WHERE id > ?', [anhChup.lichSu]);
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [anhChup.nhatKy]);
  await pool.execute('DELETE FROM nhanvien WHERE id > ?', [anhChup.nhanVien]);
  await pool.execute('DELETE FROM nguoidungvaitro WHERE nguoiDungId > ?', [anhChup.nguoiDung]);
  await pool.execute('DELETE FROM nguoidung WHERE id > ?', [anhChup.nguoiDung]);
  await datLaiAutoIncrement();
});

afterAll(async () => {
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKyDau]);
  await datLaiAutoIncrement();
  await pool.end();
});

describe('Cảnh báo bảng lương khi đổi hợp đồng', () => {
  test('điều chỉnh lương: cảnh báo bảng nháp, chờ duyệt, đã duyệt; message ghép cảnh báo', async () => {
    const nv = await taoNhanVien();
    const hd = await taoHopDong(nv.id);
    const nhap = await taoBang('2019-03', 'BAN_NHAP', nv.id);
    const cho = await taoBang('2019-04', 'CHO_DUYET', nv.id);
    const da = await taoBang('2019-05', 'DA_DUYET', nv.id);
    const res = await goi('post', `/hopDong/${hd.id}/dieuChinh`).send({ luongCoBan: 15000000, lyDo: 'Tăng lương' });
    expect(res.status).toBe(200);
    const { canhBao } = res.body.data;
    expect(canhBao).toContain(`Bảng lương nháp ${nhap.ma} bị ảnh hưởng`);
    expect(canhBao).toContain('Tính lại');
    expect(canhBao).toContain(`${cho.ma} đang chờ duyệt`);
    expect(canhBao).toMatch(new RegExp(`Bảng lương [^.]*${da.ma}[^.]* đã duyệt`));
    expect(res.body.message).toBe(`Điều chỉnh hợp đồng thành công. ${canhBao}`);
  });

  test('chỉ đổi file đính kèm: không cảnh báo', async () => {
    const nv = await taoNhanVien();
    const hd = await taoHopDong(nv.id);
    await taoBang('2019-03', 'BAN_NHAP', nv.id);
    const res = await goi('post', `/hopDong/${hd.id}/dieuChinh`).send({ duongDanFileHopDong: '/f/pl.pdf', lyDo: 'Bổ sung file' });
    expect(res.status).toBe(200);
    expect(res.body.data.canhBao).toBeUndefined();
    expect(res.body.message).toBe('Điều chỉnh hợp đồng thành công');
  });

  test('không có bảng lương liên quan: không cảnh báo', async () => {
    const nv = await taoNhanVien(ngay(0));
    // Hợp đồng bắt đầu ở tương lai: chưa tháng nào có bảng lương
    const hd = await taoHopDong(nv.id, {
      loaiHopDong: 'XAC_DINH_THOI_HAN',
      ngayBatDau: ngay(40),
      ngayKetThuc: ngay(300),
    });
    const res = await goi('post', `/hopDong/${hd.id}/dieuChinh`).send({ mucPhuCap: 700000, lyDo: 'Tăng phụ cấp' });
    expect(res.status).toBe(200);
    expect(res.body.data.canhBao).toBeUndefined();
  });

  test('chấm dứt: tháng chứa ngày chấm dứt không cảnh báo, tháng sau đó có', async () => {
    const nv = await taoNhanVien();
    const hd = await taoHopDong(nv.id);
    const cungThang = await taoBang('2019-03', 'BAN_NHAP', nv.id);
    const thangSau = await taoBang('2019-04', 'BAN_NHAP', nv.id);
    const res = await goi('post', `/hopDong/${hd.id}/chamDut`).send({ ngayChamDut: '2019-03-15', lyDo: 'Nghỉ việc' });
    expect(res.status).toBe(200);
    expect(res.body.data.canhBao).toContain(thangSau.ma);
    expect(res.body.data.canhBao).not.toContain(cungThang.ma);
  });

  test('lập hợp đồng lùi ngày: chỉ cảnh báo tháng nhân viên đủ điều kiện tính lương', async () => {
    const nv = await taoNhanVien();
    const truocVaoLam = await taoBang('2018-12'); // trước ngày vào làm: không liên quan
    const sauVaoLam = await taoBang('2019-06');
    const hd = await taoHopDong(nv.id);
    expect(hd.canhBao).toContain(sauVaoLam.ma);
    expect(hd.canhBao).not.toContain(truocVaoLam.ma);
  });

  test('bảng không có phiếu và nhân viên không đủ điều kiện (nghỉ trước tháng đó): không cảnh báo', async () => {
    const nv = await taoNhanVien();
    const hd = await taoHopDong(nv.id, { loaiHopDong: 'XAC_DINH_THOI_HAN', ngayKetThuc: '2019-12-31' });
    await taoBang('2019-10'); // không có phiếu của nhân viên; sau chấm dứt không còn đủ điều kiện
    const res = await goi('post', `/hopDong/${hd.id}/chamDut`).send({ ngayChamDut: '2019-06-30', lyDo: 'Nghỉ' });
    expect(res.status).toBe(200);
    expect(res.body.data.canhBao).toBeUndefined();
  });

  test('gia hạn: cảnh báo tháng nằm trong phần kéo dài thêm', async () => {
    const nv = await taoNhanVien(ngay(-60));
    const hd = await taoHopDong(nv.id, { loaiHopDong: 'XAC_DINH_THOI_HAN', ngayBatDau: ngay(-60), ngayKetThuc: ngay(20) });
    const keoDai = await taoBang(thangCua(ngay(90)));
    const res = await goi('post', `/hopDong/${hd.id}/giaHan`).send({ ngayKetThucMoi: ngay(150), lyDo: 'Gia hạn' });
    expect(res.status).toBe(200);
    expect(res.body.data.canhBao).toContain(keoDai.ma);
  });
});

describe('Chặn gửi duyệt bảng nháp cũ hơn hợp đồng', () => {
  test('HR khác đổi hợp đồng sau lần tính bảng -> 409; tính lại xong -> gửi duyệt được', async () => {
    const nv = await taoNhanVien();
    const hd = await taoHopDong(nv.id);
    const bang = await taoBang('2019-07', 'BAN_NHAP', nv.id);
    await ghiLanTinh(bang.ma);

    expect((await goi('post', `/hopDong/${hd.id}/dieuChinh`).send({ luongCoBan: 20000000, lyDo: 'Tăng' })).status).toBe(200);
    const chan = await goi('post', `/bangLuong/${bang.id}/guiDuyet`);
    expect(chan.status).toBe(409);
    expect(chan.body.message).toContain(nv.maNhanVien);
    expect(chan.body.message).toContain('Tính lại');
    const [[b]] = await pool.execute('SELECT trangThai FROM bangtonghopluong WHERE id = ?', [bang.id]);
    expect(b.trangThai).toBe('BAN_NHAP');

    await ghiLanTinh(bang.ma, 'TINH_LAI_BANG_LUONG');
    expect((await goi('post', `/bangLuong/${bang.id}/guiDuyet`)).status).toBe(200);
  });

  test('hợp đồng đổi TRƯỚC lần tính bảng (cùng giây): không chặn', async () => {
    const nv = await taoNhanVien();
    const hd = await taoHopDong(nv.id);
    const bang = await taoBang('2019-08', 'BAN_NHAP', nv.id);
    expect((await goi('post', `/hopDong/${hd.id}/dieuChinh`).send({ luongCoBan: 21000000, lyDo: 'Tăng' })).status).toBe(200);
    await ghiLanTinh(bang.ma);
    expect((await goi('post', `/bangLuong/${bang.id}/guiDuyet`)).status).toBe(200);
  });

  test('đổi hợp đồng chỉ file hoặc ở tháng khác: không chặn', async () => {
    const nv = await taoNhanVien();
    const hd = await taoHopDong(nv.id, { loaiHopDong: 'XAC_DINH_THOI_HAN', ngayKetThuc: '2019-12-31' });
    const bang = await taoBang('2019-03', 'BAN_NHAP', nv.id);
    await ghiLanTinh(bang.ma);
    await goi('post', `/hopDong/${hd.id}/dieuChinh`).send({ duongDanFileHopDong: '/f/x.pdf', lyDo: 'File' });
    // Chấm dứt từ 2019-10: chỉ ảnh hưởng tháng 11-12, không ảnh hưởng bảng tháng 3
    expect((await goi('post', `/hopDong/${hd.id}/chamDut`).send({ ngayChamDut: '2019-10-31', lyDo: 'Nghỉ' })).status).toBe(200);
    expect((await goi('post', `/bangLuong/${bang.id}/guiDuyet`)).status).toBe(200);
  });

  test('gửi duyệt khóa đọc hợp đồng của tháng (LOCK IN SHARE MODE)', async () => {
    const bang = await taoBang('2019-09');
    await ghiLanTinh(bang.ma);
    const khoa = jest.spyOn(luongRepository, 'khoaHopDongTrongThang');
    expect((await goi('post', `/bangLuong/${bang.id}/guiDuyet`)).status).toBe(200);
    expect(khoa).toHaveBeenCalledWith('2019-09-01', '2019-09-30', expect.anything());
  });

  test('lập bảng khóa hợp đồng TRƯỚC câu đọc thường đầu tiên (snapshot REPEATABLE READ thấy hợp đồng mới nhất)', async () => {
    const thuTu = [];
    jest.spyOn(luongRepository, 'khoaHopDongTrongThang').mockImplementation(async () => thuTu.push('khoa'));
    jest.spyOn(chamCongRepository, 'layThongTinChot').mockImplementation(async () => {
      thuTu.push('docChot');
      return null; // chưa chốt -> 409, chỉ cần thứ tự gọi
    });
    const res = await goi('post', '/bangLuong').send({ thang: '2019-11' });
    expect(res.status).toBe(409);
    expect(thuTu).toEqual(['khoa', 'docChot']);
  });
});
