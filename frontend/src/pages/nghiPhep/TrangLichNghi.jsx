import { useEffect, useMemo, useState } from 'react';
import goiApi from '../../services/goiApi';
import TheThongKe from '../../components/TheThongKe';
import HopThoaiChiTietDon from '../../components/nghiPhep/HopThoaiChiTietDon';
import { layThu, thangHienTai } from '../../utils/dinhDang';
import './TrangLichNghi.css';

function layCacNgay(thang) {
  const [nam, so] = thang.split('-').map(Number);
  const soNgay = new Date(Date.UTC(nam, so, 0)).getUTCDate();
  return Array.from({ length: soNgay }, (_, i) => `${thang}-${String(i + 1).padStart(2, '0')}`);
}

// Lịch nghỉ tháng (HR, giamDoc toàn công ty; quanLy phòng mình): đơn đã duyệt và đang chờ duyệt
function TrangLichNghi() {
  const [thang, setThang] = useState(thangHienTai());
  const [phongBanId, setPhongBanId] = useState('');
  const [phongBan, setPhongBan] = useState([]);
  const [lich, setLich] = useState(null);
  const [loi, setLoi] = useState('');
  const [dangXem, setDangXem] = useState(null);

  useEffect(() => {
    goiApi.get('/phongBan').then((kq) => setPhongBan(kq.data)).catch(() => {});
  }, []);

  const [lamMoi, setLamMoi] = useState(0);
  const [thongBao, setThongBao] = useState('');

  useEffect(() => {
    // Bỏ qua phản hồi cũ khi đổi tháng/phòng ban nhanh
    let daHuy = false;
    goiApi.get('/donNghiPhep/lich', { params: { thang, ...(phongBanId ? { phongBanId } : {}) } })
      .then((kq) => { if (!daHuy) { setLich(kq.data); setLoi(''); } })
      .catch((e) => { if (!daHuy) { setLich(null); setLoi(e.message); } });
    return () => { daHuy = true; };
  }, [thang, phongBanId, lamMoi]);

  const cacNgay = useMemo(() => layCacNgay(thang), [thang]);
  const homNay = new Date().toLocaleDateString('sv-SE');

  // Gom đơn theo nhân viên: { nhanVienId: { hoVaTen, maNhanVien, tenPhongBan, don: [...] } }
  const hang = useMemo(() => {
    const theoNguoi = new Map();
    for (const don of lich?.items ?? []) {
      if (!theoNguoi.has(don.nhanVienId)) {
        theoNguoi.set(don.nhanVienId, { ...don, danhSachDon: [] });
      }
      theoNguoi.get(don.nhanVienId).danhSachDon.push(don);
    }
    return [...theoNguoi.values()].sort((a, b) => a.maNhanVien.localeCompare(b.maNhanVien));
  }, [lich]);

  const donTrongNgay = (nguoi, ngay) => nguoi.danhSachDon.find((d) => d.ngayBatDau <= ngay && ngay <= d.ngayKetThuc);
  const items = lich?.items ?? [];
  const homNayNghi = items.filter((d) => d.trangThai === 'DA_DUYET' && d.ngayBatDau <= homNay && homNay <= d.ngayKetThuc).length;

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Lịch nghỉ</h1>
          <div className="chuPhu">Bấm vào ô nghỉ để xem chi tiết đơn</div>
        </div>
        <div className="hangNutPhai">
          <label className="truongForm">
            Phòng ban
            <select value={phongBanId} onChange={(e) => setPhongBanId(e.target.value)}>
              <option value="">Tất cả</option>
              {phongBan.map((pb) => <option key={pb.id} value={pb.id}>{pb.tenPhongBan}</option>)}
            </select>
          </label>
          <label className="truongForm">
            Tháng
            <input type="month" value={thang} onChange={(e) => e.target.value && setThang(e.target.value)} />
          </label>
        </div>
      </div>

      {loi && <div className="thongBao loi">{loi}</div>}
      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      {lich?.biCat && <div className="thongBao canhBao">Tháng có quá nhiều đơn, lịch chỉ hiện 1000 đơn đầu; hãy lọc theo phòng ban.</div>}
      <div className="luoiThe" style={{ marginBottom: 16 }}>
        <TheThongKe tieuDe="Người có lịch nghỉ trong tháng" giaTri={hang.length} moTa={`${items.length} đơn`} />
        <TheThongKe
          tieuDe="Đơn đang chờ duyệt"
          giaTri={items.filter((d) => d.trangThai === 'CHO_DUYET').length}
          moTa="trong tháng"
          trangThai={items.some((d) => d.trangThai === 'CHO_DUYET') ? 'canhBao' : 'thanhCong'}
        />
        {thang === thangHienTai() && <TheThongKe tieuDe="Nghỉ hôm nay" giaTri={homNayNghi} moTa="người (đơn đã duyệt)" />}
      </div>

      <div className="chuThichLich">
        <span><i style={{ background: 'var(--mauThanhCong)' }} />Đã duyệt</span>
        <span><i style={{ background: 'var(--mauCanhBao)' }} />Chờ duyệt</span>
        <span><i style={{ background: 'var(--mauTrungTinhNhat)' }} />Thứ 7, Chủ nhật</span>
      </div>
      <div className="the luoiLichNghi">
        <table>
          <thead>
            <tr>
              <th className="cotTen">Nhân viên</th>
              {cacNgay.map((ngay) => {
                const thu = layThu(ngay);
                return (
                  <th key={ngay} className={`${['T7', 'CN'].includes(thu) ? 'cuoiTuan' : ''} ${ngay === homNay ? 'homNay' : ''}`}>
                    {Number(ngay.slice(8))}<br />{thu}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {hang.length === 0 && (
              <tr><td className="oRong" colSpan={cacNgay.length + 1} style={{ padding: 16 }}>Không có lịch nghỉ trong tháng</td></tr>
            )}
            {hang.map((nguoi) => (
              <tr key={nguoi.nhanVienId}>
                <td className="cotTen">{nguoi.hoVaTen} <span className="chuPhu">{nguoi.maNhanVien} · {nguoi.tenPhongBan}</span></td>
                {cacNgay.map((ngay) => {
                  const cuoiTuan = ['T7', 'CN'].includes(layThu(ngay));
                  const don = cuoiTuan ? null : donTrongNgay(nguoi, ngay);
                  const lop = don ? (don.trangThai === 'DA_DUYET' ? 'daDuyet' : 'choDuyet') : (cuoiTuan ? 'cuoiTuan' : '');
                  return (
                    <td
                      key={ngay}
                      className={lop}
                      title={don ? `${don.maDon} · ${don.tenLoai}` : undefined}
                      onClick={don ? () => setDangXem(don) : undefined}
                    >
                      {don && don.soNgayNghi === 0.5 ? '½' : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dangXem && (
        <HopThoaiChiTietDon
          don={dangXem}
          cheDo="duyet"
          onDong={() => setDangXem(null)}
          onDaXuLy={(tb) => { setDangXem(null); setThongBao(tb); setLamMoi((n) => n + 1); }}
        />
      )}
    </div>
  );
}

export default TrangLichNghi;
