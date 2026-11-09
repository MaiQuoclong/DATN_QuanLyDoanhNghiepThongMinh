import { Routes, Route, Navigate } from 'react-router-dom';
import BoCucChinh from './layouts/BoCucChinh';
import TuyenBaoVe from './components/TuyenBaoVe';
import { useXacThuc } from './context/NguCanhXacThuc';
import danhSachMenu, { layTabDuocXem } from './config/danhSachMenu';
import TrangDangNhap from './pages/TrangDangNhap';
import TrangDoiMatKhau from './pages/TrangDoiMatKhau';
import TrangTongQuan from './pages/TrangTongQuan';
import TrangDangPhatTrien from './pages/TrangDangPhatTrien';
import TrangHoSoCuaToi from './pages/nhanSu/TrangHoSoCuaToi';
import TrangDanhSachNhanVien from './pages/nhanSu/TrangDanhSachNhanVien';
import TrangChiTietNhanVien from './pages/nhanSu/TrangChiTietNhanVien';
import TrangHopDong from './pages/nhanSu/TrangHopDong';
import TrangPhongBan from './pages/nhanSu/TrangPhongBan';
import TrangTaiKhoan from './pages/heThong/TrangTaiKhoan';
import TrangNhatKy from './pages/heThong/TrangNhatKy';
import TrangLichCong from './pages/chamCong/TrangLichCong';
import TrangDieuChinhCong from './pages/chamCong/TrangDieuChinhCong';
import TrangBangCong from './pages/chamCong/TrangBangCong';
import TrangDonCuaToi from './pages/nghiPhep/TrangDonCuaToi';
import TrangDuyetDon from './pages/nghiPhep/TrangDuyetDon';
import TrangLichNghi from './pages/nghiPhep/TrangLichNghi';
import TrangQuyPhep from './pages/nghiPhep/TrangQuyPhep';
import TrangPhieuLuong from './pages/luong/TrangPhieuLuong';
import TrangBangLuong from './pages/luong/TrangBangLuong';
import TrangPhieuKpiCuaToi from './pages/kpi/TrangPhieuKpiCuaToi';
import TrangDanhGiaKpi from './pages/kpi/TrangDanhGiaKpi';
import TrangChiTieuKpi from './pages/kpi/TrangChiTieuKpi';
import TrangKyDanhGia from './pages/kpi/TrangKyDanhGia';
import TrangBaoCaoKpi from './pages/kpi/TrangBaoCaoKpi';
import TrangQuyetDinh from './pages/khenThuongKyLuat/TrangQuyetDinh';
import TrangDeXuat from './pages/khenThuongKyLuat/TrangDeXuat';

// Sinh route từ cấu hình menu (kèm tab con), giới hạn theo vai trò.
// Tab đã làm lấy trang thật từ bảng dưới, tab chưa làm hiện TrangDangPhatTrien.
const moduleTam = danhSachMenu.filter((m) => m.duongDan !== '/');
const TRANG_DA_LAM = {
  '/nhanSu': TrangHoSoCuaToi,
  '/nhanSu/danhSach': TrangDanhSachNhanVien,
  '/nhanSu/hopDong': TrangHopDong,
  '/nhanSu/phongBan': TrangPhongBan,
  '/heThong/taiKhoan': TrangTaiKhoan,
  '/heThong/nhatKy': TrangNhatKy,
  '/chamCong': TrangLichCong,
  '/chamCong/dieuChinh': TrangDieuChinhCong,
  '/chamCong/bangCong': TrangBangCong,
  '/nghiPhep': TrangDonCuaToi,
  '/nghiPhep/duyetDon': TrangDuyetDon,
  '/nghiPhep/lichNghi': TrangLichNghi,
  '/nghiPhep/quyPhep': TrangQuyPhep,
  '/luong': TrangPhieuLuong,
  '/luong/bangLuong': TrangBangLuong,
  '/kpi': TrangPhieuKpiCuaToi,
  '/kpi/danhGia': TrangDanhGiaKpi,
  '/kpi/chiTieu': TrangChiTieuKpi,
  '/kpi/kyDanhGia': TrangKyDanhGia,
  '/kpi/baoCao': TrangBaoCaoKpi,
  '/khenThuongKyLuat': TrangQuyetDinh,
  '/khenThuongKyLuat/deXuat': TrangDeXuat,
};
// Trang con không có trên menu: [đường dẫn module, đường dẫn con, component, vai trò của tab cha]
const TRANG_CON = [['/nhanSu', 'danhSach/:id', TrangChiTietNhanVien, 'danhSach']];

function hienTrang(duongDan, tenModule) {
  const Trang = TRANG_DA_LAM[duongDan];
  return Trang ? <Trang /> : <TrangDangPhatTrien tenModule={tenModule} />;
}

// Trang index của module: không có tab '' thì chuyển tới tab đầu tiên người dùng được xem
function TrangChiMucModule({ module }) {
  const { nguoiDung } = useXacThuc();
  if (!module.tab || module.tab.some((tab) => tab.duongDan === '')) {
    const tabChinh = module.tab?.find((tab) => tab.duongDan === '');
    return hienTrang(module.duongDan, tabChinh ? `${module.ten} - ${tabChinh.ten}` : module.ten);
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
                        {hienTrang(`${m.duongDan}/${tab.duongDan}`, `${m.ten} - ${tab.ten}`)}
                      </TuyenBaoVe>
                    }
                  />
                ))}
              {TRANG_CON.filter(([cha]) => cha === m.duongDan).map(([, duongDan, Trang, tabCha]) => {
                const tab = m.tab?.find((t) => t.duongDan === tabCha);
                return (
                  <Route
                    key={duongDan}
                    path={duongDan}
                    element={<TuyenBaoVe vaiTroChoPhep={tab?.vaiTro ?? m.vaiTro}><Trang /></TuyenBaoVe>}
                  />
                );
              })}
            </Route>
          ))}
          <Route path="*" element={<TrangDangPhatTrien tenModule="Không tìm thấy trang" />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
