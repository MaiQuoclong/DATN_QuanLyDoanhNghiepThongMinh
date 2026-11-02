import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useXacThuc } from '../context/NguCanhXacThuc';
import NutBam from '../components/NutBam';
import './TrangXacThuc.css';

// Dùng cho cả đổi mật khẩu thường và bắt buộc đổi mật khẩu tạm (không có layout chính khi bắt buộc)
function TrangDoiMatKhau() {
  const { nguoiDung, doiMatKhau, dangXuat } = useXacThuc();
  const dieuHuong = useNavigate();
  const [form, setForm] = useState({ matKhauCu: '', matKhauMoi: '', xacNhan: '' });
  const [loi, setLoi] = useState('');
  const [dangGui, setDangGui] = useState(false);
  const batBuoc = nguoiDung.batBuocDoiMatKhau;

  const capNhat = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const guiForm = async (e) => {
    e.preventDefault();
    if (form.matKhauMoi !== form.xacNhan) {
      setLoi('Mật khẩu xác nhận không khớp');
      return;
    }
    setLoi('');
    setDangGui(true);
    try {
      await doiMatKhau(form.matKhauCu, form.matKhauMoi);
      dieuHuong('/', { replace: true });
    } catch (loiApi) {
      setLoi(loiApi.message);
    } finally {
      setDangGui(false);
    }
  };

  return (
    <div className="trangXacThuc">
      <form className="theXacThuc the" onSubmit={guiForm}>
        <div className="dauTheXacThuc">
          <span className="logo">S</span>
          <div>
            <h1>Đổi mật khẩu</h1>
            <p>{nguoiDung.hoVaTen ?? nguoiDung.tenDangNhap}</p>
          </div>
        </div>

        {batBuoc && (
          <div className="hopCanhBao">
            Bạn đang dùng mật khẩu tạm do HR/Admin cấp. Vui lòng đặt mật khẩu mới để tiếp tục (mật khẩu tạm hết hạn sau 24 giờ).
          </div>
        )}
        {loi && <div className="hopLoi">{loi}</div>}

        <label className="truongNhap">
          <span>{batBuoc ? 'Mật khẩu tạm' : 'Mật khẩu hiện tại'}</span>
          <input name="matKhauCu" type="password" value={form.matKhauCu} onChange={capNhat} autoComplete="current-password" required />
        </label>
        <label className="truongNhap">
          <span>Mật khẩu mới</span>
          <input name="matKhauMoi" type="password" value={form.matKhauMoi} onChange={capNhat} autoComplete="new-password" minLength={8} required />
          <small>Tối thiểu 8 ký tự, gồm cả chữ và số.</small>
        </label>
        <label className="truongNhap">
          <span>Nhập lại mật khẩu mới</span>
          <input name="xacNhan" type="password" value={form.xacNhan} onChange={capNhat} autoComplete="new-password" required />
        </label>

        <div className="hangNut">
          {batBuoc ? (
            <NutBam type="button" bienThe="ma" onClick={dangXuat}>Đăng xuất</NutBam>
          ) : (
            <NutBam type="button" bienThe="phu" onClick={() => dieuHuong(-1)}>Hủy</NutBam>
          )}
          <NutBam type="submit" bieuTuong={KeyRound} disabled={dangGui}>
            {dangGui ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </NutBam>
        </div>
      </form>
    </div>
  );
}

export default TrangDoiMatKhau;
