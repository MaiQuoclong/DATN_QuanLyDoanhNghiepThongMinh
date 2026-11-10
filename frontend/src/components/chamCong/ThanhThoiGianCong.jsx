import './ThanhThoiGianCong.css';

// Thang hiển thị 06:00 - 21:00; giờ ca lấy theo tham số backend (mặc định 08:00-17:00, nghỉ trưa 12:00-13:00)
const BAT_DAU = 6 * 60;
const KET_THUC = 21 * 60;
const CA_MAC_DINH = { gioVaoCa: '08:00', gioRaCa: '17:00', batDauNghiTrua: '12:00', ketThucNghiTrua: '13:00' };

const doiPhut = (gio) => {
  const [h, m] = String(gio).split(':').map(Number);
  return h * 60 + m;
};
const kep = (phut) => Math.min(Math.max(phut, BAT_DAU), KET_THUC);

function doan(lop, tu, den) {
  const a = kep(tu);
  const b = kep(den);
  if (b <= a) return null;
  const trai = ((a - BAT_DAU) / (KET_THUC - BAT_DAU)) * 100;
  const rong = ((b - a) / (KET_THUC - BAT_DAU)) * 100;
  return <span key={`${lop}${tu}`} className={lop} style={{ left: `${trai}%`, width: `${rong}%` }} />;
}

function ThanhThoiGianCong({ banGhi, ca = CA_MAC_DINH }) {
  if (!banGhi?.gioVao) return <div className="thanhThoiGian" />;
  const vao = doiPhut(banGhi.gioVao);
  const ra = banGhi.gioRa ? doiPhut(banGhi.gioRa) : vao;
  const gioRaCa = doiPhut(ca.gioRaCa);
  const nghiTu = doiPhut(ca.batDauNghiTrua);
  const nghiDen = doiPhut(ca.ketThucNghiTrua);
  const ketThucCa = Math.min(ra, gioRaCa);
  return (
    <div
      className="thanhThoiGian"
      title={`${String(banGhi.gioVao).slice(0, 5)} - ${banGhi.gioRa ? String(banGhi.gioRa).slice(0, 5) : 'chưa check-out'}`}
    >
      {banGhi.diMuon && doan('diMuon', doiPhut(ca.gioVaoCa), vao)}
      {doan('lamViec', vao, Math.min(ketThucCa, nghiTu))}
      {doan('nghiTrua', Math.max(vao, nghiTu), Math.min(ra, nghiDen))}
      {doan('lamViec', Math.max(vao, nghiDen), ketThucCa)}
      {doan('tangCa', Math.max(vao, gioRaCa), ra)}
    </div>
  );
}

export function ChuThichThoiGian() {
  return (
    <div className="chuThichThoiGian">
      <span>
        <i style={{ background: 'var(--mauChinh)' }} />
        Làm việc
      </span>
      <span>
        <i style={{ background: '#14b8a6' }} />
        Nghỉ trưa
      </span>
      <span>
        <i style={{ background: '#f97316', opacity: 0.55 }} />
        Đi muộn
      </span>
      <span>
        <i style={{ background: 'var(--mauCanhBao)' }} />
        Tăng ca
      </span>
    </div>
  );
}

export default ThanhThoiGianCong;
