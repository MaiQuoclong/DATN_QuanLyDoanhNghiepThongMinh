const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');

afterAll(() => pool.end());

describe('GET /api/v1/sucKhoe', () => {
  test('trả về JSON đúng chuẩn khi máy chủ hoạt động', async () => {
    const res = await request(app).get('/api/v1/sucKhoe');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200 });
    expect(res.body.data.mayChu).toBe('HOAT_DONG');
    expect(['KET_NOI', 'MAT_KET_NOI']).toContain(res.body.data.csdl);
  });
});

describe('Xử lý lỗi chung', () => {
  test('route không tồn tại trả về 404 chuẩn', async () => {
    const res = await request(app).get('/api/v1/khongTonTai');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, code: 404, message: expect.any(String), data: null });
  });

  test('JSON sai cú pháp trả về 400 chuẩn', async () => {
    const res = await request(app)
      .post('/api/v1/sucKhoe')
      .set('Content-Type', 'application/json')
      .send('{sai');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 400, data: null });
  });
});
