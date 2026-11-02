import { useCallback, useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import goiApi from '../../services/goiApi';
import NutBam from '../../components/NutBam';
import HopThoai from '../../components/HopThoai';
import { DauHoSo, LuoiThongTinHoSo } from '../../components/TheHoSo';

const TRUONG_LIEN_HE = [
  { ten: 'soDienThoai', nhan: 'Số điện thoại', goiY: '0905xxxxxx' },
  { ten: 'diaChi', nhan: 'Địa chỉ' },
  { ten: 'soTaiKhoanNganHang', nhan: 'Số tài khoản ngân hàng' },
  { ten: 'tenNganHang', nhan: 'Tên ngân hàng' },
];

// Mọi người tự xem hồ sơ và sửa thông tin liên hệ / ngân hàng của mình
function TrangHoSoCuaToi() {
  const [hoSo, setHoSo] = useState(null);
  const [loi, setLoi] = useState('');
  const [form, setForm] = useState(null);
  const [loiForm, setLoiForm] = useState('');
  const [dangGui, setDangGui] = useState(false);

  const taiHoSo = useCallback(() => {
    goiApi.get('/nhanVien/toi').then((kq) => setHoSo(kq.data)).catch((e) => setLoi(e.message));
  }, []);
  useEffect(taiHoSo, [taiHoSo]);

  const moSua = () => {
    setLoiForm('');
    setForm(Object.fromEntries(TRUONG_LIEN_HE.map(({ ten }) => [ten, hoSo[ten] ?? ''])));
  };

  const luu = async (e) => {
    e.preventDefault();
    setDangGui(true);
    setLoiForm('');
    try {
      const kq = await goiApi.patch('/nhanVien/toi', form);
      setHoSo(kq.data);
      setForm(null);
    } catch (loiApi) {
      setLoiForm(loiApi.message);
    } finally {
      setDangGui(false);
    }
  };

  if (loi) return <div className="thongBao loi">{loi}</div>;
  if (!hoSo) return <div className="chuPhu">Đang tải hồ sơ...</div>;

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <DauHoSo hoSo={hoSo} />
        <NutBam bienThe="phu" bieuTuong={Pencil} onClick={moSua}>Sửa thông tin liên hệ</NutBam>
      </div>
      <div className="the theNoiDung">
        <div className="dauThe"><h3>Thông tin cá nhân</h3></div>
        <LuoiThongTinHoSo hoSo={hoSo} />
      </div>

      {form && (
        <HopThoai
          tieuDe="Sửa thông tin liên hệ"
          onDong={() => setForm(null)}
          chanTrang={(
            <>
              <NutBam bienThe="phu" onClick={() => setForm(null)}>Hủy</NutBam>
              <NutBam type="submit" form="formLienHe" disabled={dangGui}>{dangGui ? 'Đang lưu...' : 'Lưu'}</NutBam>
            </>
          )}
        >
          {loiForm && <div className="thongBao loi">{loiForm}</div>}
          <form id="formLienHe" className="bieuMau" onSubmit={luu}>
            {TRUONG_LIEN_HE.map(({ ten, nhan, goiY }) => (
              <label key={ten} className="truongForm">
                {nhan}
                <input value={form[ten]} placeholder={goiY} onChange={(e) => setForm({ ...form, [ten]: e.target.value })} />
              </label>
            ))}
          </form>
          <p className="chuPhu">Để trống một ô để xóa thông tin đó. Họ tên, ngày sinh, vị trí do HR cập nhật.</p>
        </HopThoai>
      )}
    </div>
  );
}

export default TrangHoSoCuaToi;
