import { Routes, Route } from 'react-router-dom';
import BoCucChinh from './layouts/BoCucChinh';
import TrangTongQuan from './pages/TrangTongQuan';
import TrangDangPhatTrien from './pages/TrangDangPhatTrien';

const moduleTam = [
  { duongDan: 'nhanSu', ten: 'Nhân sự' },
  { duongDan: 'chamCong', ten: 'Chấm công' },
  { duongDan: 'nghiPhep', ten: 'Nghỉ phép' },
  { duongDan: 'luong', ten: 'Lương' },
  { duongDan: 'kpi', ten: 'KPI' },
  { duongDan: 'troLyAi', ten: 'AI Chatbot' },
];

function App() {
  return (
    <Routes>
      <Route element={<BoCucChinh />}>
        <Route index element={<TrangTongQuan />} />
        {moduleTam.map((m) => (
          <Route key={m.duongDan} path={m.duongDan} element={<TrangDangPhatTrien tenModule={m.ten} />} />
        ))}
        <Route path="*" element={<TrangDangPhatTrien tenModule="Không tìm thấy trang" />} />
      </Route>
    </Routes>
  );
}

export default App;
