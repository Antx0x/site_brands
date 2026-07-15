// site/src/Grafic.jsx — grafic simplu de preț (SVG, fără librării)

export default function Grafic({ istoric }) {
  const puncte = (istoric || []).filter((p) => p.pret != null);
  if (puncte.length < 2) return null;

  const preturi = puncte.map((p) => p.pret);
  const min = Math.min(...preturi);
  const max = Math.max(...preturi);
  const W = 600, H = 170, P = 10;

  const x = (i) => P + (i * (W - 2 * P)) / (puncte.length - 1);
  const y = (v) => H - P - ((v - min) * (H - 2 * P)) / (max - min || 1);

  const linie = preturi.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const crestere = preturi[preturi.length - 1] >= preturi[0];
  const culoare = crestere ? '#059669' : '#dc2626';

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* umbra de sub linie */}
        <polygon
          points={`${P},${H - P} ${linie} ${W - P},${H - P}`}
          fill={culoare}
          opacity="0.08"
        />
        <polyline points={linie} fill="none" stroke={culoare} strokeWidth="2.5" />
      </svg>
      <div className="flex justify-between text-xs text-slate-400 px-1">
        <span>{puncte[0].data}</span>
        <span>
          min {min} · max {max}
        </span>
        <span>{puncte[puncte.length - 1].data}</span>
      </div>
    </div>
  );
}