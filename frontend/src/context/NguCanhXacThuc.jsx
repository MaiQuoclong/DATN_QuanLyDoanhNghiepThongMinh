import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import goiApi, { SU_KIEN_CAN_DOI_MAT_KHAU, SU_KIEN_HET_PHIEN } from '../services/goiApi';

const NguCanhXacThuc = createContext(null);

// Giữ thông tin người dùng; token nằm trong cookie httpOnly nên client không lưu.
// Mở trang / F5 thì gọi /xacThuc/toi: còn cookie hợp lệ -> khôi phục phiên, không thì về đăng nhập.
export function NhaCungCapXacThuc({ children }) {
  const [nguoiDung, setNguoiDung] = useState(null);
  const [dangTai, setDangTai] = useState(true);

  const xoaPhien = useCallback(() => setNguoiDung(null), []);

  const taiThongTin = useCallback(
    () => goiApi.get('/xacThuc/toi').then((ketQua) => setNguoiDung(ketQua.data)),
    []
  );

  // Backend xóa cookie và ghi DANG_XUAT; chờ xong mới xóa phiên để Set-Cookie xóa của lần đăng xuất
  // không ghi đè cookie của lần đăng nhập ngay sau đó. Lỗi mạng cũng không chặn đăng xuất ở client.
  const dangXuat = useCallback(async () => {
    await goiApi.post('/xacThuc/dangXuat').catch(() => {});
    xoaPhien();
  }, [xoaPhien]);

  useEffect(() => {
    taiThongTin().catch(xoaPhien).finally(() => setDangTai(false));
  }, [taiThongTin, xoaPhien]);

  // Phiên bị backend từ chối (hết hạn, bị khóa, đổi mật khẩu nơi khác) -> xóa phiên ở client.
  // Bị reset mật khẩu tạm giữa phiên -> tải lại thông tin (batBuocDoiMatKhau = true).
  useEffect(() => {
    const canDoiMatKhau = () => taiThongTin().catch(xoaPhien);
    window.addEventListener(SU_KIEN_HET_PHIEN, xoaPhien);
    window.addEventListener(SU_KIEN_CAN_DOI_MAT_KHAU, canDoiMatKhau);
    return () => {
      window.removeEventListener(SU_KIEN_HET_PHIEN, xoaPhien);
      window.removeEventListener(SU_KIEN_CAN_DOI_MAT_KHAU, canDoiMatKhau);
    };
  }, [taiThongTin, xoaPhien]);

  const dangNhap = async (tenDangNhap, matKhau) => {
    const ketQua = await goiApi.post('/xacThuc/dangNhap', { tenDangNhap, matKhau });
    setNguoiDung(ketQua.data.nguoiDung);
    return ketQua.data.nguoiDung;
  };

  const doiMatKhau = async (matKhauCu, matKhauMoi) => {
    const ketQua = await goiApi.post('/xacThuc/doiMatKhau', { matKhauCu, matKhauMoi });
    setNguoiDung(ketQua.data.nguoiDung);
  };

  return (
    <NguCanhXacThuc.Provider value={{ nguoiDung, dangTai, dangNhap, dangXuat, doiMatKhau }}>
      {children}
    </NguCanhXacThuc.Provider>
  );
}

export function useXacThuc() {
  return useContext(NguCanhXacThuc);
}
