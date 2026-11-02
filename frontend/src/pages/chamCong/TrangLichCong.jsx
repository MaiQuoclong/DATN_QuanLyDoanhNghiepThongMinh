import { useCallback, useEffect, useState } from 'react';
import { LogIn, LogOut, FilePen } from 'lucide-react';
import goiApi from '../../services/goiApi';
import NutBam from '../../components/NutBam';
import TheThongKe from '../../components/TheThongKe';
import BangCongNgay from '../../components/chamCong/BangCongNgay';
import { ChuThichThoiGian } from '../../components/chamCong/ThanhThoiGianCong';
import HopThoaiDieuChinhCong from '../../components/chamCong/HopThoaiDieuChinhCong';
import { dinhDangGio, dinhDangNgay, dinhDangThoiGian, layThu, thangHienTai } from '../../utils/dinhDang';

// Thẻ chấm công hôm nay: giờ do máy chủ ghi nhận, trình duyệt chỉ gửi lệnh
function TheChamCongHomNay({ homNay, onDaChamCong }) {
  const [dangGui, setDangGui] = useState(false);
  const [thongBao, setThongBao] = useState(null);
  const banGhi = homNay?.banGhi;

  const cham = async (loai) => {
    setDangGui(true);
    setThongBao(null);
    try {
      const kq = await goiApi.post(`/chamCong/${loai}`);
      setThongBao({ loai: 'thanhCong', noiDung: kq.message });
      onDaChamCong();
    } catch (loi) {
      setThongBao({ loai: 'loi', noiDung: loi.message });
    } finally {
      setDangGui(false);
    }
  };

  if (!homNay) return null;
  return (
    <div className="the theNoiDung">
      <div className="dauThe">
        <h3>Hôm nay · {layThu(homNay.ngay)}, {dinhDangNgay(homNay.ngay)}</h3>
        <span className="chuPhu">
          Ca {dinhDangGio(homNay.thamSo.gioVaoCa)} - {dinhDangGio(homNay.thamSo.gioRaCa)}, nghỉ trưa {dinhDangGio(homNay.thamSo.batDauNghiTrua)} - {dinhDangGio(homNay.thamSo.ketThucNghiTrua)}
        </span>
      </div>
      {thongBao && <div className={`thongBao ${thongBao.loai}`}>{thongBao.noiDung}</div>}
      <div className="dauTrangNghiepVu" style={{ marginBottom: 0, alignItems: 'center' }}>
        <div className="luoiThongTin" style={{ flex: 1 }}>
          <div className="oThongTin"><span>Giờ vào</span><strong>{dinhDangGio(banGhi?.gioVao)}</strong></div>
          <div className="oThongTin"><span>Giờ ra</span><strong>{dinhDangGio(banGhi?.gioRa)}</strong></div>
          <div className="oThongTin"><span>Giờ công</span><strong>{banGhi?.gioRa ? banGhi.soGioLamThucTe : '—'}</strong></div>
          <div className="oThongTin"><span>Tăng ca</span><strong>{banGhi?.gioRa ? banGhi.soGioLamThemOT : '—'}</strong></div>
        </div>
        <div className="hangNutPhai">
          {!banGhi && <NutBam bieuTuong={LogIn} disabled={dangGui} onClick={() => cham('checkIn')}>Check-in</NutBam>}
          {banGhi && !banGhi.gioRa && <NutBam bieuTuong={LogOut} bienThe="vang" disabled={dangGui} onClick={() => cham('checkOut')}>Check-out</NutBam>}
          {banGhi?.gioRa && <span className="chuPhu">Đã hoàn thành chấm công hôm nay</span>}
        </div>
      </div>
    </div>
  );
}

// Lịch công của tôi (mọi vai trò có hồ sơ nhân viên)
function TrangLichCong() {
  const [thang, setThang] = useState(thangHienTai());
  const [homNay, setHomNay] = useState(null);
  const [cong, setCong] = useState(null);
  const [loi, setLoi] = useState('');
  const [ngayDieuChinh, setNgayDieuChinh] = useState(null);
  const [daGui, setDaGui] = useState('');

  const tai = useCallback(() => {
    goiApi.get('/chamCong/homNay').then((kq) => setHomNay(kq.data)).catch((e) => setLoi(e.message));
    goiApi.get('/chamCong/cuaToi', { params: { thang } })
      .then((kq) => { setCong(kq.data); setLoi(''); })
      .catch((e) => setLoi(e.message));
  }, [thang]);

  useEffect(() => { tai(); }, [tai]);

  const tongHop = cong?.tongHop;
  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Lịch công của tôi</h1>
          <div className="chuPhu">Sai giờ hoặc quên chấm công? Bấm ··· ở ngày đó để gửi yêu cầu điều chỉnh</div>
        </div>
        <div className="hangNutPhai">
          <label className="truongForm">
            Tháng
            <input type="month" value={thang} max={thangHienTai()} onChange={(e) => e.target.value && setThang(e.target.value)} />
          </label>
          <NutBam bieuTuong={FilePen} bienThe="phu" disabled={cong?.daChot} onClick={() => setNgayDieuChinh('')}>Gửi điều chỉnh</NutBam>
        </div>
      </div>

      {loi && <div className="thongBao loi">{loi}</div>}
      {daGui && <div className="thongBao thanhCong">{daGui}</div>}
      {thang === thangHienTai() && <TheChamCongHomNay homNay={homNay} onDaChamCong={tai} />}
      {cong?.daChot && (
        <div className="thongBao canhBao">
          Công tháng đã chốt lúc {dinhDangThoiGian(cong.chot.thoiGianChot)}, không thể gửi điều chỉnh.
        </div>
      )}

      {tongHop && (
        <div className="luoiThe" style={{ marginBottom: 16 }}>
          <TheThongKe tieuDe="Ngày có chấm công" giaTri={`${tongHop.soNgayChamCong}/${cong.soNgayCongChuan}`} moTa="So với ngày công chuẩn (T2 - T6)" />
          <TheThongKe tieuDe="Tổng giờ công" giaTri={tongHop.tongGioLamThucTe} moTa={`Tăng ca ${tongHop.tongGioLamThem} giờ`} trangThai="thanhCong" />
          <TheThongKe
            tieuDe="Đi muộn / Về sớm"
            giaTri={`${tongHop.soLanDiMuon} / ${tongHop.soLanVeSom}`}
            moTa={tongHop.soLanDiMuon + tongHop.soLanVeSom ? 'Cần chú ý giờ giấc' : 'Đúng giờ'}
            trangThai={tongHop.soLanDiMuon + tongHop.soLanVeSom ? 'canhBao' : 'thanhCong'}
          />
          <TheThongKe
            tieuDe="Thiếu check-out"
            giaTri={tongHop.soNgayThieuCheckOut}
            moTa={tongHop.soNgayThieuCheckOut ? 'Gửi điều chỉnh để được tính công' : 'Không có'}
            trangThai={tongHop.soNgayThieuCheckOut ? 'loi' : 'thanhCong'}
          />
        </div>
      )}

      <div style={{ marginBottom: 8 }}><ChuThichThoiGian /></div>
      <BangCongNgay
        items={cong?.items ?? []}
        ca={homNay?.thamSo}
        onHanhDong={cong?.daChot ? undefined : (d) => setNgayDieuChinh(d.ngayChamCong)}
      />

      {ngayDieuChinh !== null && (
        <HopThoaiDieuChinhCong
          ngay={ngayDieuChinh}
          onDong={() => setNgayDieuChinh(null)}
          onDaGui={(yc) => { setNgayDieuChinh(null); setDaGui(`Đã gửi yêu cầu điều chỉnh ngày ${dinhDangNgay(yc.ngayCanDieuChinh)}, chờ duyệt`); }}
        />
      )}
    </div>
  );
}

export default TrangLichCong;
