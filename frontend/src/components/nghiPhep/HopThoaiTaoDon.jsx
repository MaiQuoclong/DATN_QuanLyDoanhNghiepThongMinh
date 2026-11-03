import { useEffect, useState } from 'react';
import goiApi from '../../services/goiApi';
import HopThoai from '../HopThoai';
import NutBam from '../NutBam';
import { demNgayLamViec } from '../../utils/dinhDang';

// Tạo đơn nghỉ phép của chính mình (CHO_DUYET). Số ngày xem trước bỏ T7/CN; backend tính lại và kiểm tra quỹ.
function HopThoaiTaoDon({ quy, onDong, onDaGui }) {
  const [dsLoai, setDsLoai] = useState([]);
  const [giaTri, setGiaTri] = useState({ loaiNghiPhepId: '', ngayBatDau: '', ngayKetThuc: '', nuaNgay: false, lyDo: '' });
  const [loi, setLoi] = useState('');
  const [dangGui, setDangGui] = useState(false);

  useEffect(() => {
    goiApi.get('/loaiNghiPhep', { params: { trangThai: 'DANG_AP_DUNG' } })
      .then((kq) => setDsLoai(kq.data))
      .catch((e) => setLoi(e.message));
  }, []);

  const doi = (ten) => (e) => {
    const moi = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setGiaTri((cu) => {
      const tiep = { ...cu, [ten]: moi };
      // Chọn ngày bắt đầu mà chưa có ngày kết thúc (hoặc kết thúc trước đó) thì gợi ý nghỉ 1 ngày
      if (ten === 'ngayBatDau' && (!cu.ngayKetThuc || cu.ngayKetThuc < moi)) tiep.ngayKetThuc = moi;
      return tiep;
    });
  };

  const loai = dsLoai.find((l) => String(l.id) === giaTri.loaiNghiPhepId);
  const motNgay = giaTri.ngayBatDau && giaTri.ngayBatDau === giaTri.ngayKetThuc;
  // Quỹ truyền vào là quỹ năm hiện tại: chỉ nhắc số dư khi đơn thuộc đúng năm đó
  const quyCungNam = quy && (!giaTri.ngayBatDau || Number(giaTri.ngayBatDau.slice(0, 4)) === quy.nam) ? quy : null;
  const soNgay = motNgay && giaTri.nuaNgay ? 0.5 : demNgayLamViec(giaTri.ngayBatDau, giaTri.ngayKetThuc);

  const gui = async (e) => {
    e.preventDefault();
    setDangGui(true);
    setLoi('');
    try {
      const kq = await goiApi.post('/donNghiPhep', {
        loaiNghiPhepId: Number(giaTri.loaiNghiPhepId),
        ngayBatDau: giaTri.ngayBatDau,
        ngayKetThuc: giaTri.ngayKetThuc,
        nuaNgay: Boolean(motNgay && giaTri.nuaNgay),
        lyDo: giaTri.lyDo,
      });
      onDaGui(kq);
    } catch (loiApi) {
      setLoi(loiApi.message);
      setDangGui(false);
    }
  };

  return (
    <HopThoai
      tieuDe="Tạo đơn nghỉ phép"
      onDong={onDong}
      chanTrang={(
        <>
          <NutBam bienThe="phu" type="button" onClick={onDong}>Hủy</NutBam>
          <NutBam type="submit" form="formTaoDon" disabled={dangGui}>{dangGui ? 'Đang gửi...' : 'Gửi đơn'}</NutBam>
        </>
      )}
    >
      {loi && <div className="thongBao loi">{loi}</div>}
      <form id="formTaoDon" className="bieuMau" onSubmit={gui}>
        <label className="truongForm rongHet">
          Loại nghỉ phép *
          <select value={giaTri.loaiNghiPhepId} onChange={doi('loaiNghiPhepId')} required>
            <option value="">-- Chọn --</option>
            {dsLoai.map((l) => <option key={l.id} value={l.id}>{l.tenLoai}</option>)}
          </select>
          {loai && (
            <small className="chuPhu">
              {loai.coLuong ? 'Có lương' : 'Không lương'}
              {loai.truVaoQuyPhepNam ? ' · trừ quỹ phép năm' : ' · không trừ quỹ phép'}
              {loai.soNgayToiDa !== null && ` · tối đa ${loai.soNgayToiDa} ngày/đơn`}
              {loai.moTa && ` · ${loai.moTa}`}
            </small>
          )}
        </label>
        <label className="truongForm">
          Từ ngày *
          <input type="date" value={giaTri.ngayBatDau} onChange={doi('ngayBatDau')} required />
        </label>
        <label className="truongForm">
          Đến ngày *
          <input type="date" value={giaTri.ngayKetThuc} min={giaTri.ngayBatDau || undefined} onChange={doi('ngayKetThuc')} required />
        </label>
        {motNgay && (
          <label className="truongForm rongHet" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={giaTri.nuaNgay} onChange={doi('nuaNgay')} />
            Chỉ nghỉ nửa ngày
          </label>
        )}
        <label className="truongForm rongHet">
          Lý do *
          <textarea value={giaTri.lyDo} onChange={doi('lyDo')} required minLength={5} maxLength={1000} placeholder="Ví dụ: về quê có việc gia đình" />
        </label>
      </form>
      <div className="chuPhu">
        Số ngày nghỉ (bỏ thứ 7, Chủ nhật): <strong>{soNgay}</strong>
        {loai?.truVaoQuyPhepNam && quyCungNam && quyCungNam.soNgayConLai !== null && ` · quỹ phép còn ${quyCungNam.soNgayConLai} ngày`}
        {loai?.truVaoQuyPhepNam && quyCungNam && quyCungNam.soNgayConLai === null && ' · bạn chưa được cấp quỹ phép năm nay'}
        {loai?.truVaoQuyPhepNam && quy && !quyCungNam && ' · quỹ phép năm khác được kiểm tra khi gửi'}
      </div>
    </HopThoai>
  );
}

export default HopThoaiTaoDon;
