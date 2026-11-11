import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const MAU = ['#1f5f57', '#f5c518', '#ea8a0c', '#16a34a', '#6b7280', '#dc2626'];

// Biểu đồ theo gợi ý của ai-service: bieuDo = { loai: COT | DUONG | TRON | BANG, x, y[] }
function BieuDoKetQua({ bieuDo, cot, dong }) {
  if (!bieuDo || bieuDo.loai === 'BANG' || !bieuDo.x || !bieuDo.y?.length) return null;
  const viTri = Object.fromEntries(cot.map((c, i) => [c.ten, i]));
  if (viTri[bieuDo.x] === undefined || bieuDo.y.some((y) => viTri[y] === undefined)) return null;
  const duLieu = dong.map((d) => ({
    [bieuDo.x]: d[viTri[bieuDo.x]] ?? '(trống)',
    ...Object.fromEntries(bieuDo.y.map((y) => [y, Number(d[viTri[y]]) || 0])),
  }));

  let noiDung;
  if (bieuDo.loai === 'TRON') {
    const y = bieuDo.y[0];
    noiDung = (
      <PieChart>
        <Pie data={duLieu} dataKey={y} nameKey={bieuDo.x} outerRadius={110} label>
          {duLieu.map((_, i) => (
            <Cell key={i} fill={MAU[i % MAU.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    );
  } else {
    const BieuDo = bieuDo.loai === 'DUONG' ? LineChart : BarChart;
    noiDung = (
      <BieuDo data={duLieu}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={bieuDo.x} />
        <YAxis />
        <Tooltip />
        <Legend />
        {bieuDo.y.map((y, i) =>
          bieuDo.loai === 'DUONG' ? (
            <Line key={y} type="monotone" dataKey={y} stroke={MAU[i % MAU.length]} strokeWidth={2} />
          ) : (
            <Bar key={y} dataKey={y} fill={MAU[i % MAU.length]} />
          ),
        )}
      </BieuDo>
    );
  }

  return (
    <div className="the" style={{ padding: 16, marginBottom: 16 }}>
      <ResponsiveContainer width="100%" height={300}>
        {noiDung}
      </ResponsiveContainer>
    </div>
  );
}

export default BieuDoKetQua;
