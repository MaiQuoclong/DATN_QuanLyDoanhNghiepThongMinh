import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, Bell, KeyRound, LogOut } from 'lucide-react';
import { useXacThuc } from '../context/NguCanhXacThuc';
import danhSachMenu, { coQuyen, layTabDuocXem, NHAN_VAI_TRO } from '../config/danhSachMenu';
import './BoCucChinh.css';

function layChuCaiDau(hoVaTen = '') {
  const tu = hoVaTen.trim().split(/\s+/);
  return ((tu[0]?.[0] ?? '') + (tu.length > 1 ? tu.at(-1)[0] : '')).toUpperCase() || '?';
}

// Layout: thanh trên cùng tối (logo, tên module, tab con, tiện ích) + thanh icon bên trái
function BoCucChinh() {
  const { nguoiDung, dangXuat } = useXacThuc();
  const { pathname } = useLocation();
  const dieuHuong = useNavigate();
  const [moMenuTaiKhoan, setMoMenuTaiKhoan] = useState(false);
  const vungMenu = useRef(null);

  const menuDuocXem = danhSachMenu.filter((m) => coQuyen(nguoiDung.vaiTro, m.vaiTro));
  const moduleHienTai =
    menuDuocXem.find((m) => m.duongDan !== '/' && (pathname === m.duongDan || pathname.startsWith(`${m.duongDan}/`))) ?? menuDuocXem[0];
  const tabDuocXem = moduleHienTai ? layTabDuocXem(moduleHienTai, nguoiDung.vaiTro) : [];
  const tenHienThi = nguoiDung.hoVaTen ?? nguoiDung.tenDangNhap;

  useEffect(() => {
    const dongKhiBamNgoai = (e) => {
      if (vungMenu.current && !vungMenu.current.contains(e.target)) setMoMenuTaiKhoan(false);
    };
    document.addEventListener('mousedown', dongKhiBamNgoai);
    return () => document.removeEventListener('mousedown', dongKhiBamNgoai);
  }, []);

  const xuLyDangXuat = () => {
    dangXuat();
    dieuHuong('/dangNhap', { replace: true });
  };

  return (
    <div className="boCuc">
      <header className="thanhTren">
        <div className="thuongHieu">
          <span className="logo">S</span>
          <span className="tenHeThong">Smart HRM</span>
          <span className="vachNgan" />
          <span className="tenModule">{moduleHienTai?.ten}</span>
        </div>

        {tabDuocXem.length > 0 && (
          <nav className="tabModule">
            {tabDuocXem.map((tab) => (
              <NavLink
                key={tab.duongDan}
                to={tab.duongDan ? `${moduleHienTai.duongDan}/${tab.duongDan}` : moduleHienTai.duongDan}
                end
                className={({ isActive }) => (isActive ? 'tabPill dangChon' : 'tabPill')}
              >
                {tab.ten}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="tienIch">
          {/* Chưa có chức năng: tạm disabled, gắn onClick khi làm các module sau */}
          <button type="button" className="nutTienIch vang" title="Tạo mới (sắp có)" disabled>
            <Plus size={16} />
          </button>
          <button type="button" className="nutTienIch" title="Tìm kiếm (sắp có)" disabled>
            <Search size={16} />
          </button>
          <button type="button" className="nutTienIch" title="Thông báo (sắp có)" disabled>
            <Bell size={16} />
          </button>
          <div className="vungTaiKhoan" ref={vungMenu}>
            <button
              type="button"
              className="anhDaiDien"
              title={tenHienThi}
              onClick={() => setMoMenuTaiKhoan((mo) => !mo)}
            >
              {layChuCaiDau(tenHienThi)}
            </button>
            {moMenuTaiKhoan && (
              <div className="menuTaiKhoan the">
                <div className="thongTinTaiKhoan">
                  <strong>{tenHienThi}</strong>
                  <span>{nguoiDung.maNhanVien ?? nguoiDung.email}</span>
                  <span className="dsVaiTro">
                    {nguoiDung.vaiTro.map((vt) => NHAN_VAI_TRO[vt] ?? vt).join(' · ')}
                  </span>
                </div>
                <button type="button" onClick={() => { setMoMenuTaiKhoan(false); dieuHuong('/doiMatKhau'); }}>
                  <KeyRound size={15} /> Đổi mật khẩu
                </button>
                <button type="button" className="dangXuat" onClick={xuLyDangXuat}>
                  <LogOut size={15} /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <aside className="thanhIcon">
        {menuDuocXem.map(({ duongDan, ten, bieuTuong: BieuTuong }) => (
          <NavLink
            key={duongDan}
            to={duongDan}
            end={duongDan === '/'}
            title={ten}
            className={({ isActive }) => (isActive ? 'mucIcon dangChon' : 'mucIcon')}
          >
            <BieuTuong size={19} />
            <span className="chuGoiY">{ten}</span>
          </NavLink>
        ))}
      </aside>

      <main className="noiDung">
        <Outlet />
      </main>
    </div>
  );
}

export default BoCucChinh;
