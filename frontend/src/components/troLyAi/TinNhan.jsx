import { Bot, User } from 'lucide-react';
import TheTrichDan from './TheTrichDan';
import TheXemTruocDon from './TheXemTruocDon';
import { dinhDangThoiGian } from '../../utils/dinhDang';

const GHI_CHU_CHE_DO = {
  DU_PHONG: 'Chế độ dự phòng: trích nguyên văn quy chế liên quan (AI tạm thời không tạo được câu trả lời).',
  KHONG_TIM_THAY: 'Không có đoạn quy chế nào đủ liên quan.',
};

// Tách "[n]" trong câu trả lời thành nhãn số nhỏ khớp với thẻ trích dẫn bên dưới
function NoiDungCoTrichDan({ vanBan }) {
  return vanBan.split(/(\[\d{1,2}\])/g).map((phan, i) => {
    const khop = /^\[(\d{1,2})\]$/.exec(phan);
    // Văn bản tĩnh không đổi thứ tự: khóa theo vị trí là ổn định
    const khoa = `${i}-${phan.length}`;
    return khop ? (
      <sup key={khoa} className="kyHieuTrichDan">
        {khop[1]}
      </sup>
    ) : (
      <span key={khoa}>{phan}</span>
    );
  });
}

function TinNhan({ tinNhan, onXacNhanBanNhap, onHuyBanNhap }) {
  const laTroLy = tinNhan.vaiTro === 'troLy';
  const nguon = tinNhan.nguonTrichDan ?? [];
  return (
    <div className={`dongTinNhan ${laTroLy ? 'troLy' : 'nguoiDung'}`}>
      <div className="anhDaiDienChat">{laTroLy ? <Bot size={16} /> : <User size={16} />}</div>
      <div className="bongTinNhan">
        <div className="noiDungTinNhan">{laTroLy ? <NoiDungCoTrichDan vanBan={tinNhan.noiDung} /> : tinNhan.noiDung}</div>
        {laTroLy && GHI_CHU_CHE_DO[tinNhan.cheDo] && <div className="ghiChuCheDo">{GHI_CHU_CHE_DO[tinNhan.cheDo]}</div>}
        {laTroLy && tinNhan.banNhap && <TheXemTruocDon banNhap={tinNhan.banNhap} onXacNhan={onXacNhanBanNhap} onHuy={onHuyBanNhap} />}
        {nguon.length > 0 && (
          <div className="dsTrichDan">
            <div className="nhanTrichDan">Nguồn trích dẫn</div>
            {nguon.map((n) => (
              <TheTrichDan key={`${n.taiLieuId}-${n.soThuTu}`} nguon={n} />
            ))}
          </div>
        )}
        {tinNhan.thoiGian && <div className="thoiGianTinNhan">{dinhDangThoiGian(tinNhan.thoiGian)}</div>}
      </div>
    </div>
  );
}

export default TinNhan;
