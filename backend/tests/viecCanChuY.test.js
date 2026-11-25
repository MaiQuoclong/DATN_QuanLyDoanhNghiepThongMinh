const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const hopDongService = require('../src/services/hopDongService');
const nghiPhepService = require('../src/services/nghiPhepService');

// Chuông "Việc cần chú ý": so sánh số đếm trước/sau khi tự chèn dữ liệu (không phụ thuộc số liệu seed).
// Mọi bản ghi tự tạo đều có id > ảnh chụp MAX(id) và bị xóa trong afterEach.
const MAT_KHAU = 'MatKhau@123';
const NV_GIAMDOC = 2;
const NV_HR = 4;
const NV_NHANVIEN = 5; // phòng do quanly phụ trách
const NV_NHANVIEN3 = 10; // phòng do quanly2 phụ trách
const BANG = ['dondexuatnghiphep', 'yeucaudieuchinhchamcong', 'dexuatkhenthuongkyluat'];
const TAI_KHOAN = ['admin', 'giamdoc', 'giamdoc2', 'quanly', 'quanly2', 'hr', 'hr2', 'nhanvien'];

const token = {};
let anhChup;

const goi = (tk) => {
  const r = request(app).get('/api/v1/viecCanChuY');
  return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
};
async function soLuong(tk, loai) {
  const res = await goi(tk);
  expect(res.status).toBe(200);
  return res.body.data.items.find((m) => m.loai === loai)?.soLuong ?? 0;
}
async function cacLoai(tk) {
  return (await goi(tk)).body.data.items.map((m) => m.loai);
}

let soDon = 0;
async function taoDonNghi(nhanVienId, soNgayNghi) {
  soDon += 1;
  await pool.execute(
    `INSERT INTO dondexuatnghiphep (maDon, nhanVienId, loaiNghiPhepId, ngayBatDau, ngayKetThuc, soNgayNghi, lyDo, trangThai)
     VALUES (?, ?, (SELECT MIN(id) FROM loainghiphep), '2031-03-03', '2031-03-12', ?, 'QA chuông', 'CHO_DUYET')`,
    [`QA-CHUONG-${Date.now()}-${soDon}`, nhanVienId, soNgayNghi],
  );
}
async function taoDieuChinh(nhanVienId) {
  await pool.execute(
    `INSERT INTO yeucaudieuchinhchamcong (nhanVienId, ngayCanDieuChinh, gioVaoDeXuat, lyDoGiaiTrinh, trangThai)
     VALUES (?, '2031-03-03', '08:00:00', 'QA chuông', 'CHO_DUYET')`,
    [nhanVienId],
  );
}
async function taoDeXuat(trangThai, nguoiXuLyId = null, nhanVienId = NV_NHANVIEN) {
  await pool.execute(
    `INSERT INTO dexuatkhenthuongkyluat (nguoiDeXuatId, nhanVienId, loaiDeXuat, tieuDe, lyDo, soTienDeXuat, trangThai, nguoiXuLyId)
     VALUES (?, ?, 'KHEN_THUONG', 'QA chuông', 'QA chuông', 100000, ?, ?)`,
    [NV_HR, nhanVienId, trangThai, nguoiXuLyId],
  );
}

beforeAll(async () => {
  for (const tk of TAI_KHOAN) {
    const res = await request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap: tk, matKhau: MAT_KHAU });
    token[tk] = res.body.data.token;
  }
});

beforeEach(async () => {
  anhChup = {};
  for (const bang of BANG) anhChup[bang] = (await pool.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${bang}`))[0][0].m;
});

afterEach(async () => {
  jest.restoreAllMocks();
  for (const bang of BANG) {
    await pool.execute(`DELETE FROM ${bang} WHERE id > ?`, [anhChup[bang]]);
    await pool.query(`ALTER TABLE ${bang} AUTO_INCREMENT = 1`);
  }
});

afterAll(() => pool.end());

describe('GET /api/v1/viecCanChuY', () => {
  test('401 khi chưa đăng nhập', async () => {
    const res = await goi();
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test.each(TAI_KHOAN)('%s gọi được, đúng cấu trúc', async (tk) => {
    const res = await goi(token[tk]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200, message: 'Lấy danh sách việc cần chú ý thành công' });
    const { tongSo, items, nguonLoi } = res.body.data;
    expect(nguonLoi).toEqual([]);
    expect(tongSo).toBe(items.reduce((t, m) => t + m.soLuong, 0));
    for (const m of items) {
      expect(m).toEqual({
        loai: expect.any(String),
        tieuDe: expect.any(String),
        soLuong: expect.any(Number),
        duongDan: expect.any(String),
      });
      expect(m.soLuong).toBeGreaterThan(0);
    }
  });

  test('nhanVien và Admin không có mục quản trị', async () => {
    const quanTri = [
      'DON_NGHI_CHO_DUYET',
      'DIEU_CHINH_CONG_CHO_DUYET',
      'DE_XUAT_CHO_XU_LY',
      'DE_XUAT_CHO_KY',
      'KPI_CAN_NGHIEM_THU',
      'HOP_DONG_SAP_HET_HAN',
    ];
    await taoDonNghi(NV_NHANVIEN, 1);
    await taoDieuChinh(NV_NHANVIEN);
    for (const tk of ['nhanvien', 'admin']) {
      const loai = await cacLoai(token[tk]);
      expect(loai.filter((l) => quanTri.includes(l))).toEqual([]);
    }
  });

  test('đơn nghỉ ngắn ngày: quanLy phòng đó và giamDoc đếm, quanLy phòng khác không', async () => {
    const truoc = {
      quanly: await soLuong(token.quanly, 'DON_NGHI_CHO_DUYET'),
      quanly2: await soLuong(token.quanly2, 'DON_NGHI_CHO_DUYET'),
      giamdoc: await soLuong(token.giamdoc, 'DON_NGHI_CHO_DUYET'),
    };
    await taoDonNghi(NV_NHANVIEN, 1);
    expect(await soLuong(token.quanly, 'DON_NGHI_CHO_DUYET')).toBe(truoc.quanly + 1);
    expect(await soLuong(token.quanly2, 'DON_NGHI_CHO_DUYET')).toBe(truoc.quanly2);
    expect(await soLuong(token.giamdoc, 'DON_NGHI_CHO_DUYET')).toBe(truoc.giamdoc + 1);
  });

  test('đơn dài ngày chuyển giamDoc: quanLy không đếm', async () => {
    const truocQl = await soLuong(token.quanly, 'DON_NGHI_CHO_DUYET');
    const truocGd = await soLuong(token.giamdoc, 'DON_NGHI_CHO_DUYET');
    await taoDonNghi(NV_NHANVIEN, 8);
    expect(await soLuong(token.quanly, 'DON_NGHI_CHO_DUYET')).toBe(truocQl);
    expect(await soLuong(token.giamdoc, 'DON_NGHI_CHO_DUYET')).toBe(truocGd + 1);
  });

  test('điều chỉnh công: không đếm yêu cầu của chính mình, đếm của người khác', async () => {
    const truocHr = await soLuong(token.hr, 'DIEU_CHINH_CONG_CHO_DUYET');
    const truocHr2 = await soLuong(token.hr2, 'DIEU_CHINH_CONG_CHO_DUYET');
    await taoDieuChinh(NV_HR);
    expect(await soLuong(token.hr, 'DIEU_CHINH_CONG_CHO_DUYET')).toBe(truocHr);
    expect(await soLuong(token.hr2, 'DIEU_CHINH_CONG_CHO_DUYET')).toBe(truocHr2 + 1);
  });

  test('điều chỉnh công phòng khác: quanly2 không đếm của nhân viên phòng quanly', async () => {
    const truoc = await soLuong(token.quanly2, 'DIEU_CHINH_CONG_CHO_DUYET');
    const truocQl = await soLuong(token.quanly, 'DIEU_CHINH_CONG_CHO_DUYET');
    await taoDieuChinh(NV_NHANVIEN);
    expect(await soLuong(token.quanly2, 'DIEU_CHINH_CONG_CHO_DUYET')).toBe(truoc);
    expect(await soLuong(token.quanly, 'DIEU_CHINH_CONG_CHO_DUYET')).toBe(truocQl + 1);
  });

  test('đề xuất CHO_DUYET: HR đếm; CHO_KY: chỉ Giám đốc được trình', async () => {
    const truocHr = await soLuong(token.hr, 'DE_XUAT_CHO_XU_LY');
    const truocGd = await soLuong(token.giamdoc, 'DE_XUAT_CHO_KY');
    const truocGd2 = await soLuong(token.giamdoc2, 'DE_XUAT_CHO_KY');
    await taoDeXuat('CHO_DUYET');
    await taoDeXuat('CHO_KY', NV_GIAMDOC);
    expect(await soLuong(token.hr, 'DE_XUAT_CHO_XU_LY')).toBe(truocHr + 1);
    expect(await soLuong(token.giamdoc, 'DE_XUAT_CHO_KY')).toBe(truocGd + 1);
    expect(await soLuong(token.giamdoc2, 'DE_XUAT_CHO_KY')).toBe(truocGd2);
    expect(await cacLoai(token.quanly)).not.toContain('DE_XUAT_CHO_KY');
  });

  test('đề xuất về chính mình: HR và Giám đốc không đếm (không xử lý/ký được)', async () => {
    const truocHr = await soLuong(token.hr, 'DE_XUAT_CHO_XU_LY');
    const truocHr2 = await soLuong(token.hr2, 'DE_XUAT_CHO_XU_LY');
    const truocGd = await soLuong(token.giamdoc, 'DE_XUAT_CHO_KY');
    await taoDeXuat('CHO_DUYET', null, NV_HR);
    await taoDeXuat('CHO_KY', NV_GIAMDOC, NV_GIAMDOC);
    expect(await soLuong(token.hr, 'DE_XUAT_CHO_XU_LY')).toBe(truocHr);
    expect(await soLuong(token.hr2, 'DE_XUAT_CHO_XU_LY')).toBe(truocHr2 + 1);
    expect(await soLuong(token.giamdoc, 'DE_XUAT_CHO_KY')).toBe(truocGd);
  });

  test('hợp đồng của chính HR không tính cho HR đó', async () => {
    jest.spyOn(hopDongService, 'laySapHetHan').mockResolvedValue([
      { id: 1, nhanVienId: NV_HR },
      { id: 2, nhanVienId: NV_NHANVIEN },
    ]);
    expect(await soLuong(token.hr, 'HOP_DONG_SAP_HET_HAN')).toBe(1);
    expect(await soLuong(token.hr2, 'HOP_DONG_SAP_HET_HAN')).toBe(2);
    expect(await soLuong(token.giamdoc, 'HOP_DONG_SAP_HET_HAN')).toBe(2);
  });

  test('hợp đồng sắp hết hạn chỉ HR và giamDoc', async () => {
    jest.spyOn(hopDongService, 'laySapHetHan').mockResolvedValue([{ id: 1 }, { id: 2 }]);
    expect(await soLuong(token.hr, 'HOP_DONG_SAP_HET_HAN')).toBe(2);
    expect(await soLuong(token.giamdoc, 'HOP_DONG_SAP_HET_HAN')).toBe(2);
    expect(await cacLoai(token.quanly)).not.toContain('HOP_DONG_SAP_HET_HAN');
    expect(await cacLoai(token.nhanvien)).not.toContain('HOP_DONG_SAP_HET_HAN');
  });

  test('một nguồn lỗi: vẫn 200, ghi vào nguonLoi', async () => {
    jest.spyOn(hopDongService, 'laySapHetHan').mockRejectedValue(new Error('mất kết nối'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await goi(token.hr);
    expect(res.status).toBe(200);
    expect(res.body.data.nguonLoi).toEqual(['HOP_DONG_SAP_HET_HAN']);
    expect(res.body.data.items.map((m) => m.loai)).not.toContain('HOP_DONG_SAP_HET_HAN');
  });
});

describe('theoLoai / vuotTran (dùng chung cho trang Tổng quan)', () => {
  const KHOA_THEO_VAI_TRO = {
    admin: ['KPI_CAN_TU_CHAM'], // Admin seed có hồ sơ nhân viên
    nhanvien: ['KPI_CAN_TU_CHAM'],
    quanly: ['DON_NGHI_CHO_DUYET', 'DIEU_CHINH_CONG_CHO_DUYET', 'KPI_CAN_TU_CHAM', 'KPI_CAN_NGHIEM_THU'],
    hr: ['DIEU_CHINH_CONG_CHO_DUYET', 'DE_XUAT_CHO_XU_LY', 'KPI_CAN_TU_CHAM', 'HOP_DONG_SAP_HET_HAN'],
    giamdoc: [
      'DON_NGHI_CHO_DUYET',
      'DIEU_CHINH_CONG_CHO_DUYET',
      'DE_XUAT_CHO_KY',
      'KPI_CAN_TU_CHAM',
      'KPI_CAN_NGHIEM_THU',
      'HOP_DONG_SAP_HET_HAN',
    ],
  };

  test.each(Object.keys(KHOA_THEO_VAI_TRO))('%s: theoLoai đúng các nguồn áp dụng, khớp items và tongSo', async (tk) => {
    const { theoLoai, items, tongSo, vuotTran } = (await goi(token[tk])).body.data;
    expect(Object.keys(theoLoai).sort()).toEqual([...KHOA_THEO_VAI_TRO[tk]].sort());
    expect(vuotTran).toEqual([]);
    for (const m of items) expect(theoLoai[m.loai]).toBe(m.soLuong);
    // Loại có 0 việc vẫn có trong theoLoai nhưng không có trong items
    const coViec = Object.entries(theoLoai).filter(([, so]) => so > 0);
    expect(coViec.length).toBe(items.length);
    expect(tongSo).toBe(coViec.reduce((t, [, so]) => t + so, 0));
  });

  test('loại 0 việc: có trong theoLoai với giá trị 0, không có trong items', async () => {
    jest.spyOn(hopDongService, 'laySapHetHan').mockResolvedValue([]);
    const { theoLoai, items } = (await goi(token.hr)).body.data;
    expect(theoLoai.HOP_DONG_SAP_HET_HAN).toBe(0);
    expect(items.map((m) => m.loai)).not.toContain('HOP_DONG_SAP_HET_HAN');
  });

  test('nguồn lỗi: theoLoai = null', async () => {
    jest.spyOn(hopDongService, 'laySapHetHan').mockRejectedValue(new Error('mất kết nối'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { theoLoai, nguonLoi } = (await goi(token.giamdoc)).body.data;
    expect(theoLoai.HOP_DONG_SAP_HET_HAN).toBeNull();
    expect(nguonLoi).toEqual(['HOP_DONG_SAP_HET_HAN']);
  });

  test('đếm qua danh sách vượt trần: ghi vào vuotTran', async () => {
    jest.spyOn(nghiPhepService, 'layDanhSachDon').mockResolvedValue({
      items: [{ duocDuyet: true }, { duocDuyet: false }],
      phanTrang: { trang: 1, kichThuoc: 1000, tongSo: 1001 },
    });
    const { theoLoai, vuotTran } = (await goi(token.quanly)).body.data;
    expect(theoLoai.DON_NGHI_CHO_DUYET).toBe(1);
    expect(vuotTran).toEqual(['DON_NGHI_CHO_DUYET']);
  });

  test('COUNT điều chỉnh công / đề xuất khớp theoLoai sau khi chèn (bỏ của chính mình)', async () => {
    const truoc = (await goi(token.hr)).body.data.theoLoai;
    await taoDieuChinh(NV_NHANVIEN);
    await taoDieuChinh(NV_HR);
    await taoDeXuat('CHO_DUYET');
    await taoDeXuat('CHO_DUYET', null, NV_HR);
    const sau = (await goi(token.hr)).body.data.theoLoai;
    expect(sau.DIEU_CHINH_CONG_CHO_DUYET).toBe(truoc.DIEU_CHINH_CONG_CHO_DUYET + 1);
    expect(sau.DE_XUAT_CHO_XU_LY).toBe(truoc.DE_XUAT_CHO_XU_LY + 1);
  });
});

describe('KPI trong chuông', () => {
  let kyId;
  let anhPhieu;
  beforeEach(async () => {
    anhPhieu = (await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM phieudanhgiakpi'))[0][0].m;
    const [kq] = await pool.execute(
      "INSERT INTO kydanhgiakpi (tenKyDanhGia, ngayBatDau, ngayKetThuc, trangThai) VALUES ('QA chuông 2031', '2031-01-01', '2031-03-31', 'DANG_MO')",
    );
    kyId = kq.insertId;
  });
  afterEach(async () => {
    await pool.execute('DELETE FROM phieudanhgiakpi WHERE id > ?', [anhPhieu]);
    await pool.execute('DELETE FROM kydanhgiakpi WHERE id = ?', [kyId]);
    await pool.query('ALTER TABLE phieudanhgiakpi AUTO_INCREMENT = 1');
    await pool.query('ALTER TABLE kydanhgiakpi AUTO_INCREMENT = 1');
  });

  test('BAN_NHAP trong kỳ mở: chủ phiếu cần tự chấm; CHO_DUYET: quanLy phòng đó cần nghiệm thu', async () => {
    const truocTuCham = await soLuong(token.nhanvien, 'KPI_CAN_TU_CHAM');
    const truocNt = await soLuong(token.quanly, 'KPI_CAN_NGHIEM_THU');
    const truocNt2 = await soLuong(token.quanly2, 'KPI_CAN_NGHIEM_THU');
    await pool.execute("INSERT INTO phieudanhgiakpi (kyDanhGiaId, nhanVienId, trangThai) VALUES (?, ?, 'BAN_NHAP')", [kyId, NV_NHANVIEN]);
    await pool.execute("INSERT INTO phieudanhgiakpi (kyDanhGiaId, nhanVienId, trangThai) VALUES (?, ?, 'CHO_DUYET')", [kyId, NV_NHANVIEN3]);
    expect(await soLuong(token.nhanvien, 'KPI_CAN_TU_CHAM')).toBe(truocTuCham + 1);
    expect(await soLuong(token.quanly2, 'KPI_CAN_NGHIEM_THU')).toBe(truocNt2 + 1);
    expect(await soLuong(token.quanly, 'KPI_CAN_NGHIEM_THU')).toBe(truocNt);
  });
});
