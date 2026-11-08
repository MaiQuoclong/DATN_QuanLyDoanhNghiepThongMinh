import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import goiApi from '../../services/goiApi';
import BangDuLieu from '../../components/BangDuLieu';
import TheThongKe from '../../components/TheThongKe';

// Thứ tự và màu xếp loại (tốt -> kém), khớp THAM_SO_KPI ở backend
const XEP_LOAI = [
  ['XUAT_SAC', 'Xuất sắc', '#15803d'], ['TOT', 'Tốt', '#22c55e'], ['KHA', 'Khá', '#eab308'],
  ['TRUNG_BINH', 'Trung bình', '#f97316'], ['YEU', 'Yếu', '#dc2626'],
];

// Tab Báo cáo: xếp loại KPI theo kỳ và phòng ban (HR, giamDoc toàn công ty; quanLy phòng mình)
function TrangBaoCaoKpi() {
  const [dsKy, setDsKy] = useState([]);
  const [kyId, setKyId] = useState('');
  const [baoCao, setBaoCao] = useState(null);
  const [loi, setLoi] = useState('');

  useEffect(() => {
    goiApi.get('/kyDanhGiaKPI').then((kq) => {
      setDsKy(kq.data);
      // Mặc định kỳ gần nhất đã có phiếu nghiệm thu
      const ky = kq.data.find((k) => k.soPhieuDaDuyet > 0) ?? kq.data[0];
      if (ky) setKyId(String(ky.id));
    }).catch((e) => setLoi(e.message));
  }, []);

  useEffect(() => {
    if (!kyId) return;
    goiApi.get('/phieuDanhGiaKPI/baoCao', { params: { kyDanhGiaId: kyId } })
      .then((kq) => { setBaoCao(kq.data); setLoi(''); })
      .catch((e) => setLoi(e.message));
  }, [kyId]);

  const tong = baoCao?.tongHop;
  const duLieuBieuDo = (baoCao?.theoPhongBan ?? []).map((pb) => ({
    ten: pb.tenPhongBan, ...Object.fromEntries(XEP_LOAI.map(([ma]) => [ma, pb.theoXepLoai[ma] ?? 0])),
  }));
  const cot = [
    { khoa: 'tenPhongBan', tieuDe: 'Phòng ban' },
    { khoa: 'soPhieu', tieuDe: 'Số phiếu', canPhai: true },
    { khoa: 'daDuyet', tieuDe: 'Đã nghiệm thu', canPhai: true, hienThi: (d) => d.theoTrangThai.DA_DUYET },
    { khoa: 'diemTrungBinh', tieuDe: 'Điểm TB', canPhai: true, hienThi: (d) => d.diemTrungBinh ?? '—' },
    ...XEP_LOAI.map(([ma, nhan]) => ({ khoa: ma, tieuDe: nhan, canPhai: true, sapXep: false, hienThi: (d) => d.theoXepLoai[ma] ?? 0 })),
  ];

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Báo cáo xếp loại KPI</h1>
          <div className="chuPhu">Chỉ tính phiếu đã nghiệm thu · điểm tổng = trung bình có trọng số điểm nghiệm thu (thang 10)</div>
        </div>
        <label className="truongForm">
          Kỳ đánh giá
          <select value={kyId} onChange={(e) => setKyId(e.target.value)}>
            {dsKy.map((k) => <option key={k.id} value={k.id}>{k.tenKyDanhGia}</option>)}
          </select>
        </label>
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}
      {tong && (
        <>
          <div className="luoiThongKe" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <TheThongKe tieuDe="Tổng số phiếu" giaTri={tong.soPhieu} moTa={`${tong.theoTrangThai.CHO_DUYET} chờ nghiệm thu · ${tong.theoTrangThai.BAN_NHAP} nháp`} />
            <TheThongKe tieuDe="Đã nghiệm thu" giaTri={tong.theoTrangThai.DA_DUYET} />
            <TheThongKe tieuDe="Điểm trung bình" giaTri={tong.diemTrungBinh ?? '—'} />
            <TheThongKe
              tieuDe="Xuất sắc + Tốt"
              giaTri={tong.theoXepLoai.XUAT_SAC + tong.theoXepLoai.TOT}
              moTa={`${tong.theoXepLoai.YEU} xếp loại Yếu`}
              trangThai={tong.theoXepLoai.YEU ? 'canhBao' : 'thanhCong'}
            />
          </div>
          {duLieuBieuDo.length > 0 && (
            <div className="the" style={{ padding: 16, marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Phân bố xếp loại theo phòng ban</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={duLieuBieuDo}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="ten" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  {XEP_LOAI.map(([ma, nhan, mau]) => <Bar key={ma} dataKey={ma} name={nhan} stackId="xl" fill={mau} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <BangDuLieu cot={cot} khoaDong="tenPhongBan" duLieu={baoCao.theoPhongBan} thongBaoRong="Kỳ này chưa có phiếu đánh giá" />
        </>
      )}
    </div>
  );
}

export default TrangBaoCaoKpi;
