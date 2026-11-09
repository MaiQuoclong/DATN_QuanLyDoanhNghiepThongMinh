import { useState } from 'react';
import HopThoai from './HopThoai';
import NutBam from './NutBam';
import OChonNhanVien from './OChonNhanVien';

// Hộp thoại biểu mẫu theo cấu hình trường.
// truong: [{ ten, nhan, kieu?: 'text'|'date'|'number'|'select'|'textarea'|'nhanVien', luaChon?: [{giaTri, nhan}],
//            locNhanVien? (kieu 'nhanVien', xem OChonNhanVien), batBuoc?, rongHet?, goiY?, ghiChu? }]
// onGui(giaTri) trả Promise; lỗi API hiển thị trong hộp thoại, thành công thì onDong do nơi gọi quyết định.
function HopThoaiBieuMau({ tieuDe, truong, giaTriBanDau = {}, nhanNutGui = 'Lưu', bienTheNut = 'chinh', moTa, onGui, onDong }) {
  const [giaTri, setGiaTri] = useState(() => Object.fromEntries(truong.map((t) => [t.ten, giaTriBanDau[t.ten] ?? ''])));
  const [loi, setLoi] = useState('');
  const [dangGui, setDangGui] = useState(false);

  const gui = async (e) => {
    e.preventDefault();
    setDangGui(true);
    setLoi('');
    try {
      await onGui(giaTri);
    } catch (loiApi) {
      setLoi(loiApi.message ?? 'Có lỗi xảy ra');
      setDangGui(false);
    }
  };

  const doi = (ten) => (e) => setGiaTri((cu) => ({ ...cu, [ten]: e.target.value }));

  return (
    <HopThoai
      tieuDe={tieuDe}
      onDong={onDong}
      chanTrang={
        <>
          <NutBam bienThe="phu" type="button" onClick={onDong}>
            Hủy
          </NutBam>
          <NutBam bienThe={bienTheNut} type="submit" form="hopThoaiBieuMau" disabled={dangGui}>
            {dangGui ? 'Đang xử lý...' : nhanNutGui}
          </NutBam>
        </>
      }
    >
      {moTa && <div className="thongBao canhBao">{moTa}</div>}
      {loi && <div className="thongBao loi">{loi}</div>}
      <form id="hopThoaiBieuMau" className="bieuMau" onSubmit={gui}>
        {truong.map(({ ten, nhan, kieu = 'text', luaChon = [], locNhanVien, batBuoc, rongHet, goiY, ghiChu }) => (
          <label key={ten} className={`truongForm ${rongHet || ['textarea', 'nhanVien'].includes(kieu) ? 'rongHet' : ''}`}>
            {nhan}
            {batBuoc && ' *'}
            {kieu === 'nhanVien' && <OChonNhanVien value={giaTri[ten]} onChange={doi(ten)} loc={locNhanVien} batBuoc={batBuoc} />}
            {kieu === 'select' && (
              <select value={giaTri[ten]} onChange={doi(ten)} required={batBuoc}>
                <option value="">-- Chọn --</option>
                {luaChon.map((lc) => (
                  <option key={lc.giaTri} value={lc.giaTri}>
                    {lc.nhan}
                  </option>
                ))}
              </select>
            )}
            {kieu === 'textarea' && <textarea value={giaTri[ten]} onChange={doi(ten)} required={batBuoc} placeholder={goiY} />}
            {!['select', 'textarea', 'nhanVien'].includes(kieu) && (
              <input
                type={kieu}
                value={giaTri[ten]}
                onChange={doi(ten)}
                required={batBuoc}
                placeholder={goiY}
                min={kieu === 'number' ? 0 : undefined}
                step={kieu === 'number' ? 'any' : undefined}
              />
            )}
            {ghiChu && <small className="chuPhu">{ghiChu}</small>}
          </label>
        ))}
      </form>
    </HopThoai>
  );
}

export default HopThoaiBieuMau;
