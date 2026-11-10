import { useEffect, useMemo, useState } from 'react';
import goiApi from '../../services/goiApi';
import useThongBao from '../../hooks/useThongBao';
import useNgayLe from '../../hooks/useNgayLe';
import TheThongKe from '../../components/TheThongKe';
import HopThoaiChiTietDon from '../../components/nghiPhep/HopThoaiChiTietDon';
import { layThu, thangHienTai } from '../../utils/dinhDang';
import { locPhongBanTrongPhamVi } from '../../utils/phongBan';
import { useXacThuc } from '../../context/NguCanhXacThuc';
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
  const [dangTai, setDangTai] = useState(true); // chỉ lần tải đầu (lần sau giữ lịch cũ tới khi có dữ liệu mới)
  const { nguoiDung } = useXacThuc();
  const { loi, thongBao, baoLoi, baoThanhCong } = useThongBao();
  const [dangXem, setDangXem] = useState(null);

  useEffect(() => {
    goiApi
      .get('/phongBan')
      .then((kq) => setPhongBan(locPhongBanTrongPhamVi(kq.data, nguoiDung)))
      .catch(() => {});
  }, [nguoiDung]);

  const [lamMoi, setLamMoi] = useState(0);

  useEffect(() => {
    // Bỏ qua phản hồi cũ khi đổi tháng/phòng ban nhanh
    let daHuy = false;
    goiApi
      .get('/donNghiPhep/lich', { params: { thang, ...(phongBanId ? { phongBanId } : {}) } })
      .then((kq) => {
        if (!daHuy) {
          setLich(kq.data);
          baoLoi('');
        }
      })
      .catch((e) => {
        if (!daHuy) {
          setLich(null);
          baoLoi(e.message);
        }
      })
      .finally(() => {
        if (!daHuy) setDangTai(false);
      });
    return () => {
      daHuy = true;
    };
  }, [thang, phongBanId, lamMoi, baoLoi]);

  const cacNgay = useMemo(() => layCacNgay(thang), [thang]);
  const { ngayLe, loi: loiNgayLe } = useNgayLe([thang.slice(0, 4)]);
  const laNgayNghi = (ngay) => ['T7', 'CN'].includes(layThu(ngay)) || ngayLe.has(ngay);
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

  // Một ngày có thể có 2 đơn nửa ngày (sáng + chiều)
  const donTrongNgay = (nguoi, ngay) => nguoi.danhSachDon.filter((d) => d.ngayBatDau <= ngay && ngay <= d.ngayKetThuc);
  const items = lich?.items ?? [];
  // Đếm theo người (2 đơn nửa ngày của một người vẫn là 1 người)
  const homNayNghi = new Set(
    items.filter((d) => d.trangThai === 'DA_DUYET' && d.ngayBatDau <= homNay && homNay <= d.ngayKetThuc).map((d) => d.nhanVienId),
  ).size;

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
              {phongBan.map((pb) => (
                <option key={pb.id} value={pb.id}>
                  {pb.tenPhongBan}
                </option>
              ))}
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
      {dangTai && <div className="thongBao">Đang tải lịch nghỉ...</div>}
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
        <span>
          <i style={{ background: 'var(--mauThanhCong)' }} />
          Đã duyệt
        </span>
        <span>
          <i style={{ background: 'var(--mauCanhBao)' }} />
          Chờ duyệt
        </span>
        <span>
          <i style={{ background: 'var(--mauTrungTinhNhat)' }} />
          Thứ 7, Chủ nhật, ngày lễ
        </span>
        {loiNgayLe && <span>(chưa tải được ngày lễ)</span>}
      </div>
      <div className="the luoiLichNghi">
        <table>
          <thead>
            <tr>
              <th className="cotTen">Nhân viên</th>
              {cacNgay.map((ngay) => {
                const thu = layThu(ngay);
                return (
                  <th
                    key={ngay}
                    className={`${laNgayNghi(ngay) ? 'cuoiTuan' : ''} ${ngay === homNay ? 'homNay' : ''}`}
                    title={ngayLe.has(ngay) ? 'Ngày lễ' : undefined}
                  >
                    {Number(ngay.slice(8))}
                    <br />
                    {thu}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {hang.length === 0 && (
              <tr>
                <td className="oRong" colSpan={cacNgay.length + 1} style={{ padding: 16 }}>
                  Không có lịch nghỉ trong tháng
                </td>
              </tr>
            )}
            {hang.map((nguoi) => (
              <tr key={nguoi.nhanVienId}>
                <td className="cotTen">
                  {nguoi.hoVaTen}{' '}
                  <span className="chuPhu">
                    {nguoi.maNhanVien} · {nguoi.tenPhongBan}
                  </span>
                </td>
                {cacNgay.map((ngay) => {
                  const ngayNghi = laNgayNghi(ngay);
                  const dsDon = ngayNghi ? [] : donTrongNgay(nguoi, ngay);
                  const coChoDuyet = dsDon.some((d) => d.trangThai === 'CHO_DUYET');
                  const lop = dsDon.length ? (coChoDuyet ? 'choDuyet' : 'daDuyet') : ngayNghi ? 'cuoiTuan' : '';
                  return (
                    <td
                      key={ngay}
                      className={lop}
                      title={dsDon.length ? dsDon.map((d) => `${d.maDon} · ${d.tenLoai}`).join(' | ') : undefined}
                      onClick={dsDon.length === 1 ? () => setDangXem(dsDon[0]) : undefined}
                    >
                      {dsDon.length === 1 && dsDon[0].soNgayNghi === 0.5 && '½'}
                      {/* 2 đơn nửa ngày: mỗi nửa ô mở đúng đơn của nó */}
                      {dsDon.length > 1 &&
                        dsDon.map((d) => (
                          <span key={d.id} className="nuaO" role="button" onClick={() => setDangXem(d)}>
                            ½
                          </span>
                        ))}
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
          onDaXuLy={(tb) => {
            setDangXem(null);
            baoThanhCong(tb);
            setLamMoi((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

export default TrangLichNghi;
