import './TheThongKe.css';

// Metrics card ở đầu trang. trangThai: 'thanhCong' | 'canhBao' | 'loi' | undefined
function TheThongKe({ tieuDe, giaTri, moTa, trangThai }) {
  return (
    <div className={`theThongKe ${trangThai ?? ''}`}>
      <div className="theTieuDe">{tieuDe}</div>
      <div className="theGiaTri">{giaTri}</div>
      {moTa && <div className="theMoTa">{moTa}</div>}
    </div>
  );
}

export default TheThongKe;
