import { useRef, useState, useMemo } from 'react';
import { W, H, MAX_N } from '../engine/graphs.js';

export const PALETTE = ['#4f83ff', '#f59e0b', '#a78bfa', '#22d3ee', '#fb7185', '#818cf8', '#f472b6', '#facc15', '#38bdf8', '#c084fc', '#fb923c', '#34d399'];
const R = 20;

const MARKERS = {
  gray: 'var(--edge)',
  tree: 'var(--accent)',
  back: 'var(--violet)',
  forward: 'var(--pink)',
  cross: 'var(--orange)',
  hl: 'var(--amber)',
};

const KIND_STYLE = {
  tree: { stroke: 'var(--accent)', width: 3.5, dash: null, marker: 'tree' },
  back: { stroke: 'var(--violet)', width: 3, dash: '7 5', marker: 'back' },
  forward: { stroke: 'var(--pink)', width: 3, dash: '2 5', marker: 'forward' },
  cross: { stroke: 'var(--orange)', width: 3, dash: '7 5', marker: 'cross' },
  bridge: { stroke: 'var(--red)', width: 5.5, dash: null, marker: 'gray' },
};

function geometry(graph, directed) {
  const { edges, pos } = graph;
  const groups = {};
  edges.forEach(([a, b], i) => {
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    (groups[k] = groups[k] || []).push(i);
  });
  return edges.map(([a, b], i) => {
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    const g = groups[k];
    const off = (g.indexOf(i) - (g.length - 1) / 2) * 62;
    const A = pos[a];
    const B = pos[b];
    const lo = a < b ? A : B;
    const hi = a < b ? B : A;
    const dx = hi.x - lo.x;
    const dy = hi.y - lo.y;
    const len = Math.hypot(dx, dy) || 1;
    const cx = (A.x + B.x) / 2 + (-dy / len) * off;
    const cy = (A.y + B.y) / 2 + (dx / len) * off;
    const d1x = cx - A.x, d1y = cy - A.y, l1 = Math.hypot(d1x, d1y) || 1;
    const d2x = cx - B.x, d2y = cy - B.y, l2 = Math.hypot(d2x, d2y) || 1;
    const g2 = R + (directed ? 6 : 0);
    return {
      d: `M${A.x + (d1x / l1) * R} ${A.y + (d1y / l1) * R} Q${cx} ${cy} ${B.x + (d2x / l2) * g2} ${B.y + (d2y / l2) * g2}`,
    };
  });
}

function edgeStyle(i, step, mode) {
  const base = { stroke: 'var(--edge)', width: 2.5, dash: null, marker: 'gray' };
  if (!step) return base;
  if (step.hl === i) return { stroke: 'var(--amber)', width: 5.5, dash: null, marker: 'hl' };
  if (mode === 'bcc' && step.blockOfEdge[i] >= 0) return { stroke: PALETTE[step.blockOfEdge[i] % PALETTE.length], width: 5.5, dash: null, marker: 'gray' };
  const k = step.edgeKind[i];
  return k ? KIND_STYLE[k] : base;
}

// Rounded convex outline around a set of vertices: hull of circles of radius `pad` around each one.
function hullPath(pts, pad) {
  const all = [];
  pts.forEach((p) => {
    for (let k = 0; k < 24; k++) {
      const a = (2 * Math.PI * k) / 24;
      all.push([p.x + Math.cos(a) * pad, p.y + Math.sin(a) * pad]);
    }
  });
  all.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of all) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = all.length - 1; i >= 0; i--) {
    const p = all[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  return `M${hull.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}Z`;
}

export default function GraphCanvas({
  graph,
  directed = false,
  step = null,
  mode = 'ap',
  tool = 'none', // none | move | addv | adde | del | pick
  onChange,
  labelMode = 'both', // both | disc | none
  vOverride,
  eOverride,
  onClickV,
  onClickE,
  pending: pendingProp,
  onPending,
}) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [pendingLocal, setPendingLocal] = useState(null);
  const pending = pendingProp !== undefined ? pendingProp : pendingLocal;
  const setPending = onPending || setPendingLocal;
  const geo = useMemo(() => geometry(graph, directed), [graph, directed]);

  // dotted outlines around every finished block (BCC) or strongly connected component (SCC)
  const outlines = useMemo(() => {
    if (!step || (mode !== 'bcc' && mode !== 'scc')) return [];
    const groups = mode === 'bcc' ? step.blocks.map((b) => [...new Set(b.flatMap((e) => graph.edges[e] || []))]) : step.sccs;
    return groups.map((vs, i) => ({ i, d: hullPath(vs.map((v) => graph.pos[v]).filter(Boolean), R + 11) }));
  }, [step, mode, graph]);

  const toSvg = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: Math.max(30, Math.min(W - 30, p.x)), y: Math.max(40, Math.min(H - 30, p.y)) };
  };

  const onMove = (e) => {
    if (dragRef.current === null || !onChange) return;
    const p = toSvg(e);
    const pos = graph.pos.map((q, i) => (i === dragRef.current ? { x: Math.round(p.x), y: Math.round(p.y) } : q));
    onChange({ ...graph, pos });
  };

  const onBgDown = (e) => {
    if (e.target.closest?.('[data-v]')) return; // presses on a vertex belong to the vertex, not the canvas
    if (tool === 'addv' && onChange && graph.n < MAX_N) {
      const p = toSvg(e);
      onChange({ ...graph, n: graph.n + 1, pos: [...graph.pos, { x: Math.round(p.x), y: Math.round(p.y) }] });
    }
    if (tool === 'adde') setPending(null);
  };

  const removeVertex = (v) => {
    const map = (i) => (i > v ? i - 1 : i);
    onChange({
      n: graph.n - 1,
      pos: graph.pos.filter((_, i) => i !== v),
      edges: graph.edges.filter(([a, b]) => a !== v && b !== v).map(([a, b]) => [map(a), map(b)]),
    });
  };

  const clickVertex = (v, e) => {
    e.stopPropagation();
    if (tool === 'adde' && onChange) {
      if (pending === null) return setPending(v);
      if (pending !== v) {
        const exists = graph.edges.some(([a, b]) => (a === pending && b === v) || (!directed && a === v && b === pending));
        if (!exists) onChange({ ...graph, edges: [...graph.edges, [pending, v]] });
      }
      setPending(null);
    } else if (tool === 'del' && onChange) {
      removeVertex(v);
    } else if (tool === 'pick' && onClickV) {
      onClickV(v);
    }
  };

  const clickEdge = (i, e) => {
    e.stopPropagation();
    if (tool === 'del' && onChange) onChange({ ...graph, edges: graph.edges.filter((_, j) => j !== i) });
    else if (tool === 'pick' && onClickE) onClickE(i);
  };

  const vertexFill = (v) => {
    if (step && mode === 'scc' && step.sccOf[v] >= 0) return PALETTE[step.sccOf[v] % PALETTE.length];
    if (!step || step.vstate[v] === 0) return 'var(--node)';
    return step.vstate[v] === 1 ? 'var(--amber)' : 'var(--accent)';
  };

  const edgeTools = tool === 'del' || tool === 'pick';
  const cursor = tool === 'addv' ? 'copy' : tool === 'del' ? 'not-allowed' : 'default';

  return (
    <svg
      ref={svgRef}
      className="canvas"
      viewBox={`0 0 ${W} ${H}`}
      onPointerMove={onMove}
      onPointerUp={() => (dragRef.current = null)}
      onPointerLeave={() => (dragRef.current = null)}
      onPointerDown={onBgDown}
      style={{ cursor }}
      role="img"
      aria-label="Graph visualisation"
    >
      <defs>
        {Object.entries(MARKERS).map(([k, c]) => (
          <marker key={k} id={`arr-${k}`} viewBox="0 0 10 10" refX="10" refY="5" markerUnits="userSpaceOnUse" markerWidth="13" markerHeight="13" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill={c} />
          </marker>
        ))}
      </defs>

      {outlines.map((o) => (
        <path
          key={`o${o.i}`}
          d={o.d}
          fill={PALETTE[o.i % PALETTE.length]}
          fillOpacity="0.08"
          stroke={PALETTE[o.i % PALETTE.length]}
          strokeWidth="3.2"
          strokeDasharray="0.1 8"
          strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
      ))}

      {/* BCC edge-stack underlay */}
      {step && mode === 'bcc' &&
        step.stack.map((id) => (
          <path key={`u${id}`} d={geo[id]?.d} fill="none" stroke="var(--amber)" strokeWidth="11" opacity="0.28" strokeLinecap="round" />
        ))}

      {graph.edges.map((_, i) => {
        const s = { ...edgeStyle(i, step, mode), ...(eOverride ? eOverride(i) : {}) };
        return (
          <path
            key={i}
            d={geo[i].d}
            fill="none"
            stroke={s.stroke}
            strokeWidth={s.width}
            strokeDasharray={s.dash || undefined}
            strokeLinecap="round"
            opacity={s.opacity ?? 1}
            markerEnd={directed ? `url(#arr-${s.marker})` : undefined}
            style={{ transition: 'stroke 0.25s, stroke-width 0.25s' }}
          />
        );
      })}

      {edgeTools &&
        graph.edges.map((_, i) => (
          <path key={`h${i}`} d={geo[i].d} fill="none" stroke="transparent" strokeWidth="16" style={{ cursor: 'pointer' }} onClick={(e) => clickEdge(i, e)} />
        ))}

      {graph.pos.map((p, v) => {
        const o = vOverride ? vOverride(v) || {} : {};
        const isCur = step && step.cur === v;
        const isAP = step && mode !== 'scc' && step.aps.includes(v);
        const fill = o.fill || vertexFill(v);
        const labelFill = fill === 'var(--node)' ? 'var(--text)' : fill === 'var(--accent)' ? 'var(--on-accent)' : '#101828';
        return (
          <g
            key={v}
            data-v={v}
            transform={`translate(${p.x} ${p.y})`}
            opacity={o.opacity ?? 1}
            style={{ cursor: tool === 'move' ? 'grab' : tool === 'adde' || tool === 'del' || tool === 'pick' ? 'pointer' : 'default' }}
            onPointerDown={(e) => {
              if (tool === 'move' && onChange) {
                e.stopPropagation();
                dragRef.current = v;
                svgRef.current.setPointerCapture?.(e.pointerId);
              }
            }}
            onClick={(e) => clickVertex(v, e)}
          >
            {isAP && <circle r={R + 7} fill="none" stroke="var(--red)" strokeWidth="3" strokeDasharray="4 4" />}
            {pending === v && <circle r={R + 7} fill="none" stroke="var(--blue)" strokeWidth="3" />}
            {o.ring && <circle r={R + 7} fill="none" stroke={o.ring} strokeWidth="4" />}
            {isCur && <circle className="pulse" r={R + 5} fill="none" stroke="var(--accent-2)" strokeWidth="2.5" />}
            <circle className="node-c" r={R} fill={fill} stroke={isCur ? 'var(--text)' : 'var(--node-stroke)'} strokeWidth={isCur ? 3.5 : 1.5} style={{ transition: 'fill 0.25s' }} />
            <text textAnchor="middle" dy="0.35em" fontSize="15" fontWeight="700" fill={labelFill} style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {v}
            </text>
            {step && labelMode !== 'none' && step.disc[v] >= 0 && (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={labelMode === 'disc' ? -16 : -28} y={-R - 25} width={labelMode === 'disc' ? 32 : 56} height="19" rx="6" fill="var(--panel)" stroke="var(--line)" />
                <text textAnchor="middle" y={-R - 11} fontSize="11.5" fontFamily="var(--mono)" fill="var(--text)">
                  {labelMode === 'disc' ? step.disc[v] : `${step.disc[v]} / ${step.low[v]}`}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {graph.n === 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fill="var(--muted)" fontSize="16">
          Empty graph — choose “Add Vertex” and click here, or load a preset.
        </text>
      )}
    </svg>
  );
}
