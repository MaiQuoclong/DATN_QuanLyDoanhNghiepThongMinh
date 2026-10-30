import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useXacThuc } from '../context/NguCanhXacThuc';
import NutBam from '../components/NutBam';
import './TrangXacThuc.css';

function TrangDangNhap() {
  const { nguoiDung, dangTai, dangNhap } = useXacThuc();
  const dieuHuong = useNavigate();
  const { state } = useLocation();
  const [form, setForm] = useState({ tenDangNhap: '', matKhau: '' });
  const [loi, setLoi] = useState('');
  const [dangGui, setDangGui] = useState(false);

  // Chờ khôi phục phiên xong để không nháy form đăng nhập khi đã có token
  if (dangTai) return <div className="manHinhCho">Đang tải phiên đăng nhập...</div>;
  if (nguoiDung) return <Navigate to="/" replace />;

  const capNhat = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const guiForm = async (e) => {
    e.preventDefault();
    setLoi('');
    setDangGui(true);
    try {
      const thongTin = await dangNhap(form.tenDangNhap, form.matKhau);
      dieuHuong(thongTin.batBuocDoiMatKhau ? '/doiMatKhau' : state?.tu ?? '/', { replace: true });
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
            <h1>Đăng nhập</h1>
            <p>Smart HRM - Hệ thống quản lý doanh nghiệp thông minh</p>
          </div>
        </div>

        {loi && <div className="hopLoi">{loi}</div>}

        <label className="truongNhap">
          <span>Tên đăng nhập hoặc email</span>
          <input name="tenDangNhap" value={form.tenDangNhap} onChange={capNhat} autoComplete="username" autoFocus required />
        </label>
        <label className="truongNhap">
          <span>Mật khẩu</span>
          <input name="matKhau" type="password" value={form.matKhau} onChange={capNhat} autoComplete="current-password" required />
        </label>

        <NutBam type="submit" bieuTuong={LogIn} disabled={dangGui} className="nutRong">
          {dangGui ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </NutBam>
        <p className="ghiChuXacThuc">Quên mật khẩu? Liên hệ bộ phận Nhân sự hoặc Quản trị hệ thống.</p>
      </form>
    </div>
  );
}

export default TrangDangNhap;
