import { useCallback, useEffect, useRef, useState } from 'react';

const THOI_GIAN_AN_THANH_CONG = 4000;

// Quản lý thông báo của một trang: thành công tự ẩn sau 4 giây;
// báo lỗi thì xóa thông báo thành công cũ và ngược lại, để không hiện hai loại cùng lúc.
// Truyền chuỗi rỗng để chỉ xóa loại thông báo tương ứng (VD tải lại thành công thì baoLoi('')).
function useThongBao() {
  const [loi, setLoi] = useState('');
  const [thongBao, setThongBao] = useState('');
  const henGio = useRef(null);

  const huyHenGio = () => {
    if (henGio.current) clearTimeout(henGio.current);
    henGio.current = null;
  };

  useEffect(() => huyHenGio, []);

  const baoThanhCong = useCallback((noiDung) => {
    huyHenGio();
    if (!noiDung) {
      setThongBao('');
      return;
    }
    setLoi('');
    setThongBao(noiDung);
    henGio.current = setTimeout(() => setThongBao(''), THOI_GIAN_AN_THANH_CONG);
  }, []);

  const baoLoi = useCallback((noiDung) => {
    if (!noiDung) {
      setLoi('');
      return;
    }
    huyHenGio();
    setThongBao('');
    setLoi(noiDung);
  }, []);

  const xoaThongBao = useCallback(() => {
    huyHenGio();
    setLoi('');
    setThongBao('');
  }, []);

  return { loi, thongBao, baoLoi, baoThanhCong, xoaThongBao };
}

export default useThongBao;
