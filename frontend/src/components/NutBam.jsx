import './NutBam.css';

// Nút bấm chung. bienThe: 'chinh' | 'phu' | 'vang' | 'ma'; bieuTuong: component lucide-react
function NutBam({ bienThe = 'chinh', bieuTuong: BieuTuong, children, className = '', ...thuocTinh }) {
  return (
    <button className={`nutBam ${bienThe} ${className}`} {...thuocTinh}>
      {BieuTuong && <BieuTuong size={16} />}
      {children}
    </button>
  );
}

export default NutBam;
