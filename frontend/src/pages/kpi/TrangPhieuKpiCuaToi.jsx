import { useCallback, useEffect, useState } from 'react';
import goiApi from '../../services/goiApi';
import BangDuLieu from '../../components/BangDuLieu';
import ChipTrangThai from '../../components/ChipTrangThai';
import HopThoaiPhieuKpi from '../../components/kpi/HopThoaiPhieuKpi';
import { dinhDangNgay } from '../../utils/dinhDang';

// Tab Phiếu của tôi (mọi vai trò): tự chấm phiếu nháp, gửi nghiệm thu, xem kết quả
function TrangPhieuKpiCuaToi() {
  const [dsPhieu, setDsPhieu] = useState([]);
  const [loi, setLoi] = useState('');
  const [dangXem, setDangXem] = useState(null);

  const tai = useCallback(() => {
    goiApi
      .get('/phieuDanhGiaKPI/cuaToi')
      .then((kq) => {
        setDsPhieu(kq.data);
        setLoi('');
      })
      .catch((e) => setLoi(e.message));
  }, []);
  useEffect(tai, [tai]);

  const cot = [
    { khoa: 'tenKyDanhGia', tieuDe: 'Kỳ đánh giá' },
    { khoa: 'ngayBatDau', tieuDe: 'Thời gian', hienThi: (d) => `${dinhDangNgay(d.ngayBatDau)} – ${dinhDangNgay(d.ngayKetThuc)}` },
    { khoa: 'soChiTieu', tieuDe: 'Số chỉ tiêu', canPhai: true },
    { khoa: 'diemTuChamTong', tieuDe: 'Tự chấm', canPhai: true, hienThi: (d) => d.diemTuChamTong ?? '—' },
    { khoa: 'diemTong', tieuDe: 'Nghiệm thu', canPhai: true, hienThi: (d) => (d.diemTong === null ? '—' : <strong>{d.diemTong}</strong>) },
    { khoa: 'xepLoaiChung', tieuDe: 'Xếp loại', hienThi: (d) => (d.xepLoaiChung ? <ChipTrangThai trangThai={d.xepLoaiChung} /> : '—') },
    {
      khoa: 'trangThai',
      tieuDe: 'Trạng thái',
      hienThi: (d) => (
        <ChipTrangThai
          trangThai={d.trangThai}
          nhan={d.trangThai === 'BAN_NHAP' && d.trangThaiKy === 'DANG_MO' ? 'Cần tự chấm' : undefined}
        />
      ),
    },
  ];

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Phiếu KPI của tôi</h1>
          <div className="chuPhu">Tự chấm điểm các chỉ tiêu rồi gửi nghiệm thu · bấm một dòng để mở phiếu</div>
        </div>
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}
      <BangDuLieu cot={cot} duLieu={dsPhieu} onHanhDong={(d) => setDangXem(d.id)} thongBaoRong="Bạn chưa có phiếu đánh giá KPI nào" />
      {dangXem && <HopThoaiPhieuKpi phieuId={dangXem} onDong={() => setDangXem(null)} onThayDoi={tai} />}
    </div>
  );
}

export default TrangPhieuKpiCuaToi;
