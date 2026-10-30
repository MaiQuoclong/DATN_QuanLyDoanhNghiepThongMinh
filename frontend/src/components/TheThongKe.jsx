import './TheThongKe.css';

// Thẻ số liệu: nhãn nhỏ, số lớn, dòng so sánh. trangThai: 'thanhCong' | 'canhBao' | 'loi' | undefined
function TheThongKe({ tieuDe, giaTri, moTa, trangThai }) {
  return (
    <div className="theThongKe the">
      <div className="theTieuDe">{tieuDe}</div>
      <div className="theGiaTri">{giaTri}</div>
      {moTa && <div className={`theMoTa ${trangThai ?? ''}`}>{moTa}</div>}
    </div>
  );
}

export default TheThongKe;
