import { useEffect, useState } from 'react';
import goiApi from '../services/goiApi';
import { useXacThuc } from '../context/NguCanhXacThuc';
import { NHAN_VAI_TRO } from '../config/danhSachMenu';
import TheThongKe from '../components/TheThongKe';
import ChipTrangThai from '../components/ChipTrangThai';
import './TrangTongQuan.css';

function TrangTongQuan() {
  const { nguoiDung } = useXacThuc();
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
      <div className="dauTrang">
        <div>
          <h1 className="tieuDeTrang">Xin chào, {nguoiDung.hoVaTen ?? nguoiDung.tenDangNhap}</h1>
          <div className="dongVaiTro">
            {nguoiDung.vaiTro.map((vt) => (
              <ChipTrangThai key={vt} trangThai="DANG_HOAT_DONG" nhan={NHAN_VAI_TRO[vt] ?? vt} />
            ))}
          </div>
        </div>
      </div>

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
          tieuDe="Đăng nhập lần trước"
          giaTri={nguoiDung.lanDangNhapCuoi ? new Date(nguoiDung.lanDangNhapCuoi.replace(' ', 'T')).toLocaleString('vi-VN') : '—'}
          moTa={nguoiDung.maNhanVien ? `Mã nhân viên ${nguoiDung.maNhanVien}` : nguoiDung.email}
        />
      </div>
    </div>
  );
}

export default TrangTongQuan;
