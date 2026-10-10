import { useMemo } from 'react';
import { PALETTE } from './GraphCanvas.jsx';

// Lays the block-cut forest out left→right, one connected piece stacked under another.
function layout(bct) {
  const nodes = [
    ...bct.blocks.map((vs, i) => ({ id: `b${i}`, type: 'block', i, label: `B${i + 1}`, sub: `{${vs.join(',')}}` })),
    ...bct.cuts.map((v) => ({ id: `c${v}`, type: 'cut', v, label: String(v) })),
  ];
  const adj = new Map(nodes.map((n) => [n.id, []]));
  bct.links.forEach(([bi, v]) => {
    adj.get(`b${bi}`).push(`c${v}`);
    adj.get(`c${v}`).push(`b${bi}`);
  });
  const placed = new Map();
  let baseY = 0;
  const seen = new Set();
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    const levels = [];
    const q = [[n.id, 0]];
    seen.add(n.id);
    while (q.length) {
      const [id, d] = q.shift();
      (levels[d] = levels[d] || []).push(id);
      for (const nb of adj.get(id)) if (!seen.has(nb)) { seen.add(nb); q.push([nb, d + 1]); }
    }
    const tall = Math.max(...levels.map((l) => l.length));
    levels.forEach((l, d) => l.forEach((id, k) => placed.set(id, { x: 70 + d * 150, y: baseY + 40 + (k + (tall - l.length) / 2) * 72 })));
    baseY += tall * 72 + 12;
  }
  const maxX = Math.max(260, ...[...placed.values()].map((p) => p.x + 80));
  return { nodes, placed, w: maxX, h: Math.max(110, baseY + 20) };
}

export default function BlockCutTree({ bct, mini = false }) {
  const L = useMemo(() => layout(bct), [bct]);
  if (!bct.blocks.length) {
    return <div className="empty">No blocks yet — blocks appear here as the edge stack pops.</div>;
  }
  return (
    <svg viewBox={`0 0 ${L.w} ${L.h}`} className="bct" style={{ maxHeight: mini ? 260 : 360 }} role="img" aria-label="Block-cut tree">
      {bct.links.map(([bi, v], k) => {
        const a = L.placed.get(`b${bi}`);
        const b = L.placed.get(`c${v}`);
        return <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--edge)" strokeWidth="2.5" />;
      })}
      {L.nodes.map((n) => {
        const p = L.placed.get(n.id);
        if (n.type === 'block') {
          return (
            <g key={n.id} transform={`translate(${p.x} ${p.y})`}>
              <rect x="-46" y="-26" width="92" height="52" rx="10" fill={PALETTE[n.i % PALETTE.length]} />
              <text textAnchor="middle" y="-3" fontWeight="800" fontSize="14" fill="#0b1418">{n.label}</text>
              <text textAnchor="middle" y="14" fontSize="11" fontFamily="var(--mono)" fill="#0b1418">{n.sub.length > 14 ? `${n.sub.slice(0, 13)}…}` : n.sub}</text>
            </g>
          );
        }
        return (
          <g key={n.id} transform={`translate(${p.x} ${p.y})`}>
            <circle r="19" fill="none" stroke="var(--red)" strokeWidth="3" strokeDasharray="4 4" />
            <circle r="15" fill="var(--panel2)" stroke="var(--text)" strokeWidth="1.5" />
            <text textAnchor="middle" dy="0.35em" fontWeight="800" fontSize="14" fill="var(--text)">{n.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
