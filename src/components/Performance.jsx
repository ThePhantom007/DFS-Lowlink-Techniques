import { useEffect, useRef, useState } from 'react';
import { runBench } from '../engine/bench.js';

const SIZES = [25, 50, 100, 200, 400, 800, 1600];
const SIZES_BIG = [...SIZES, 3200];

const fmt = (x) => (x >= 100 ? Math.round(x).toLocaleString() : x >= 10 ? x.toFixed(1) : x >= 1 ? x.toFixed(2) : x >= 0.01 ? x.toFixed(3) : x.toExponential(1));
const fmtMs = (x) => (x >= 1000 ? `${(x / 1000).toFixed(2)} s` : `${fmt(x)} ms`);

// Two-series log-log line chart in plain SVG: hover for exact values, direct labels at the line ends, table view below.
function Chart({ rows, metric, sizes }) {
  const [hover, setHover] = useState(null);
  const W = 760;
  const H = 360;
  const M = { l: 70, r: 120, t: 18, b: 52 };
  const key = metric === 'ms' ? ['fastMs', 'bruteMs'] : ['fastOps', 'bruteOps'];
  const vals = rows.flatMap((r) => [r[key[0]], r[key[1]]]);
  const xs = sizes;
  const x0 = Math.log10(xs[0]);
  const x1 = Math.log10(xs[xs.length - 1]);
  const lo = Math.floor(Math.log10(Math.min(...vals, 1)));
  const hi = Math.ceil(Math.log10(Math.max(...vals, 10)));
  const X = (n) => M.l + ((Math.log10(n) - x0) / (x1 - x0)) * (W - M.l - M.r);
  const Y = (v) => M.t + (1 - (Math.log10(Math.max(v, 1e-6)) - lo) / (hi - lo)) * (H - M.t - M.b);
  const ticks = [];
  for (let k = lo; k <= hi; k++) ticks.push(k);
  const path = (i) => rows.map((r, j) => `${j ? 'L' : 'M'}${X(r.n)} ${Y(r[key[i]])}`).join('');
  const series = [
    { name: 'One pass (low-link)', color: 'var(--accent)', i: 0 },
    { name: 'Brute force', color: 'var(--orange)', i: 1 },
  ];
  const unit = metric === 'ms' ? 'ms' : 'operations';
  const h = hover !== null ? rows[hover] : null;

  return (
    <div className="chartbox">
      <div className="chartlegend" aria-hidden="false">
        {series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Log-log chart of ${unit} against number of vertices for the one-pass algorithm and brute force`} onMouseLeave={() => setHover(null)}>
        {ticks.map((k) => (
          <g key={k}>
            <line x1={M.l} x2={W - M.r} y1={Y(10 ** k)} y2={Y(10 ** k)} stroke="var(--line)" strokeWidth="1" />
            <text x={M.l - 8} y={Y(10 ** k) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" fontFamily="var(--mono)">{k >= 0 && k < 4 ? 10 ** k : k < 0 ? `1e${k}` : `1e${k}`}</text>
          </g>
        ))}
        {xs.map((n) => (
          <g key={n}>
            <line x1={X(n)} x2={X(n)} y1={H - M.b} y2={H - M.b + 4} stroke="var(--muted)" />
            <text x={X(n)} y={H - M.b + 18} textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="var(--mono)">{n}</text>
          </g>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 10} textAnchor="middle" fontSize="12" fill="var(--muted)">vertices n (edges ≈ 2n)</text>
        <text transform={`translate(16 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill="var(--muted)">{unit} (log scale)</text>

        {series.map((s) => (
          <g key={s.name}>
            <path d={path(s.i)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {rows.map((r) => <circle key={r.n} cx={X(r.n)} cy={Y(r[key[s.i]])} r="4.5" fill={s.color} stroke="var(--panel)" strokeWidth="2" />)}
            {rows.length > 0 && (
              <text x={X(rows[rows.length - 1].n) + 10} y={Y(rows[rows.length - 1][key[s.i]]) + 4} fontSize="12" fill="var(--text)" fontWeight="600">{s.name}</text>
            )}
          </g>
        ))}

        {h && (
          <g style={{ pointerEvents: 'none' }}>
            <line x1={X(h.n)} x2={X(h.n)} y1={M.t} y2={H - M.b} stroke="var(--text)" strokeOpacity="0.35" strokeDasharray="3 4" />
            <g transform={`translate(${Math.min(X(h.n) + 12, W - M.r - 150)} ${M.t + 6})`}>
              <rect width="196" height="78" rx="8" fill="var(--panel2)" stroke="var(--line)" />
              <text x="10" y="18" fontSize="12" fontWeight="700" fill="var(--text)">n = {h.n}, E = {h.e}</text>
              <text x="10" y="36" fontSize="12" fill="var(--text)">one pass: {metric === 'ms' ? fmtMs(h.fastMs) : `${h.fastOps.toLocaleString()} ops`}</text>
              <text x="10" y="53" fontSize="12" fill="var(--text)">brute force: {metric === 'ms' ? fmtMs(h.bruteMs) : `${h.bruteOps.toLocaleString()} ops`}</text>
              <text x="10" y="70" fontSize="12" fontWeight="700" fill="var(--text)">{fmt(metric === 'ms' ? h.speedup : h.bruteOps / h.fastOps)}× faster</text>
            </g>
          </g>
        )}
        {rows.map((r, j) => (
          <rect key={r.n} x={X(r.n) - 22} y={M.t} width="44" height={H - M.t - M.b} fill="transparent" onMouseEnter={() => setHover(j)} onFocus={() => setHover(j)} tabIndex={0} aria-label={`n = ${r.n}`} />
        ))}
      </svg>
    </div>
  );
}

export default function Performance() {
  const [rows, setRows] = useState([]);
  const [running, setRunning] = useState(false);
  const [big, setBig] = useState(false);
  const [metric, setMetric] = useState('ms');
  const [ranBig, setRanBig] = useState(false); // which size list the rows on screen came from
  const sizes = ranBig ? SIZES_BIG : SIZES;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const run = async () => {
    setRunning(true);
    setRows([]);
    setRanBig(big);
    await runBench(big ? SIZES_BIG : SIZES, (_, all) => alive.current && setRows([...all]));
    if (alive.current) setRunning(false);
  };

  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  return (
    <div className="perf">
      <div className="card intro">
        <h2>Why the one-pass algorithm matters</h2>
        <p>
          To find the articulation points of a graph you could delete each vertex in turn and recount the connected components: that costs <b>O(V · (V + E))</b>. The low-link DFS answers the same question in one pass, <b>O(V + E)</b>. This page runs both on random connected graphs in your browser and checks that they give identical answers.
        </p>
        <div className="toolbar">
          <button className="primary" onClick={run} disabled={running}>{running ? 'Running…' : rows.length ? 'Run again' : 'Run the benchmark'}</button>
          <label className="inl check"><input type="checkbox" checked={big} onChange={(e) => setBig(e.target.checked)} disabled={running} /> include n = 3200 (brute force takes a few seconds)</label>
          <div className="seg" role="group" aria-label="Metric">
            <button className={metric === 'ms' ? 'on' : ''} onClick={() => setMetric('ms')}>Runtime</button>
            <button className={metric === 'ops' ? 'on' : ''} onClick={() => setMetric('ops')}>Operations</button>
          </div>
        </div>
        <p className="muted small">Runtime depends on your machine and browser; the operation counts are exact and machine independent (they count every edge and vertex touched). Both axes are logarithmic, so a straight line of slope 1 is linear growth and slope 2 is quadratic.</p>
      </div>

      {rows.length === 0 ? (
        <div className="card empty">Press “Run the benchmark”. It takes about a second.</div>
      ) : (
        <div className="card">
          <div className="cardh">{metric === 'ms' ? 'Runtime' : 'Operations'}: one pass against brute force</div>
          <Chart rows={rows} metric={metric} sizes={sizes} />
          {last && (
            <p className="takeaway">
              At n = {last.n} the one-pass algorithm is <b>{fmt(last.speedup)}× faster</b> ({fmtMs(last.fastMs)} against {fmtMs(last.bruteMs)}), and it did {last.fastOps.toLocaleString()} operations against {last.bruteOps.toLocaleString()}.
              {prev && <> Doubling n multiplied the one-pass work by <b>{(last.fastOps / prev.fastOps).toFixed(2)}</b> and the brute-force work by <b>{(last.bruteOps / prev.bruteOps).toFixed(2)}</b> (≈ 2 means linear, ≈ 4 means quadratic).</>}
            </p>
          )}
          <details open>
            <summary>Table view</summary>
            <div className="tablewrap">
              <table className="cmp">
                <thead><tr><th>n</th><th>E</th><th>one pass</th><th>brute force</th><th>speed-up</th><th>one-pass ops</th><th>brute-force ops</th><th>same answer</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.n}>
                      <td>{r.n}</td><td>{r.e}</td><td>{fmtMs(r.fastMs)}</td><td>{fmtMs(r.bruteMs)}</td><td><b>{fmt(r.speedup)}×</b></td>
                      <td>{r.fastOps.toLocaleString()}</td><td>{r.bruteOps.toLocaleString()}</td><td>{r.same ? '✓' : '✗'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
