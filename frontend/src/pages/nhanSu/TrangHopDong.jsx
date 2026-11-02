import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import goiApi from '../../services/goiApi';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import BangDuLieu from '../../components/BangDuLieu';
import ThanhLoc from '../../components/ThanhLoc';
import PhanTrang from '../../components/PhanTrang';
import NutBam from '../../components/NutBam';
import TheThongKe from '../../components/TheThongKe';
import { COT_HOP_DONG, HopThoaiChiTietHopDong, HopThoaiLapHopDong } from '../../components/hopDong/HopThoaiHopDong';
import { dinhDangNgay, locThamSo, NHAN_LOAI_HOP_DONG, thanhLuaChon } from '../../utils/dinhDang';

const BO_LOC = [
  { khoa: 'loaiHopDong', nhan: 'Loại hợp đồng', luaChon: thanhLuaChon(NHAN_LOAI_HOP_DONG) },
  {
    khoa: 'trangThai',
    nhan: 'Trạng thái',
    luaChon: [
      { giaTri: 'HIEU_LUC', nhan: 'Hiệu lực' },
      { giaTri: 'HET_HAN', nhan: 'Hết hạn' },
      { giaTri: 'DA_CHAM_DUT', nhan: 'Đã chấm dứt' },
    ],
  },
];
const SO_NGAY_CANH_BAO = 30;

const COT_CO_NHAN_VIEN = [
  { khoa: 'hoVaTen', tieuDe: 'Nhân viên', hienThi: (d) => <>{d.hoVaTen} <span className="chuPhu">{d.maNhanVien}</span></> },
  ...COT_HOP_DONG,
];

// Bảng hợp đồng toàn công ty + cảnh báo sắp hết hạn (HR, giamDoc)
function HopDongToanCongTy({ laHR }) {
  const [tuKhoa, setTuKhoa] = useState('');
  const [loc, setLoc] = useState({});
  const [trang, setTrang] = useState(1);
  const [ketQua, setKetQua] = useState(null);
  const [sapHetHan, setSapHetHan] = useState([]);
  const [loi, setLoi] = useState('');
  const [dangXem, setDangXem] = useState(null);
  const [dangLap, setDangLap] = useState(false);

  const tai = useCallback(() => {
    goiApi
      .get('/hopDong', { params: locThamSo({ tuKhoa, ...loc, trang, kichThuoc: 20 }) })
      .then((kq) => { setKetQua(kq.data); setLoi(''); })
      .catch((e) => setLoi(e.message));
    goiApi
      .get('/hopDong/sapHetHan', { params: { soNgay: SO_NGAY_CANH_BAO } })
      .then((kq) => setSapHetHan(kq.data.items))
      .catch(() => setSapHetHan([]));
  }, [tuKhoa, loc, trang]);

  // Chờ người dùng gõ xong mới gọi API
  useEffect(() => {
    const hen = setTimeout(tai, 300);
    return () => clearTimeout(hen);
  }, [tai]);

  const quaHan = sapHetHan.filter((hd) => hd.soNgayConLai < 0).length;

  return (
    <>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Hợp đồng lao động</h1>
          <div className="chuPhu">Tổng {ketQua?.phanTrang.tongSo ?? 0} hợp đồng</div>
        </div>
        {laHR && <NutBam bieuTuong={Plus} onClick={() => setDangLap(true)}>Lập hợp đồng</NutBam>}
      </div>

      <div className="luoiThe" style={{ marginBottom: 16 }}>
        <TheThongKe
          tieuDe={`Sắp hết hạn trong ${SO_NGAY_CANH_BAO} ngày`}
          giaTri={sapHetHan.length - quaHan}
          moTa={sapHetHan.length ? 'Cần gia hạn hoặc ký hợp đồng mới' : 'Không có hợp đồng cần xử lý'}
          trangThai={sapHetHan.length ? 'canhBao' : 'thanhCong'}
        />
        <TheThongKe
          tieuDe="Đã quá hạn, chưa xử lý"
          giaTri={quaHan}
          moTa={quaHan ? 'Nhân viên đang làm việc không có hợp đồng hiệu lực' : 'Không có'}
          trangThai={quaHan ? 'loi' : 'thanhCong'}
        />
      </div>

      {sapHetHan.length > 0 && (
        <div className="the theNoiDung">
          <div className="dauThe"><h3>Cảnh báo hợp đồng</h3></div>
          {sapHetHan.map((hd) => (
            <div key={hd.id} className="thongBao canhBao" style={{ marginBottom: 6 }}>
              <button type="button" className="lienKet" onClick={() => setDangXem(hd.id)}>{hd.maHopDong}</button>
              {' '}— {hd.hoVaTen} ({hd.maNhanVien}), kết thúc {dinhDangNgay(hd.ngayKetThuc)}
              {hd.soNgayConLai < 0 ? ` · đã quá hạn ${-hd.soNgayConLai} ngày` : ` · còn ${hd.soNgayConLai} ngày`}
            </div>
          ))}
        </div>
      )}

      <ThanhLoc
        tuKhoa={tuKhoa}
        onDoiTuKhoa={(v) => { setTuKhoa(v); setTrang(1); }}
        goiYTim="Mã hợp đồng, mã hoặc tên nhân viên..."
        boLoc={BO_LOC}
        giaTriLoc={loc}
        onDoiLoc={(khoa, v) => { setLoc((cu) => ({ ...cu, [khoa]: v })); setTrang(1); }}
        phanPhai={<span />}
      />
      {loi && <div className="thongBao loi">{loi}</div>}
      <BangDuLieu cot={COT_CO_NHAN_VIEN} duLieu={ketQua?.items ?? []} onHanhDong={(d) => setDangXem(d.id)} thongBaoRong="Không có hợp đồng phù hợp" />
      <PhanTrang phanTrang={ketQua?.phanTrang} onDoiTrang={setTrang} />

      {dangXem && <HopThoaiChiTietHopDong hopDongId={dangXem} onDong={() => setDangXem(null)} onThayDoi={tai} />}
      {dangLap && (
        <HopThoaiLapHopDong
          onDong={() => setDangLap(false)}
          onDaTao={(hd) => { setDangLap(false); tai(); setDangXem(hd.id); }}
        />
      )}
    </>
  );
}

// Hợp đồng của chính mình (mọi vai trò có hồ sơ)
function HopDongCuaToi() {
  const [danhSach, setDanhSach] = useState(null);
  const [loi, setLoi] = useState('');
  const [dangXem, setDangXem] = useState(null);

  useEffect(() => {
    goiApi.get('/hopDong/cuaToi').then((kq) => setDanhSach(kq.data)).catch((e) => setLoi(e.message));
  }, []);

  return (
    <>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Hợp đồng của tôi</h1>
          <div className="chuPhu">Bấm ··· để xem chi tiết và lịch sử thay đổi</div>
        </div>
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}
      <BangDuLieu cot={COT_HOP_DONG} duLieu={danhSach ?? []} onHanhDong={(d) => setDangXem(d.id)} thongBaoRong="Bạn chưa có hợp đồng nào" />
      {dangXem && <HopThoaiChiTietHopDong hopDongId={dangXem} onDong={() => setDangXem(null)} />}
    </>
  );
}

function TrangHopDong() {
  const { nguoiDung } = useXacThuc();
  const xemToanCongTy = nguoiDung.vaiTro.some((vt) => ['HR', 'giamDoc'].includes(vt));
  const [tab, setTab] = useState(xemToanCongTy ? 'congTy' : 'cuaToi');

  return (
    <div>
      {xemToanCongTy && (
        <div className="tabGachChan">
          <button type="button" className={tab === 'congTy' ? 'dangChon' : ''} onClick={() => setTab('congTy')}>Toàn công ty</button>
          <button type="button" className={tab === 'cuaToi' ? 'dangChon' : ''} onClick={() => setTab('cuaToi')}>Của tôi</button>
        </div>
      )}
      {tab === 'congTy' ? <HopDongToanCongTy laHR={nguoiDung.vaiTro.includes('HR')} /> : <HopDongCuaToi />}
    </div>
  );
}

export default TrangHopDong;
