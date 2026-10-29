import { NavLink, Outlet } from 'react-router-dom';
import './BoCucChinh.css';

const danhSachMenu = [
  { duongDan: '/', ten: 'Tổng quan', bieuTuong: '▦' },
  { duongDan: '/nhanSu', ten: 'Nhân sự', bieuTuong: '👥' },
  { duongDan: '/chamCong', ten: 'Chấm công', bieuTuong: '⏱' },
  { duongDan: '/nghiPhep', ten: 'Nghỉ phép', bieuTuong: '📅' },
  { duongDan: '/luong', ten: 'Lương', bieuTuong: '₫' },
  { duongDan: '/kpi', ten: 'KPI', bieuTuong: '📈' },
  { duongDan: '/troLyAi', ten: 'AI Chatbot', bieuTuong: '🤖' },
];

// Layout 2 cột: sidebar cố định bên trái, nội dung trang bên phải
function BoCucChinh() {
  return (
    <div className="boCuc">
      <aside className="sidebar">
        <div className="sidebarLogo">Smart HRM</div>
        <nav>
          {danhSachMenu.map((muc) => (
            <NavLink
              key={muc.duongDan}
              to={muc.duongDan}
              end={muc.duongDan === '/'}
              className={({ isActive }) => (isActive ? 'mucMenu dangChon' : 'mucMenu')}
            >
              <span className="bieuTuong">{muc.bieuTuong}</span>
              {muc.ten}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="noiDung">
        <Outlet />
      </main>
    </div>
  );
}

export default BoCucChinh;
