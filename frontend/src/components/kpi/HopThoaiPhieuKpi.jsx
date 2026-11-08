import { useCallback, useEffect, useState } from 'react';
import goiApi from '../../services/goiApi';
import HopThoai from '../HopThoai';
import NutBam from '../NutBam';
import ChipTrangThai from '../ChipTrangThai';
import { dinhDangNgay, dinhDangThoiGian } from '../../utils/dinhDang';

const oSo = { width: 80 };
const oChu = { width: '100%' };

// Chi tiết phiếu KPI. Chế độ nhập theo quyền backend trả về (phieu.quyen):
// - tuCham: nhân viên nhập kết quả thực tế, điểm tự chấm, giải trình -> lưu nháp / gửi nghiệm thu
// - nghiemThu: quanLy/giamDoc chấm điểm nghiệm thu, nhận xét -> nghiệm thu / trả lại
// - quanTri: HR/quanLy chỉnh mục tiêu, trọng số khi phiếu còn nháp -> lưu / xóa phiếu
function HopThoaiPhieuKpi({ phieuId, onDong, onThayDoi }) {
  const [phieu, setPhieu] = useState(null);
  const [nhap, setNhap] = useState({});
  const [chung, setChung] = useState({ giaiTrinhNhanVien: '', nhanXetQuanLy: '', lyDo: '' });
  const [loi, setLoi] = useState('');
  const [thongBao, setThongBao] = useState('');
  const [dangGui, setDangGui] = useState(false);

  const napPhieu = useCallback((p) => {
    setPhieu(p);
    setNhap(Object.fromEntries(p.chiTiet.map((c) => [c.id, {
      mucTieu: c.mucTieu ?? '', trongSo: String(c.trongSo), ketQuaThucTe: c.ketQuaThucTe ?? '',
      diemTuCham: c.diemTuCham ?? '', diemNghiemThu: c.diemNghiemThu ?? c.diemTuCham ?? '', nhanXet: c.nhanXet ?? '',
    }])));
    setChung({ giaiTrinhNhanVien: p.giaiTrinhNhanVien ?? '', nhanXetQuanLy: '', lyDo: '' });
  }, []);

  useEffect(() => {
    goiApi.get(`/phieuDanhGiaKPI/${phieuId}`).then((kq) => napPhieu(kq.data)).catch((e) => setLoi(e.message));
  }, [phieuId, napPhieu]);

  const doi = (id, truong) => (e) => setNhap((cu) => ({ ...cu, [id]: { ...cu[id], [truong]: e.target.value } }));
  const soHoacNull = (v) => (v === '' ? null : Number(v));

  const thucHien = async (congViec, thongBaoXong, dong = false) => {
    setDangGui(true);
    setLoi('');
    setThongBao('');
    try {
      const kq = await congViec();
      onThayDoi?.();
      if (dong) { onDong(); return; }
      if (kq?.data?.chiTiet) napPhieu(kq.data);
      setThongBao(thongBaoXong ?? kq.message);
    } catch (e) {
      setLoi(e.message);
    } finally {
      setDangGui(false);
    }
  };

  if (!phieu) {
    return <HopThoai tieuDe="Phiếu đánh giá KPI" onDong={onDong}>{loi ? <div className="thongBao loi">{loi}</div> : 'Đang tải...'}</HopThoai>;
  }

  const { quyen } = phieu;
  const luuTuCham = () => goiApi.patch(`/phieuDanhGiaKPI/${phieu.id}/tuCham`, {
    giaiTrinhNhanVien: chung.giaiTrinhNhanVien,
    chiTiet: phieu.chiTiet.map((c) => ({ id: c.id, ketQuaThucTe: nhap[c.id].ketQuaThucTe, diemTuCham: soHoacNull(nhap[c.id].diemTuCham) })),
  });

  let nutChan = <NutBam bienThe="phu" onClick={onDong}>Đóng</NutBam>;
  if (quyen.tuCham) {
    nutChan = (
      <>
        <NutBam bienThe="phu" disabled={dangGui} onClick={() => thucHien(luuTuCham, 'Đã lưu nháp')}>Lưu nháp</NutBam>
        <NutBam disabled={dangGui} onClick={() => thucHien(async () => { await luuTuCham(); return goiApi.post(`/phieuDanhGiaKPI/${phieu.id}/guiDuyet`); })}>
          Gửi nghiệm thu
        </NutBam>
      </>
    );
  } else if (quyen.nghiemThu) {
    nutChan = (
      <>
        <NutBam
          bienThe="phu"
          disabled={dangGui}
          onClick={() => {
            if (!chung.lyDo.trim()) { setLoi('Nhập lý do trả lại'); return; }
            thucHien(() => goiApi.post(`/phieuDanhGiaKPI/${phieu.id}/traLai`, { lyDo: chung.lyDo }), null, true);
          }}
        >
          Trả lại
        </NutBam>
        <NutBam
          disabled={dangGui}
          onClick={() => thucHien(() => goiApi.post(`/phieuDanhGiaKPI/${phieu.id}/nghiemThu`, {
            nhanXetQuanLy: chung.nhanXetQuanLy,
            chiTiet: phieu.chiTiet.map((c) => ({ id: c.id, diemNghiemThu: soHoacNull(nhap[c.id].diemNghiemThu), nhanXet: nhap[c.id].nhanXet })),
          }))}
        >
          Nghiệm thu
        </NutBam>
      </>
    );
  } else if (quyen.quanTri) {
    nutChan = (
      <>
        <NutBam
          bienThe="phu"
          disabled={dangGui}
          onClick={() => window.confirm('Xóa phiếu đánh giá nháp này?') && thucHien(() => goiApi.delete(`/phieuDanhGiaKPI/${phieu.id}`), null, true)}
        >
          Xóa phiếu
        </NutBam>
        <NutBam
          disabled={dangGui}
          onClick={() => thucHien(() => goiApi.patch(`/phieuDanhGiaKPI/${phieu.id}`, {
            chiTiet: phieu.chiTiet.map((c) => ({ id: c.id, mucTieu: nhap[c.id].mucTieu, trongSo: Number(nhap[c.id].trongSo) })),
          }))}
        >
          Lưu mục tiêu
        </NutBam>
      </>
    );
  }

  return (
    <HopThoai tieuDe={`Phiếu KPI · ${phieu.hoVaTen} (${phieu.maNhanVien})`} onDong={onDong} rong={980} chanTrang={nutChan}>
      {loi && <div className="thongBao loi">{loi}</div>}
      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      <div className="luoiThongTin" style={{ marginBottom: 12 }}>
        <div className="oThongTin"><span>Kỳ đánh giá</span><strong>{phieu.tenKyDanhGia}</strong></div>
        <div className="oThongTin"><span>Thời gian</span><strong>{dinhDangNgay(phieu.ngayBatDau)} – {dinhDangNgay(phieu.ngayKetThuc)}</strong></div>
        <div className="oThongTin"><span>Vị trí</span><strong>{phieu.tenChucDanh ?? '—'} · {phieu.tenPhongBan ?? '—'}</strong></div>
        <div className="oThongTin"><span>Trạng thái</span><strong><ChipTrangThai trangThai={phieu.trangThai} /></strong></div>
        <div className="oThongTin"><span>Điểm tự chấm</span><strong>{phieu.diemTuChamTong ?? '—'}</strong></div>
        <div className="oThongTin">
          <span>Điểm nghiệm thu</span>
          <strong>{phieu.diemTong ?? '—'} {phieu.xepLoaiChung && <ChipTrangThai trangThai={phieu.xepLoaiChung} />}</strong>
        </div>
        {phieu.tenNguoiDanhGia && (
          <div className="oThongTin"><span>Người nghiệm thu</span><strong>{phieu.tenNguoiDanhGia} · {dinhDangThoiGian(phieu.ngayNghiemThu)}</strong></div>
        )}
      </div>
      {phieu.trangThaiKy !== 'DANG_MO' && <div className="thongBao canhBao">Kỳ đánh giá đã đóng, phiếu chỉ xem.</div>}

      <div className="bangBoc the">
        <table className="bangDuLieu">
          <thead>
            <tr>
              <th>Chỉ tiêu</th><th>Mục tiêu</th><th className="canPhai">Trọng số</th><th>Kết quả thực tế</th>
              <th className="canPhai">Tự chấm</th><th className="canPhai">Nghiệm thu</th><th>Nhận xét</th>
            </tr>
          </thead>
          <tbody>
            {phieu.chiTiet.map((c) => (
              <tr key={c.id}>
                <td>{c.tenChiTieu} <div className="chuPhu">{c.maChiTieu}{c.donViDo ? ` · ${c.donViDo}` : ''}</div></td>
                <td>{quyen.quanTri ? <input style={oChu} value={nhap[c.id].mucTieu} onChange={doi(c.id, 'mucTieu')} /> : (c.mucTieu ?? '—')}</td>
                <td className="canPhai">
                  {quyen.quanTri ? <input style={oSo} type="number" step="0.01" min="0.01" value={nhap[c.id].trongSo} onChange={doi(c.id, 'trongSo')} /> : c.trongSo}
                </td>
                <td>{quyen.tuCham ? <input style={oChu} value={nhap[c.id].ketQuaThucTe} onChange={doi(c.id, 'ketQuaThucTe')} /> : (c.ketQuaThucTe ?? '—')}</td>
                <td className="canPhai">
                  {quyen.tuCham
                    ? <input style={oSo} type="number" step="0.01" min="0" max="10" value={nhap[c.id].diemTuCham} onChange={doi(c.id, 'diemTuCham')} />
                    : (c.diemTuCham ?? '—')}
                </td>
                <td className="canPhai">
                  {quyen.nghiemThu
                    ? <input style={oSo} type="number" step="0.01" min="0" max="10" value={nhap[c.id].diemNghiemThu} onChange={doi(c.id, 'diemNghiemThu')} />
                    : (c.diemNghiemThu ?? '—')}
                </td>
                <td>{quyen.nghiemThu ? <input style={oChu} value={nhap[c.id].nhanXet} onChange={doi(c.id, 'nhanXet')} /> : (c.nhanXet ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bieuMau" style={{ marginTop: 12 }}>
        <label className="truongForm rongHet">
          Giải trình của nhân viên
          {quyen.tuCham
            ? <textarea value={chung.giaiTrinhNhanVien} onChange={(e) => setChung((cu) => ({ ...cu, giaiTrinhNhanVien: e.target.value }))} />
            : <div>{phieu.giaiTrinhNhanVien || '—'}</div>}
        </label>
        {phieu.nhanXetQuanLy && (
          <label className="truongForm rongHet">Nhận xét của người nghiệm thu<div>{phieu.nhanXetQuanLy}</div></label>
        )}
        {quyen.nghiemThu && (
          <>
            <label className="truongForm rongHet">
              Nhận xét chung
              <textarea value={chung.nhanXetQuanLy} onChange={(e) => setChung((cu) => ({ ...cu, nhanXetQuanLy: e.target.value }))} />
            </label>
            <label className="truongForm rongHet">
              Lý do trả lại (khi bấm Trả lại)
              <input value={chung.lyDo} onChange={(e) => setChung((cu) => ({ ...cu, lyDo: e.target.value }))} />
            </label>
          </>
        )}
        {quyen.tuCham && <small className="chuPhu rongHet">Điểm thang 0–10, tối đa 2 chữ số thập phân. Cần chấm đủ mọi chỉ tiêu trước khi gửi.</small>}
      </div>
    </HopThoai>
  );
}

export default HopThoaiPhieuKpi;
