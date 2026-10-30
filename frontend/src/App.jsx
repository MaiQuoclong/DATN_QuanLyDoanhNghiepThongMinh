import { Routes, Route, Navigate } from 'react-router-dom';
import BoCucChinh from './layouts/BoCucChinh';
import TuyenBaoVe from './components/TuyenBaoVe';
import { useXacThuc } from './context/NguCanhXacThuc';
import danhSachMenu, { layTabDuocXem } from './config/danhSachMenu';
import TrangDangNhap from './pages/TrangDangNhap';
import TrangDoiMatKhau from './pages/TrangDoiMatKhau';
import TrangTongQuan from './pages/TrangTongQuan';
import TrangDangPhatTrien from './pages/TrangDangPhatTrien';

// Module chưa làm: sinh route tạm từ cấu hình menu (kèm tab con), giới hạn theo vai trò
const moduleTam = danhSachMenu.filter((m) => m.duongDan !== '/');

// Trang index của module: không có tab '' thì chuyển tới tab đầu tiên người dùng được xem
function TrangChiMucModule({ module }) {
  const { nguoiDung } = useXacThuc();
  if (!module.tab || module.tab.some((tab) => tab.duongDan === '')) {
    const tabChinh = module.tab?.find((tab) => tab.duongDan === '');
    return <TrangDangPhatTrien tenModule={tabChinh ? `${module.ten} - ${tabChinh.ten}` : module.ten} />;
  }
  const tabDau = layTabDuocXem(module, nguoiDung.vaiTro)[0];
  return tabDau ? <Navigate to={tabDau.duongDan} replace /> : <Navigate to="/" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/dangNhap" element={<TrangDangNhap />} />
      <Route path="/doiMatKhau" element={<TuyenBaoVe><TrangDoiMatKhau /></TuyenBaoVe>} />

      <Route element={<TuyenBaoVe />}>
        <Route element={<BoCucChinh />}>
          <Route index element={<TrangTongQuan />} />
          {moduleTam.map((m) => (
            <Route key={m.duongDan} path={m.duongDan.slice(1)} element={<TuyenBaoVe vaiTroChoPhep={m.vaiTro} />}>
              <Route index element={<TrangChiMucModule module={m} />} />
              {m.tab
                ?.filter((tab) => tab.duongDan)
                .map((tab) => (
                  <Route
                    key={tab.duongDan}
                    path={tab.duongDan}
                    element={
                      <TuyenBaoVe vaiTroChoPhep={tab.vaiTro ?? m.vaiTro}>
                        <TrangDangPhatTrien tenModule={`${m.ten} - ${tab.ten}`} />
                      </TuyenBaoVe>
                    }
                  />
                ))}
            </Route>
          ))}
          <Route path="*" element={<TrangDangPhatTrien tenModule="Không tìm thấy trang" />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
