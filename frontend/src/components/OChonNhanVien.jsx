import { useEffect, useState } from 'react';
import goiApi from '../services/goiApi';

const SO_KET_QUA = 50;

// Chọn nhân viên bằng tìm kiếm (tên/mã) qua GET /nhanVien, không tải sẵn cả danh sách.
// loc: { phongBanId?, trangThai?: [...trangThaiLamViec], boQuaIds?: [...id] } - lọc ở server (giao diện kiểm tra lại).
function OChonNhanVien({ value, onChange, loc = {}, batBuoc }) {
  const [tuKhoa, setTuKhoa] = useState('');
  const [luaChon, setLuaChon] = useState([]);
  const [daTai, setDaTai] = useState(false); // đã có kết quả tìm kiếm đầu tiên
  const [loi, setLoi] = useState('');
  const { phongBanId, trangThai, boQuaIds } = loc;
  const khoaLoc = JSON.stringify([phongBanId, trangThai, boQuaIds]);

  useEffect(() => {
    let huy = false;
    const hen = setTimeout(async () => {
      try {
        // Lọc trạng thái ở server (nhiều trạng thái cách nhau bởi dấu phẩy) để 50 kết quả đều hợp lệ
        const kq = await goiApi.get('/nhanVien', {
          params: {
            tuKhoa: tuKhoa.trim() || undefined,
            phongBanId,
            trangThaiLamViec: trangThai?.length ? trangThai.join(',') : undefined,
            boQuaIds: boQuaIds?.length ? boQuaIds.join(',') : undefined,
            kichThuoc: SO_KET_QUA,
          },
        });
        if (huy) return;
        setLoi('');
        setDaTai(true);
        setLuaChon(
          kq.data.items.filter(
            (nv) =>
              (!phongBanId || Number(nv.phongBanId) === Number(phongBanId)) &&
              (!trangThai || trangThai.includes(nv.trangThaiLamViec)) &&
              !(boQuaIds ?? []).includes(nv.id),
          ),
        );
      } catch (e) {
        if (!huy) setLoi(e.message);
      }
    }, 300);
    return () => {
      huy = true;
      clearTimeout(hen);
    };
    // Chỉ tìm lại theo khoaLoc (chuỗi ổn định) thay vì object bộ lọc mới mỗi lần render -> tránh gọi API liên tục
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuKhoa, khoaLoc]);

  // Người đã chọn không còn trong kết quả tìm mới -> bỏ chọn, tránh gửi id không thấy trên màn hình
  useEffect(() => {
    if (daTai && value && !luaChon.some((nv) => String(nv.id) === String(value))) onChange({ target: { value: '' } });
    // Chỉ chạy khi kết quả tìm đổi; value/onChange không phải tác nhân (onChange của cha đổi mỗi lần render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [luaChon]);

  return (
    <>
      <input type="search" value={tuKhoa} onChange={(e) => setTuKhoa(e.target.value)} placeholder="Gõ tên hoặc mã nhân viên để tìm" />
      <select value={value} onChange={onChange} required={batBuoc}>
        <option value="">{luaChon.length ? '-- Chọn nhân viên --' : 'Không có nhân viên phù hợp'}</option>
        {luaChon.map((nv) => (
          <option key={nv.id} value={nv.id}>
            {`${nv.hoVaTen} (${nv.maNhanVien}) - ${nv.tenChucDanh ?? ''} - ${nv.tenPhongBan ?? ''}`}
          </option>
        ))}
      </select>
      {loi && <small className="chuPhu">{loi}</small>}
    </>
  );
}

export default OChonNhanVien;
