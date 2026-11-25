import { createContext, useContext } from 'react';

const NguCanhViecCanChuY = createContext(null);

// Một nguồn số liệu "Việc cần chú ý" cho cả chuông và trang Tổng quan (BoCucChinh giữ một hook useViecCanChuY)
// -> chỉ một request /viecCanChuY, số trên thẻ và chuông luôn khớp.
export function NhaCungCapViecCanChuY({ giaTri, children }) {
  return <NguCanhViecCanChuY.Provider value={giaTri}>{children}</NguCanhViecCanChuY.Provider>;
}

export function useViecCanChuYChung() {
  return useContext(NguCanhViecCanChuY);
}
