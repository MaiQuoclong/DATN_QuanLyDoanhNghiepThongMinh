import { useEffect, useState } from 'react';
import goiApi from '../../services/goiApi';
import BangDuLieu from '../../components/BangDuLieu';
import HopThoai from '../../components/HopThoai';
import ChiTietPhieuLuong from '../../components/luong/ChiTietPhieuLuong';
import { dinhDangTien } from '../../utils/dinhDang';

const namHienTai = new Date().getFullYear();

// Tab Phiếu lương (mọi vai trò): phiếu của chính mình, chỉ hiện khi bảng lương đã được giám đốc duyệt
function TrangPhieuLuong() {
  const [nam, setNam] = useState(namHienTai);
  const [dsPhieu, setDsPhieu] = useState([]);
  const [loi, setLoi] = useState('');
  const [dangXem, setDangXem] = useState(null);

  useEffect(() => {
    goiApi.get('/phieuLuong/cuaToi', { params: { nam } })
      .then((kq) => { setDsPhieu(kq.data); setLoi(''); })
      .catch((e) => setLoi(e.message));
  }, [nam]);

  const cot = [
    { khoa: 'thang', tieuDe: 'Kỳ lương', hienThi: (d) => `Tháng ${String(d.thang).padStart(2, '0')}/${d.nam}` },
    { khoa: 'soNgayCongThucTe', tieuDe: 'Ngày công', canPhai: true, hienThi: (d) => `${d.soNgayCongThucTe}/${d.ngayCongChuan}` },
    { khoa: 'tongThuNhap', tieuDe: 'Tổng thu nhập', canPhai: true, hienThi: (d) => dinhDangTien(d.tongThuNhap) },
    { khoa: 'khauTruBaoHiem', tieuDe: 'Bảo hiểm', canPhai: true, hienThi: (d) => dinhDangTien(d.khauTruBaoHiem) },
    { khoa: 'khauTruThueTNCN', tieuDe: 'Thuế TNCN', canPhai: true, hienThi: (d) => dinhDangTien(d.khauTruThueTNCN) },
    { khoa: 'thucLinh', tieuDe: 'Thực lĩnh', canPhai: true, hienThi: (d) => <strong>{dinhDangTien(d.thucLinh)}</strong> },
  ];

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Phiếu lương của tôi</h1>
          <div className="chuPhu">Chỉ hiển thị kỳ lương đã được Ban Giám đốc duyệt · bấm một dòng để xem chi tiết</div>
        </div>
        <label className="truongForm">
          Năm
          <select value={nam} onChange={(e) => setNam(Number(e.target.value))}>
            {[namHienTai - 2, namHienTai - 1, namHienTai].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}
      <BangDuLieu cot={cot} duLieu={dsPhieu} onHanhDong={setDangXem} thongBaoRong={`Chưa có phiếu lương năm ${nam}`} />

      {dangXem && (
        <HopThoai tieuDe={`Phiếu lương tháng ${String(dangXem.thang).padStart(2, '0')}/${dangXem.nam}`} onDong={() => setDangXem(null)}>
          <div className="chuPhu" style={{ marginBottom: 12 }}>
            {dangXem.hoVaTen} ({dangXem.maNhanVien}) · {dangXem.tenChucDanh} · {dangXem.tenPhongBan}
          </div>
          <ChiTietPhieuLuong phieu={dangXem} />
        </HopThoai>
      )}
    </div>
  );
}

export default TrangPhieuLuong;
