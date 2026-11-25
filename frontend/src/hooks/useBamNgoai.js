import { useEffect } from 'react';

// Đóng popover khi bấm ra ngoài vùng ref hoặc nhấn Esc (chỉ lắng nghe khi đang mở)
export default function useBamNgoai(ref, dangMo, onDong) {
  useEffect(() => {
    if (!dangMo) return undefined;
    const khiBam = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onDong();
    };
    const khiPhim = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onDong();
    };
    document.addEventListener('mousedown', khiBam);
    document.addEventListener('keydown', khiPhim);
    return () => {
      document.removeEventListener('mousedown', khiBam);
      document.removeEventListener('keydown', khiPhim);
    };
  }, [ref, dangMo, onDong]);
}
