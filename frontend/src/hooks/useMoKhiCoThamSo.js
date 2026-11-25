import { useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

// Menu "Tạo nhanh" điều hướng tới trang kèm ?tao=1: mở hộp thoại tạo mới rồi xóa tham số (không mở lại khi F5/Back).
// location.state (vd. { mauDon } từ Trợ lý AI) được truyền cho moHopThoai để điền sẵn form.
// choPhep = false (vai trò không có nút tạo trên trang): chỉ xóa tham số, không mở.
export default function useMoKhiCoThamSo(moHopThoai, choPhep = true) {
  const [thamSo, setThamSo] = useSearchParams();
  const canMo = thamSo.get('tao') === '1';
  // Mỗi lần điều hướng (location.key) chỉ mở một lần: StrictMode chạy effect 2 lần trước khi tham số bị xóa
  const { key, state } = useLocation();
  const daMoTai = useRef(null);

  useEffect(() => {
    if (!canMo || daMoTai.current === key) return;
    daMoTai.current = key;
    setThamSo(
      (cu) => {
        const moi = new URLSearchParams(cu);
        moi.delete('tao');
        return moi;
      },
      { replace: true },
    );
    if (choPhep) moHopThoai(state ?? null);
  }, [canMo, key, state, choPhep, moHopThoai, setThamSo]);
}
