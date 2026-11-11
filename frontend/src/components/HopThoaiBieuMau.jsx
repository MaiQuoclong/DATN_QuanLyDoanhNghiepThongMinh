import { useState } from 'react';
import HopThoai from './HopThoai';
import NutBam from './NutBam';
import OChonNhanVien from './OChonNhanVien';

// Hộp thoại biểu mẫu theo cấu hình trường.
// truong: [{ ten, nhan, kieu?: 'text'|'date'|'number'|'select'|'textarea'|'nhanVien'|'tep',
//            chapNhan? (kieu 'tep': thuộc tính accept, giá trị trường là File hoặc ''),
//            luaChon?: [{giaTri, nhan}] hoặc hàm (giaTriForm) => [...] khi lựa chọn phụ thuộc trường khác,
//            locNhanVien? (kieu 'nhanVien', xem OChonNhanVien), batBuoc?, rongHet?, goiY?, ghiChu? }]
// loiNgoai: lỗi của trang phát sinh khi hộp thoại đang mở (để không bị lớp phủ che).
// onGui(giaTri) trả Promise; lỗi API hiển thị trong hộp thoại, thành công thì onDong do nơi gọi quyết định.
function HopThoaiBieuMau({ tieuDe, truong, giaTriBanDau = {}, nhanNutGui = 'Lưu', bienTheNut = 'chinh', moTa, loiNgoai, onGui, onDong }) {
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

  const layLuaChon = (luaChon, gt) => (typeof luaChon === 'function' ? luaChon(gt) : luaChon);
  // Đổi một trường có thể làm lựa chọn đang chọn của select phụ thuộc không còn hợp lệ -> xóa lựa chọn đó
  const doi = (ten) => (e) =>
    setGiaTri((cu) => {
      const moi = { ...cu, [ten]: e.target.value };
      for (const t of truong) {
        if (t.kieu === 'select' && typeof t.luaChon === 'function' && moi[t.ten] !== '') {
          if (!t.luaChon(moi).some((lc) => String(lc.giaTri) === String(moi[t.ten]))) moi[t.ten] = '';
        }
      }
      return moi;
    });

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
      {/* Hiện cả lỗi gửi form và lỗi ngoài (nếu khác nhau) để lỗi mới không bị lỗi cũ che */}
      {loi && <div className="thongBao loi">{loi}</div>}
      {loiNgoai && loiNgoai !== loi && <div className="thongBao loi">{loiNgoai}</div>}
      <form id="hopThoaiBieuMau" className="bieuMau" onSubmit={gui}>
        {truong.map(({ ten, nhan, kieu = 'text', luaChon = [], locNhanVien, chapNhan, batBuoc, rongHet, goiY, ghiChu }) => (
          <label key={ten} className={`truongForm ${rongHet || ['textarea', 'nhanVien', 'tep'].includes(kieu) ? 'rongHet' : ''}`}>
            {nhan}
            {batBuoc && ' *'}
            {kieu === 'nhanVien' && <OChonNhanVien value={giaTri[ten]} onChange={doi(ten)} loc={locNhanVien} batBuoc={batBuoc} />}
            {kieu === 'select' && (
              <select value={giaTri[ten]} onChange={doi(ten)} required={batBuoc}>
                <option value="">-- Chọn --</option>
                {layLuaChon(luaChon, giaTri).map((lc) => (
                  <option key={lc.giaTri} value={lc.giaTri}>
                    {lc.nhan}
                  </option>
                ))}
              </select>
            )}
            {kieu === 'textarea' && <textarea value={giaTri[ten]} onChange={doi(ten)} required={batBuoc} placeholder={goiY} />}
            {kieu === 'tep' && (
              <input
                type="file"
                accept={chapNhan}
                required={batBuoc}
                onChange={(e) => setGiaTri((cu) => ({ ...cu, [ten]: e.target.files?.[0] ?? '' }))}
              />
            )}
            {!['select', 'textarea', 'nhanVien', 'tep'].includes(kieu) && (
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
