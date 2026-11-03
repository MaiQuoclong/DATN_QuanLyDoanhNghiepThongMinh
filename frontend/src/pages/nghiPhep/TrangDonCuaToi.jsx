import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import goiApi from '../../services/goiApi';
import NutBam from '../../components/NutBam';
import TheThongKe from '../../components/TheThongKe';
import DanhSachDon from '../../components/nghiPhep/DanhSachDon';
import HopThoaiTaoDon from '../../components/nghiPhep/HopThoaiTaoDon';

// Đơn của tôi: quỹ phép năm nay + danh sách đơn, tạo / hủy đơn
function TrangDonCuaToi() {
  const [quy, setQuy] = useState(null);
  const [loi, setLoi] = useState('');
  const [thongBao, setThongBao] = useState('');
  const [dangTao, setDangTao] = useState(false);
  const [lamMoi, setLamMoi] = useState(0);

  const taiQuy = useCallback(() => {
    goiApi.get('/quyPhep/cuaToi').then((kq) => { setQuy(kq.data); setLoi(''); }).catch((e) => setLoi(e.message));
  }, []);
  useEffect(taiQuy, [taiQuy]);

  const coQuy = quy?.quy;
  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Đơn nghỉ phép của tôi</h1>
          <div className="chuPhu">Đơn được gửi tới trưởng bộ phận theo chuỗi duyệt; nghỉ dài ngày chuyển Ban Giám đốc</div>
        </div>
        <NutBam bieuTuong={Plus} onClick={() => setDangTao(true)}>Tạo đơn</NutBam>
      </div>

      {loi && <div className="thongBao loi">{loi}</div>}
      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      <div className="luoiThe" style={{ marginBottom: 16 }}>
        <TheThongKe tieuDe={`Quỹ phép năm ${quy?.nam ?? ''}`} giaTri={coQuy ? quy.quy.tongSoNgayPhep : '—'} moTa={coQuy ? 'ngày' : 'Chưa được cấp, liên hệ phòng Nhân sự'} trangThai={coQuy ? undefined : 'canhBao'} />
        <TheThongKe tieuDe="Đã nghỉ" giaTri={coQuy ? quy.quy.soNgayDaNghi : '—'} moTa="ngày (đơn đã duyệt)" />
        <TheThongKe tieuDe="Đang chờ duyệt" giaTri={quy?.soNgayChoDuyet ?? '—'} moTa="ngày đã giữ chỗ trong quỹ" trangThai={quy?.soNgayChoDuyet ? 'canhBao' : undefined} />
        <TheThongKe
          tieuDe="Còn lại"
          giaTri={coQuy ? quy.soNgayConLai : '—'}
          moTa="ngày có thể xin thêm"
          trangThai={!coQuy ? undefined : quy.soNgayConLai <= 0 ? 'loi' : 'thanhCong'}
        />
      </div>

      <DanhSachDon cheDo="cuaToi" lamMoi={lamMoi} onDaXuLy={taiQuy} />

      {dangTao && (
        <HopThoaiTaoDon
          quy={quy}
          onDong={() => setDangTao(false)}
          onDaGui={(kq) => { setDangTao(false); setThongBao(kq.message); setLamMoi((n) => n + 1); taiQuy(); }}
        />
      )}
    </div>
  );
}

export default TrangDonCuaToi;
