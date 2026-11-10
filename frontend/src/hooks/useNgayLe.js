import { useEffect, useState } from 'react';
import goiApi from '../services/goiApi';

// Ngày lễ (đã gồm nghỉ bù) theo backend GET /ngayLe — cùng nguồn config THAM_SO_NGAY_LE với cách tính công/ngày nghỉ.
// Lưu đệm theo năm trong phiên trang; lỗi mạng thì coi như không có ngày lễ và trả cờ loi để giao diện báo
// (backend vẫn là nơi tính chuẩn).
const boNhoDem = new Map();
function taiNam(nam) {
  if (!boNhoDem.has(nam)) {
    boNhoDem.set(
      nam,
      goiApi
        .get('/ngayLe', { params: { nam } })
        .then((kq) => kq.data.cacNgay)
        .catch(() => {
          boNhoDem.delete(nam);
          return null;
        }),
    );
  }
  return boNhoDem.get(nam);
}

// cacNam: mảng năm (số); trả { ngayLe: Set 'YYYY-MM-DD', loi: true khi không tải được ngày lễ của năm nào đó }
function useNgayLe(cacNam) {
  const khoa = [...new Set(cacNam.filter(Boolean).map(Number))].sort().join(',');
  const [ketQua, setKetQua] = useState(() => ({ ngayLe: new Set(), loi: false }));
  useEffect(() => {
    let huy = false;
    Promise.all(khoa ? khoa.split(',').map((n) => taiNam(Number(n))) : []).then((ds) => {
      if (!huy) setKetQua({ ngayLe: new Set(ds.filter(Boolean).flat()), loi: ds.some((d) => d === null) });
    });
    return () => {
      huy = true;
    };
  }, [khoa]);
  return ketQua;
}

export default useNgayLe;
