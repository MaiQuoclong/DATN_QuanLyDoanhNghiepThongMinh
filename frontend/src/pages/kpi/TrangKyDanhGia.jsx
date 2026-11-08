import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import goiApi from '../../services/goiApi';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import BangDuLieu from '../../components/BangDuLieu';
import ChipTrangThai from '../../components/ChipTrangThai';
import HopThoaiBieuMau from '../../components/HopThoaiBieuMau';
import NutBam from '../../components/NutBam';
import { dinhDangNgay } from '../../utils/dinhDang';

const TRUONG_KY = [
  { ten: 'tenKyDanhGia', nhan: 'Tên kỳ', batBuoc: true, rongHet: true, goiY: 'VD: KPI Quý 1/2027' },
  { ten: 'ngayBatDau', nhan: 'Ngày bắt đầu', kieu: 'date', batBuoc: true },
  { ten: 'ngayKetThuc', nhan: 'Ngày kết thúc', kieu: 'date', batBuoc: true },
];

// Tab Kỳ đánh giá: HR mở / sửa / đóng / mở lại / xóa kỳ chưa có phiếu; giamDoc, quanLy xem
function TrangKyDanhGia() {
  const { nguoiDung } = useXacThuc();
  const laHR = nguoiDung.vaiTro.includes('HR');
  const [ds, setDs] = useState([]);
  const [loi, setLoi] = useState('');
  const [thongBao, setThongBao] = useState('');
  const [dangThem, setDangThem] = useState(false);
  const [dangSua, setDangSua] = useState(null);

  const tai = useCallback(() => {
    goiApi.get('/kyDanhGiaKPI').then((kq) => { setDs(kq.data); setLoi(''); }).catch((e) => setLoi(e.message));
  }, []);
  useEffect(tai, [tai]);

  const hanhDong = async (duongDan, phuongThuc = 'post') => {
    try {
      const kq = await goiApi[phuongThuc](duongDan);
      setDangSua(null);
      setThongBao(kq.message);
      tai();
    } catch (e) {
      setDangSua(null);
      setLoi(e.message);
    }
  };

  const cot = [
    { khoa: 'tenKyDanhGia', tieuDe: 'Kỳ đánh giá' },
    { khoa: 'ngayBatDau', tieuDe: 'Bắt đầu', hienThi: (d) => dinhDangNgay(d.ngayBatDau) },
    { khoa: 'ngayKetThuc', tieuDe: 'Kết thúc', hienThi: (d) => dinhDangNgay(d.ngayKetThuc) },
    { khoa: 'soPhieu', tieuDe: 'Số phiếu', canPhai: true },
    { khoa: 'soPhieuChoDuyet', tieuDe: 'Chờ nghiệm thu', canPhai: true },
    { khoa: 'soPhieuDaDuyet', tieuDe: 'Đã nghiệm thu', canPhai: true },
    { khoa: 'trangThai', tieuDe: 'Trạng thái', hienThi: (d) => <ChipTrangThai trangThai={d.trangThai} /> },
  ];

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Kỳ đánh giá KPI</h1>
          <div className="chuPhu">Chỉ kỳ đang mở mới tạo phiếu, tự chấm, nghiệm thu được · đóng kỳ khi không còn phiếu chờ nghiệm thu</div>
        </div>
        {laHR && <NutBam bieuTuong={Plus} onClick={() => setDangThem(true)}>Mở kỳ mới</NutBam>}
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}
      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      <BangDuLieu cot={cot} duLieu={ds} onHanhDong={laHR ? (d) => { setLoi(''); setDangSua(d); } : undefined} thongBaoRong="Chưa có kỳ đánh giá" />

      {dangThem && (
        <HopThoaiBieuMau
          tieuDe="Mở kỳ đánh giá"
          truong={TRUONG_KY}
          nhanNutGui="Mở kỳ"
          onGui={async (g) => {
            const kq = await goiApi.post('/kyDanhGiaKPI', g);
            setDangThem(false);
            setThongBao(kq.message);
            tai();
          }}
          onDong={() => setDangThem(false)}
        />
      )}
      {dangSua && dangSua.trangThai === 'DANG_MO' && (
        <HopThoaiBieuMau
          tieuDe={`Sửa kỳ ${dangSua.tenKyDanhGia}`}
          moTa={(
            <>
              <button type="button" className="lienKet" onClick={() => hanhDong(`/kyDanhGiaKPI/${dangSua.id}/dong`)}>Đóng kỳ</button>
              {!dangSua.soPhieu && (
                <>
                  {' · '}
                  <button type="button" className="lienKet" onClick={() => window.confirm('Xóa kỳ đánh giá này?') && hanhDong(`/kyDanhGiaKPI/${dangSua.id}`, 'delete')}>
                    Xóa kỳ
                  </button>
                </>
              )}
            </>
          )}
          truong={TRUONG_KY}
          giaTriBanDau={{ tenKyDanhGia: dangSua.tenKyDanhGia, ngayBatDau: dangSua.ngayBatDau, ngayKetThuc: dangSua.ngayKetThuc }}
          onGui={async (g) => {
            const body = Object.fromEntries(Object.entries(g).filter(([k, v]) => v !== dangSua[k]));
            const kq = await goiApi.patch(`/kyDanhGiaKPI/${dangSua.id}`, body);
            setDangSua(null);
            setThongBao(kq.message);
            tai();
          }}
          onDong={() => setDangSua(null)}
        />
      )}
      {dangSua && dangSua.trangThai === 'DA_DONG' && (
        <HopThoaiBieuMau
          tieuDe={`Mở lại kỳ ${dangSua.tenKyDanhGia}`}
          moTa="Kỳ đã đóng. Mở lại để tiếp tục chấm hoặc sửa phiếu."
          truong={[]}
          nhanNutGui="Mở lại kỳ"
          onGui={() => hanhDong(`/kyDanhGiaKPI/${dangSua.id}/moLai`)}
          onDong={() => setDangSua(null)}
        />
      )}
    </div>
  );
}

export default TrangKyDanhGia;
