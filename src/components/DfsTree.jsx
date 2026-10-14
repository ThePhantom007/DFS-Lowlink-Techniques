import { useMemo, useState } from 'react';
import { hullPath } from './GraphCanvas.jsx';

// The DFS tree drawn top-down, with non-tree edges as arcs. It answers "why is low[x] this value?" by
// highlighting the back edge (or child) that set it, and shades a whole subtree while a test such as
// low[v] >= disc[u] runs, to show that the subtree can (or cannot) climb above u.

const DX = 54;
const DY = 66;
const R = 15;
const PAD_X = 36;
const PAD_TOP = 44;

function layoutTree(parent, disc) {
  const n = parent.length;
  const kids = Array.from({ length: n }, () => []);
  const roots = [];
  const order = [...Array(n).keys()].filter((v) => disc[v] >= 0).sort((a, b) => disc[a] - disc[b]);
  order.forEach((v) => (parent[v] >= 0 ? kids[parent[v]].push(v) : roots.push(v)));
  const pos = {};
  let leaf = 0;
  let maxDepth = 0;
  const place = (v, depth) => {
    maxDepth = Math.max(maxDepth, depth);
    if (!kids[v].length) pos[v] = { x: leaf++, depth };
    else {
      kids[v].forEach((c) => place(c, depth + 1));
      pos[v] = { x: (pos[kids[v][0]].x + pos[kids[v][kids[v].length - 1]].x) / 2, depth };
    }
  };
  roots.forEach((r, i) => {
    if (i) leaf += 0.6;
    place(r, 0);
  });
  return { pos, leaves: Math.max(leaf, 1), maxDepth };
}

function subtreeOf(parent, root) {
  const out = new Set([root]);
  let grew = true;
  while (grew) {
    grew = false;
    parent.forEach((p, v) => {
      if (p >= 0 && out.has(p) && !out.has(v)) {
        out.add(v);
        grew = true;
      }
    });
  }
  return out;
}

/* Explain where low[x] comes from by following the recorded sources: child -> child -> ... -> back edge. */
export function whyLow(step, x, edges, directed) {
  if (!step || x < 0 || step.disc[x] < 0) return null;
  const sep = directed ? '→' : '–';
  const ename = (id) => `${edges[id][0]}${sep}${edges[id][1]}`;
  const d = step.disc[x];
  const src = step.lowSrc[x];
  if (!src) {
    return { x, text: `low[${x}] = disc[${x}] = ${d}. So far nothing in ${x}'s subtree has an edge to an earlier vertex${directed ? ' that is still on the stack' : ''}, so ${x} can only reach itself.`, treeEdges: [], arc: null, verts: [x] };
  }
  const path = [x];
  let cur = x;
  let guard = 0;
  while (step.lowSrc[cur] && step.lowSrc[cur].k === 'child' && guard++ < 100) {
    cur = step.lowSrc[cur].v;
    path.push(cur);
  }
  const end = step.lowSrc[cur];
  const treeEdges = path.slice(1).map((p) => step.pedge[p]);
  if (end && end.k === 'back') {
    const via = path.length > 1 ? `child ${path[1]}'s subtree (${path.slice(1).join(' → ')}) contains ` : `${x} itself has `;
    return {
      x,
      text: `low[${x}] = ${step.low[x]} because ${via}the ${directed ? 'edge' : 'back edge'} ${ename(end.id)}, which lands on ${end.v} (disc[${end.v}] = ${step.disc[end.v]}).`,
      treeEdges,
      arc: end.id,
      verts: [...path, end.v],
    };
  }
  return { x, text: `low[${x}] = ${step.low[x]}.`, treeEdges, arc: null, verts: path };
}

const KIND_COLOR = { back: 'var(--violet)', forward: 'var(--pink)', cross: 'var(--orange)' };

export default function DfsTree({ step, final, graph, mode }) {
  const directed = mode === 'scc';
  const [picked, setPicked] = useState(null);
  const layout = useMemo(() => layoutTree(final.parent, final.disc), [final]);
  const ev = step.ev;

  // the vertex we explain: the user's pick, else the one whose low just changed, else the current vertex
  const auto = ev && ev.type === 'test' ? ev.v : ev && (ev.type === 'low' || ev.type === 'edge' || ev.type === 'back') ? ev.u : step.cur;
  const sel = picked !== null && picked < graph.n && step.disc[picked] >= 0 ? picked : auto;
  const why = useMemo(() => whyLow(step, sel, graph.edges, directed), [step, sel, graph.edges, directed]);

  const W = Math.max(layout.leaves, 1) * DX + PAD_X * 2 + 70;
  const H = (layout.maxDepth + 1) * DY + PAD_TOP + 20;
  const P = (v) => ({ x: PAD_X + layout.pos[v].x * DX, y: PAD_TOP + layout.pos[v].depth * DY });

  // what the current step is doing, in tree terms
  const lowChanged = ev && ev.type === 'low' && ev.nw < ev.old;
  const test = ev && ev.type === 'test' ? ev : null;
  const sub = test ? subtreeOf(step.parent, test.v) : null;
  const subPath = sub ? hullPath([...sub].map(P), R + 11) : null;
  // when a test fails, the escape route (the back edge that gives v's subtree a way out) is highlighted too
  // what is TRUE of the picture, judged from the numbers, independent of whether the code's test (possibly buggy) agrees
  const truth = test ? (mode === 'scc' ? test.cond : mode === 'bridge' ? test.lv > test.d : test.lv >= test.d) : null;
  const escape = test && !truth ? whyLow(step, test.v, graph.edges, directed) : null;
  const hotTree = new Set();
  if (lowChanged && ev.k === 'child') {
    hotTree.add(step.pedge[ev.v]);
    (whyLow(step, ev.v, graph.edges, directed)?.treeEdges || []).forEach((e) => hotTree.add(e));
  }
  (why?.treeEdges || []).forEach((e) => hotTree.add(e));
  (escape?.treeEdges || []).forEach((e) => hotTree.add(e));
  const hotArc = lowChanged && ev.k === 'back' ? ev.id : escape && escape.arc !== null ? escape.arc : why?.arc ?? null;

  const arcs = graph.edges
    .map((e, i) => ({ e, i, kind: step.edgeKind[i] }))
    .filter(({ kind }) => kind === 'back' || kind === 'forward' || kind === 'cross');

  const arcPath = ({ e: [a, b], i, kind }) => {
    let from = a;
    let to = b;
    if (!directed) {
      from = step.disc[a] > step.disc[b] ? a : b; // descendant ...
      to = from === a ? b : a; // ... to ancestor
    }
    if (!layout.pos[from] || !layout.pos[to]) return null;
    const A = P(from);
    const B = P(to);
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy) || 1;
    const same = graph.edges.slice(0, i).filter((q, j) => (step.edgeKind[j] === 'back' || step.edgeKind[j] === 'forward' || step.edgeKind[j] === 'cross') && ((q[0] === a && q[1] === b) || (q[0] === b && q[1] === a))).length;
    const bulge = (kind === 'cross' ? -1 : 1) * (34 + 9 * Math.abs(layout.pos[from].depth - layout.pos[to].depth) + 14 * same);
    const mx = (A.x + B.x) / 2 + (-dy / len) * bulge;
    const my = (A.y + B.y) / 2 + (dx / len) * bulge;
    const sx = A.x + ((mx - A.x) / (Math.hypot(mx - A.x, my - A.y) || 1)) * R;
    const sy = A.y + ((my - A.y) / (Math.hypot(mx - A.x, my - A.y) || 1)) * R;
    const ex = B.x + ((mx - B.x) / (Math.hypot(mx - B.x, my - B.y) || 1)) * (R + 5);
    const ey = B.y + ((my - B.y) / (Math.hypot(mx - B.x, my - B.y) || 1)) * (R + 5);
    return `M${sx} ${sy} Q${mx} ${my} ${ex} ${ey}`;
  };

  const vfill = (v) => {
    if (step.disc[v] < 0) return 'var(--node)';
    if (mode === 'scc' && step.sccOf[v] >= 0) return 'var(--accent)';
    return step.vstate[v] === 1 ? 'var(--amber)' : 'var(--accent)';
  };

  const sealed = truth;
  const shade = sealed ? 'var(--green)' : 'var(--amber)';

  return (
    <div className="dfstree">
      <div className="treewrap">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="DFS tree with back edges drawn as arcs">
          <defs>
            {Object.entries(KIND_COLOR).concat([['hot', 'var(--amber)']]).map(([k, c]) => (
              <marker key={k} id={`ta-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto">
                <path d="M0 0 L10 5 L0 10 z" fill={c} />
              </marker>
            ))}
          </defs>

          {subPath && <path d={subPath} fill={shade} fillOpacity="0.16" stroke={shade} strokeWidth="2" strokeDasharray="5 4" style={{ pointerEvents: 'none' }} />}
          {test && step.disc[test.u] >= 0 && (
            <g style={{ pointerEvents: 'none' }}>
              <line x1="8" x2={W - 8} y1={P(test.u).y} y2={P(test.u).y} stroke="var(--text)" strokeOpacity="0.45" strokeDasharray="2 5" />
              <text x={W - 8} y={P(test.u).y - 5} textAnchor="end" fontSize="10.5" fill="var(--muted)" fontFamily="var(--mono)">level of {test.u}: disc = {test.d}</text>
            </g>
          )}

          {/* tree edges */}
          {Object.keys(layout.pos).map(Number).filter((v) => step.parent[v] >= 0).map((v) => {
            const A = P(step.parent[v]);
            const B = P(v);
            const hot = hotTree.has(step.pedge[v]);
            const bridge = mode === 'bridge' && step.bridges.includes(step.pedge[v]);
            return <line key={`t${v}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={hot ? 'var(--amber)' : bridge ? 'var(--red)' : 'var(--accent)'} strokeWidth={hot ? 5 : bridge ? 4.5 : 3} strokeLinecap="round" />;
          })}

          {/* non-tree edges as arcs */}
          {arcs.map((a) => {
            const d = arcPath(a);
            if (!d) return null;
            const hot = hotArc === a.i || (ev && ev.id === a.i && (ev.type === 'back' || ev.type === 'edge'));
            const c = hot ? 'hot' : a.kind;
            return <path key={`a${a.i}`} d={d} fill="none" stroke={hot ? 'var(--amber)' : KIND_COLOR[a.kind]} strokeWidth={hot ? 4 : 2.5} strokeDasharray={hot ? undefined : '6 4'} markerEnd={`url(#ta-${c})`} opacity={hot ? 1 : 0.9} />;
          })}

          {/* vertices */}
          {Object.keys(layout.pos).map(Number).map((v) => {
            const p = P(v);
            const seen = step.disc[v] >= 0;
            const inChain = why && why.verts.includes(v);
            return (
              <g key={v} transform={`translate(${p.x} ${p.y})`} style={{ cursor: seen ? 'pointer' : 'default' }} opacity={seen ? 1 : 0.28} onClick={() => seen && setPicked(v === sel && picked !== null ? null : v)} role={seen ? 'button' : undefined} tabIndex={seen ? 0 : undefined} aria-label={seen ? `Explain low of vertex ${v}` : undefined} onKeyDown={(e) => seen && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setPicked(v === sel && picked !== null ? null : v))}>
                {sel === v && <circle r={R + 6} fill="none" stroke="var(--text)" strokeWidth="2" />}
                {inChain && sel !== v && <circle r={R + 5} fill="none" stroke="var(--amber)" strokeWidth="2.5" />}
                <circle r={R} fill={vfill(v)} stroke="var(--node-stroke)" strokeWidth="1.5" />
                <text textAnchor="middle" dy="0.35em" fontSize="13" fontWeight="700" fill={step.vstate[v] === 2 || (mode === 'scc' && step.sccOf[v] >= 0) ? 'var(--on-accent)' : step.vstate[v] === 1 ? '#101828' : 'var(--text)'} style={{ pointerEvents: 'none' }}>{v}</text>
                {seen && (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect x="-23" y={-R - 19} width="46" height="16" rx="5" fill="var(--panel)" stroke={ev && ev.u === v && lowChanged ? 'var(--amber)' : 'var(--line)'} strokeWidth={ev && ev.u === v && lowChanged ? 2 : 1} />
                    <text textAnchor="middle" y={-R - 7} fontSize="10.5" fontFamily="var(--mono)" fill="var(--text)">{step.disc[v]} / {step.low[v]}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="treelegend muted small">
        <span><i className="lg tree" />tree edge</span>
        <span><i className="lg arc" />{directed ? 'non-tree edge' : 'back edge (arc to the ancestor)'}</span>
        <span><i className="lg hot" />what set low</span>
        {test && <span><i className="lg sh" style={{ background: shade }} />subtree being tested</span>}
        <span>labels: disc / low</span>
      </div>

      {test && (
        <div className={`treenote ${sealed ? 'sealed' : 'escapes'}`}>
          {mode === 'scc' ? (
            test.cond
              ? <>The shaded subtree of <b>{test.u}</b> has low[{test.u}] = {test.lv} = disc[{test.u}] = {test.d}: nothing inside it reaches an earlier vertex on the stack, so it is closed off and <b>{test.u}</b> roots an SCC.</>
              : <>The shaded subtree reaches low[{test.u}] = {test.lv}, which is above {test.u} (disc {test.d}): it still connects to a vertex on the stack, so <b>{test.u}</b> is not an SCC root.</>
          ) : (
            <>
              The shaded subtree of <b>{test.v}</b> reaches at best low[{test.v}] = {test.lv}, which is{' '}
              {test.lv < test.d
                ? <><b>above</b> {test.u} (disc {test.d}): a back edge escapes{escape && escape.arc !== null && escape.arc !== undefined ? <> (highlighted: {escape.text.replace(/^low\[\d+\] = \d+ because /, '').replace(/\.$/, '')})</> : null}</>
                : test.lv === test.d
                ? <><b>exactly {test.u}</b>: it can get back to {test.u} but not above it{mode === 'bridge' ? `, so the edge ${test.u}–${test.v} lies on a cycle` : `, so every path out of it still goes through ${test.u}`}{escape && escape.arc !== null && escape.arc !== undefined ? <> (highlighted: {escape.text.replace(/^low\[\d+\] = \d+ because /, '').replace(/\.$/, '')})</> : null}</>
                : <><b>below</b> {test.u}: it cannot even get back to {test.u}</>}.
              {' '}The code tests {test.lv} {test.op} disc[{test.u}] = {test.d}, which is <b>{test.cond ? 'true' : 'false'}</b>.
              {test.cond !== truth && <> <b>The picture and the code's test disagree here: this is where the bug bites.</b></>}
            </>
          )}
        </div>
      )}

      {why && (
        <div className="whybox">
          <div className="stitle">Why is low[{why.x}] this value?</div>
          <p>{why.text}</p>
          <p className="muted small">
            {picked === null ? 'Showing the vertex that just changed. ' : <button className="ghost" onClick={() => setPicked(null)}>Follow the algorithm again</button>}
            {' '}Click any visited vertex in the tree to ask the same question about it.
          </p>
        </div>
      )}
    </div>
  );
}
