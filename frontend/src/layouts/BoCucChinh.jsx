import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Search, KeyRound, LogOut } from 'lucide-react';
import { useXacThuc } from '../context/NguCanhXacThuc';
import danhSachMenu, { coQuyen, layTabDuocXem, NHAN_VAI_TRO } from '../config/danhSachMenu';
import useBamNgoai from '../hooks/useBamNgoai';
import useViecCanChuY from '../hooks/useViecCanChuY';
import { NhaCungCapViecCanChuY } from '../context/NguCanhViecCanChuY';
import MenuTaoNhanh from '../components/thanhDieuHuong/MenuTaoNhanh';
import HopTimNhanh from '../components/thanhDieuHuong/HopTimNhanh';
import ChuongViecCanChuY from '../components/thanhDieuHuong/ChuongViecCanChuY';
import './BoCucChinh.css';

// Phím / mở Tìm nhanh chỉ khi không đang gõ trong ô nhập (để không chặn ký tự '/')
function dangNhapLieu(phanTu) {
  return Boolean(phanTu && (['INPUT', 'TEXTAREA', 'SELECT'].includes(phanTu.tagName) || phanTu.isContentEditable));
}

function layChuCaiDau(hoVaTen = '') {
  const tu = hoVaTen.trim().split(/\s+/);
  return ((tu[0]?.[0] ?? '') + (tu.length > 1 ? tu.at(-1)[0] : '')).toUpperCase() || '?';
}

// Layout: thanh trên cùng tối (logo, tên module, tab con, tiện ích) + thanh icon bên trái
function BoCucChinh() {
  const { nguoiDung, dangXuat } = useXacThuc();
  const { pathname } = useLocation();
  const dieuHuong = useNavigate();
  const vungMenu = useRef(null);
  // Mỗi lúc chỉ một popover ('tao' | 'tim' | 'chuong' | 'taiKhoan'); gắn với pathname nên đổi trang là tự đóng
  const [popover, setPopover] = useState({ ten: null, duongDan: pathname });
  const popoverDangMo = popover.duongDan === pathname ? popover.ten : null;
  const doiPopover = useMemo(() => {
    const tao = (ten) => (mo) => setPopover({ ten: mo ? ten : null, duongDan: pathname });
    return { tao: tao('tao'), tim: tao('tim'), chuong: tao('chuong'), taiKhoan: tao('taiKhoan') };
  }, [pathname]);
  const dongTim = useCallback(() => doiPopover.tim(false), [doiPopover]);
  const viec = useViecCanChuY(pathname);

  const menuDuocXem = danhSachMenu.filter((m) => coQuyen(nguoiDung.vaiTro, m.vaiTro));
  const moduleHienTai =
    menuDuocXem.find((m) => m.duongDan !== '/' && (pathname === m.duongDan || pathname.startsWith(`${m.duongDan}/`))) ?? menuDuocXem[0];
  const tabDuocXem = moduleHienTai ? layTabDuocXem(moduleHienTai, nguoiDung.vaiTro) : [];
  const tenHienThi = nguoiDung.hoVaTen ?? nguoiDung.tenDangNhap;

  const dongTaiKhoan = useCallback(() => doiPopover.taiKhoan(false), [doiPopover]);
  useBamNgoai(vungMenu, popoverDangMo === 'taiKhoan', dongTaiKhoan);

  // Phím tắt mở Tìm nhanh: Ctrl+K / Cmd+K (mọi lúc) hoặc '/' (khi không gõ trong ô nhập)
  useEffect(() => {
    const khiPhim = (e) => {
      const ctrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
      const gach = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !dangNhapLieu(document.activeElement);
      if (ctrlK || gach) {
        e.preventDefault();
        doiPopover.tim(true);
      }
    };
    document.addEventListener('keydown', khiPhim);
    return () => document.removeEventListener('keydown', khiPhim);
  }, [doiPopover]);

  const xuLyDangXuat = async () => {
    await dangXuat();
    dieuHuong('/dangNhap', { replace: true });
  };

  return (
    <div className="boCuc">
      <header className="thanhTren">
        <div className="thuongHieu">
          <span className="logo">S</span>
          <span className="tenHeThong">Quản Lý Doanh Nghiệp Thông Minh Tích Hợp AI Agent</span>
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
          <MenuTaoNhanh dangMo={popoverDangMo === 'tao'} onDoi={doiPopover.tao} />
          <button type="button" className="nutTienIch" title="Tìm nhanh chức năng (/ hoặc Ctrl+K)" onClick={() => doiPopover.tim(true)}>
            <Search size={18} />
          </button>
          <ChuongViecCanChuY dangMo={popoverDangMo === 'chuong'} onDoi={doiPopover.chuong} viec={viec} />
          <div className="vungTaiKhoan" ref={vungMenu}>
            <button
              type="button"
              className="anhDaiDien"
              title={tenHienThi}
              onClick={() => doiPopover.taiKhoan(popoverDangMo !== 'taiKhoan')}
            >
              {layChuCaiDau(tenHienThi)}
            </button>
            {popoverDangMo === 'taiKhoan' && (
              <div className="menuTaiKhoan the">
                <div className="thongTinTaiKhoan">
                  <strong>{tenHienThi}</strong>
                  <span>{nguoiDung.maNhanVien ?? nguoiDung.email}</span>
                  <span className="dsVaiTro">{nguoiDung.vaiTro.map((vt) => NHAN_VAI_TRO[vt] ?? vt).join(' · ')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    doiPopover.taiKhoan(false);
                    dieuHuong('/doiMatKhau');
                  }}
                >
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
        {menuDuocXem.map(({ duongDan, ten, tenNgan, bieuTuong: BieuTuong }) => (
          <NavLink
            key={duongDan}
            to={duongDan}
            end={duongDan === '/'}
            title={ten}
            className={({ isActive }) => (isActive ? 'mucIcon dangChon' : 'mucIcon')}
          >
            <BieuTuong size={21} />
            <span className="nhanMuc">{tenNgan ?? ten}</span>
            <span className="chuGoiY">{ten}</span>
          </NavLink>
        ))}
      </aside>

      {popoverDangMo === 'tim' && <HopTimNhanh onDong={dongTim} />}

      <main className="noiDung">
        <NhaCungCapViecCanChuY giaTri={viec}>
          <Outlet />
        </NhaCungCapViecCanChuY>
      </main>
    </div>
  );
}

export default BoCucChinh;
