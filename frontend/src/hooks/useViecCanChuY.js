import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import goiApi from '../services/goiApi';

const CHU_KY_MS = 60000;
const TRE_KHI_DOI_TRANG_MS = 1000;
// visibilitychange và focus thường bắn cùng lúc khi quay lại tab -> bỏ lượt gọi cách lượt trước dưới 2s
const KHOANG_CACH_TOI_THIEU_MS = 2000;

// Chuông "Việc cần chú ý": tải khi mở layout, mỗi 60s (tạm dừng khi tab ẩn), khi quay lại tab và ~1s sau khi đổi trang
// (để số giảm ngay sau khi duyệt xong). Lỗi mạng: giữ số cũ, bật cờ loi.
export default function useViecCanChuY(pathname) {
  const [duLieu, setDuLieu] = useState({ tongSo: 0, items: [], nguonLoi: [], theoLoai: null, vuotTran: [] });
  const [loi, setLoi] = useState(false);
  const lanGoi = useRef(0);
  const thoiDiemGoi = useRef(0);

  const tai = useCallback(() => {
    const lan = ++lanGoi.current;
    thoiDiemGoi.current = Date.now();
    goiApi
      .get('/viecCanChuY')
      .then((kq) => {
        if (lan !== lanGoi.current) return; // bỏ phản hồi cũ đến muộn
        setDuLieu(kq.data);
        setLoi(false);
      })
      .catch(() => {
        if (lan === lanGoi.current) setLoi(true);
      });
  }, []);

  useEffect(() => {
    const hen = setInterval(() => {
      if (!document.hidden) tai();
    }, CHU_KY_MS);
    const khiHien = () => {
      if (!document.hidden && Date.now() - thoiDiemGoi.current >= KHOANG_CACH_TOI_THIEU_MS) tai();
    };
    document.addEventListener('visibilitychange', khiHien);
    window.addEventListener('focus', khiHien);
    return () => {
      clearInterval(hen);
      document.removeEventListener('visibilitychange', khiHien);
      window.removeEventListener('focus', khiHien);
    };
  }, [tai]);

  // Lần đầu + mỗi lần đổi trang
  useEffect(() => {
    const hen = setTimeout(tai, lanGoi.current === 0 ? 0 : TRE_KHI_DOI_TRANG_MS);
    return () => clearTimeout(hen);
  }, [pathname, tai]);

  // Giữ tham chiếu ổn định: giá trị này đi vào context, tránh render lại mọi trang con khi layout render
  return useMemo(() => ({ ...duLieu, loi, taiLai: tai }), [duLieu, loi, tai]);
}
