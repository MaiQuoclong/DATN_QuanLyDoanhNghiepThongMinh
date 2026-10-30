import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import goiApi, { KHOA_TOKEN, SU_KIEN_HET_PHIEN } from '../services/goiApi';

const NguCanhXacThuc = createContext(null);

// Giữ token + thông tin người dùng; F5 thì gọi lại /xacThuc/toi để khôi phục phiên
export function NhaCungCapXacThuc({ children }) {
  const [nguoiDung, setNguoiDung] = useState(null);
  const [dangTai, setDangTai] = useState(() => Boolean(localStorage.getItem(KHOA_TOKEN)));

  const xoaPhien = useCallback(() => {
    localStorage.removeItem(KHOA_TOKEN);
    setNguoiDung(null);
  }, []);

  // Báo backend ghi DANG_XUAT; lỗi mạng cũng không chặn việc đăng xuất ở client
  const dangXuat = useCallback(() => {
    // Gắn token tại đây vì interceptor chạy sau khi xoaPhien đã xóa localStorage
    const token = localStorage.getItem(KHOA_TOKEN);
    if (token) {
      goiApi.post('/xacThuc/dangXuat', null, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    xoaPhien();
  }, [xoaPhien]);

  const luuPhien = useCallback(({ token, nguoiDung: thongTin }) => {
    localStorage.setItem(KHOA_TOKEN, token);
    setNguoiDung(thongTin);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(KHOA_TOKEN)) return;
    goiApi
      .get('/xacThuc/toi')
      .then((ketQua) => setNguoiDung(ketQua.data))
      .catch(xoaPhien)
      .finally(() => setDangTai(false));
  }, [xoaPhien]);

  // Token bị backend từ chối (hết hạn, bị khóa, đổi mật khẩu nơi khác) -> chỉ xóa phiên ở client
  useEffect(() => {
    window.addEventListener(SU_KIEN_HET_PHIEN, xoaPhien);
    return () => window.removeEventListener(SU_KIEN_HET_PHIEN, xoaPhien);
  }, [xoaPhien]);

  const dangNhap = async (tenDangNhap, matKhau) => {
    const ketQua = await goiApi.post('/xacThuc/dangNhap', { tenDangNhap, matKhau });
    luuPhien(ketQua.data);
    return ketQua.data.nguoiDung;
  };

  const doiMatKhau = async (matKhauCu, matKhauMoi) => {
    const ketQua = await goiApi.post('/xacThuc/doiMatKhau', { matKhauCu, matKhauMoi });
    luuPhien(ketQua.data);
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
