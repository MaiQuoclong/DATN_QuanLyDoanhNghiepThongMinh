import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useXacThuc } from '../context/NguCanhXacThuc';
import { coQuyen } from '../config/danhSachMenu';

// Bảo vệ route: chưa đăng nhập -> /dangNhap; đang dùng mật khẩu tạm -> /doiMatKhau; sai vai trò -> trang chủ.
// Đây chỉ là lớp giao diện, quyền thật do backend (phanQuyen) quyết định.
function TuyenBaoVe({ vaiTroChoPhep, children }) {
  const { nguoiDung, dangTai } = useXacThuc();
  const viTri = useLocation();

  if (dangTai) return <div className="manHinhCho">Đang tải phiên đăng nhập...</div>;
  if (!nguoiDung) return <Navigate to="/dangNhap" replace state={{ tu: viTri.pathname }} />;
  if (nguoiDung.batBuocDoiMatKhau && viTri.pathname !== '/doiMatKhau') {
    return <Navigate to="/doiMatKhau" replace />;
  }
  if (vaiTroChoPhep && !coQuyen(nguoiDung.vaiTro, vaiTroChoPhep)) return <Navigate to="/" replace />;

  return children ?? <Outlet />;
}

export default TuyenBaoVe;
