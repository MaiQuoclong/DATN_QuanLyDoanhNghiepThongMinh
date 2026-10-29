import { useEffect, useState } from 'react';
import goiApi from '../services/goiApi';
import TheThongKe from '../components/TheThongKe';
import './TrangTongQuan.css';

function TrangTongQuan() {
  const [sucKhoe, setSucKhoe] = useState(null);
  const [loi, setLoi] = useState(null);

  useEffect(() => {
    goiApi
      .get('/sucKhoe')
      .then((ketQua) => setSucKhoe(ketQua.data))
      .catch((loiApi) => setLoi(loiApi.message));
  }, []);

  const csdlKetNoi = sucKhoe?.csdl === 'KET_NOI';

  return (
    <div>
      <h1 className="tieuDeTrang">Tổng quan</h1>
      <p className="moTaTrang">Trạng thái hệ thống Smart HRM</p>

      <div className="luoiThe">
        <TheThongKe
          tieuDe="Máy chủ backend"
          giaTri={loi ? 'Mất kết nối' : sucKhoe ? 'Hoạt động' : 'Đang kiểm tra...'}
          moTa={loi ?? 'Express - cổng 5000'}
          trangThai={loi ? 'loi' : sucKhoe ? 'thanhCong' : undefined}
        />
        <TheThongKe
          tieuDe="Cơ sở dữ liệu"
          giaTri={!sucKhoe ? '—' : csdlKetNoi ? 'Đã kết nối' : 'Mất kết nối'}
          moTa="MariaDB - quanlydoanhnghiepthongminh"
          trangThai={!sucKhoe ? undefined : csdlKetNoi ? 'thanhCong' : 'loi'}
        />
        <TheThongKe
          tieuDe="Lần kiểm tra"
          giaTri={sucKhoe ? new Date(sucKhoe.thoiGian).toLocaleTimeString('vi-VN') : '—'}
          moTa="Theo giờ máy chủ"
        />
      </div>
    </div>
  );
}

export default TrangTongQuan;
