import { useMemo, useState } from 'react';
import GraphCanvas, { PALETTE } from './GraphCanvas.jsx';
import { PRESETS_U, randomUndirected, mk, componentsAfterRemoval, MAX_N } from '../engine/graphs.js';
import { analyzeUndirected, solve2SAT, bruteSAT, lit, litName } from '../engine/lean.js';
import { traceSCC } from '../engine/traces.js';

export default function Applications({ graphU, onOpenGraph }) {
  const [sub, setSub] = useState('router');
  return (
    <div className="apps">
      <div className="card intro">
        <h2>What are these techniques for?</h2>
        <p>The same disc/low bookkeeping you have been watching answers real engineering questions. Pick an application:</p>
        <div className="modebar" role="tablist" style={{ marginBottom: 0 }}>
          <button role="tab" aria-selected={sub === 'router'} className={sub === 'router' ? 'on' : ''} onClick={() => setSub('router')}>Router failure simulator</button>
          <button role="tab" aria-selected={sub === 'sat'} className={sub === 'sat' ? 'on' : ''} onClick={() => setSub('sat')}>2-SAT with SCCs</button>
        </div>
      </div>
      {sub === 'router' ? <RouterSim graphU={graphU} onOpenGraph={onOpenGraph} /> : <TwoSat onOpenGraph={onOpenGraph} />}
    </div>
  );
}

/* ====================================================================== */
/*  Router failure simulator: articulation points and bridges               */
/* ====================================================================== */
const reachable = (n, edges, gateway, remV, remE) => {
  const adj = Array.from({ length: n }, () => []);
  edges.forEach(([a, b], i) => {
    if (remE.has(i) || remV.has(a) || remV.has(b)) return;
    adj[a].push(b);
    adj[b].push(a);
  });
  const seen = new Set();
  if (remV.has(gateway) || gateway >= n) return seen;
  const q = [gateway];
  seen.add(gateway);
  while (q.length) {
    const u = q.pop();
    for (const v of adj[u]) if (!seen.has(v)) { seen.add(v); q.push(v); }
  }
  return seen;
};

const NET_PRESETS = PRESETS_U.filter((p) => ['campus', 'hinge', 'bowtie', 'cycle', 'tree', 'classic'].includes(p.id));
const OFFLINE = PALETTE[4]; // readable on both themes

function RouterSim({ graphU, onOpenGraph }) {
  const [graph, setGraph] = useState(() => PRESETS_U.find((p) => p.id === 'campus').make());
  const [gateway, setGateway] = useState(0);
  const [remV, setRemV] = useState(new Set());
  const [remE, setRemE] = useState(new Set());
  const [tool, setTool] = useState('pick');
  const [showWeak, setShowWeak] = useState(true);

  const n = graph.n;
  const gw = Math.min(gateway, Math.max(n - 1, 0));
  const reset = () => { setRemV(new Set()); setRemE(new Set()); };
  const load = (g) => { setGraph(g); setGateway(0); reset(); };
  const toggle = (setter) => (k) => setter((s) => { const x = new Set(s); x.has(k) ? x.delete(k) : x.add(k); return x; });

  // the low-link analysis of the healthy network
  const an = useMemo(() => analyzeUndirected(graph.n, graph.edges), [graph]);
  const lostIf = (rv, re) => {
    const r = reachable(n, graph.edges, gw, rv, re);
    let lost = 0;
    for (let v = 0; v < n; v++) if (!rv.has(v) && !r.has(v)) lost++;
    return lost;
  };
  const weakRows = useMemo(() => {
    const rows = [];
    an.aps.forEach((v) => rows.push({ kind: 'router', id: v, label: `Router ${v}`, lost: lostIf(new Set([v]), new Set()) }));
    an.bridges.forEach((e) => rows.push({ kind: 'link', id: e, label: `Link ${graph.edges[e][0]}–${graph.edges[e][1]}`, lost: lostIf(new Set(), new Set([e])) }));
    return rows.sort((a, b) => b.lost - a.lost);
  }, [an, graph, gw]); // eslint-disable-line

  // the link whose addition removes the most single points of failure (tried exhaustively: V^2 links x O(V+E))
  const advice = useMemo(() => {
    const score = (edges) => { const a = analyzeUndirected(graph.n, edges); return a.aps.length + a.bridges.length; };
    const before = an.aps.length + an.bridges.length;
    if (before === 0 || graph.n < 3) return { before, best: null };
    const has = new Set(graph.edges.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`)));
    let best = null;
    for (let a = 0; a < graph.n; a++) for (let b = a + 1; b < graph.n; b++) {
      if (has.has(`${a}-${b}`)) continue;
      const sc = score([...graph.edges, [a, b]]);
      if (!best || sc < best.after) best = { a, b, after: sc };
    }
    return { before, best };
  }, [graph, an]);

  const online = useMemo(() => reachable(n, graph.edges, gw, remV, remE), [graph, gw, remV, remE]); // eslint-disable-line
  const failedCount = remV.size + remE.size;
  const live = n - remV.size;
  const cut = live - online.size;
  const pieces = failedCount ? componentsAfterRemoval(n, graph.edges, remV, remE).count : componentsAfterRemoval(n, graph.edges).count;
  const weakV = new Set(an.aps);
  const weakE = new Set(an.bridges);

  const vOverride = (v) => {
    if (remV.has(v)) return { opacity: 0.3 };
    const o = { fill: online.has(v) ? 'var(--accent)' : OFFLINE };
    if (v === gw) o.ring = 'var(--blue)';
    else if (showWeak && weakV.has(v)) o.ring = 'var(--red)';
    return o;
  };
  const eOverride = (i) => {
    const [a, b] = graph.edges[i];
    if (remE.has(i) || remV.has(a) || remV.has(b)) return { opacity: 0.18, dash: '3 7' };
    if (!online.has(a) && !online.has(b)) return { opacity: 0.45 };
    if (showWeak && weakE.has(i)) return { stroke: 'var(--red)', width: 5.5 };
    return null;
  };

  const worst = weakRows.find((r) => r.kind === 'router') || weakRows[0];
  const failWorst = () => {
    if (!worst) return;
    reset();
    if (worst.kind === 'router') setRemV(new Set([worst.id]));
    else setRemE(new Set([worst.id]));
  };
  const failRandom = () => {
    reset();
    if (n > 0) setRemV(new Set([Math.floor(Math.random() * n)]));
  };
  const addLink = () => {
    if (!advice.best) return;
    setGraph({ ...graph, edges: [...graph.edges, [advice.best.a, advice.best.b]] });
    reset();
  };
  const loadPreset = (id) => {
    const p = PRESETS_U.find((x) => x.id === id);
    if (p) load(p.make());
  };

  return (
    <div className="appgrid">
      <div className="card">
        <div className="toolbar">
          <div className="seg" role="group" aria-label="Simulator tool">
            <button className={tool === 'pick' ? 'on' : ''} onClick={() => setTool('pick')}>Fail routers / links</button>
            <button className={tool === 'move' ? 'on' : ''} onClick={() => setTool('move')}>Move</button>
            <button className={tool === 'adde' ? 'on' : ''} onClick={() => setTool('adde')}>Add link</button>
            <button className={tool === 'del' ? 'on' : ''} onClick={() => { setTool('del'); reset(); }}>Remove</button>
          </div>
          <label className="inl">Network
            <select value="" onChange={(e) => loadPreset(e.target.value)} aria-label="Choose a network">
              <option value="" disabled hidden>Choose one</option>
              {NET_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="inl">Gateway
            <select value={gw} onChange={(e) => { setGateway(+e.target.value); }} aria-label="Gateway router">
              {graph.pos.map((_, v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <button onClick={() => load(randomUndirected(8 + Math.floor(Math.random() * 4), 2 + Math.floor(Math.random() * 2)))}>Random</button>
          <button onClick={() => load({ n: graphU.n, edges: graphU.edges.map((e) => [...e]), pos: graphU.pos.map((p) => ({ ...p })) })} title="Use the undirected graph from the Visualizer">Use my Visualizer graph</button>
          <label className="inl check"><input type="checkbox" checked={showWeak} onChange={(e) => setShowWeak(e.target.checked)} /> Reveal weak points</label>
        </div>
        <p className="muted">
          Routers are vertices and cables are edges. Every router must stay connected to the <b>gateway</b> (blue ring). Click routers or links to knock them out and watch who loses service. Red rings and red cables are the <b>single points of failure</b> found by one low-link DFS.
        </p>
        <GraphCanvas
          graph={graph}
          tool={tool}
          onChange={(g) => { setGraph(g); reset(); }}
          vOverride={vOverride}
          eOverride={eOverride}
          onClickV={toggle(setRemV)}
          onClickE={toggle(setRemE)}
        />
        <div className="legend">
          <span><i className="vdot" style={{ background: 'var(--accent)' }} />in service</span>
          <span><i className="vdot" style={{ background: OFFLINE }} />cut off from the gateway</span>
          <span><i className="vdot ring" />single point of failure</span>
          <span><i style={{ background: 'var(--red)' }} />critical cable (bridge)</span>
        </div>
        <div className={`statusbar ${cut > 0 || remV.has(gw) ? 'bad' : 'good'}`} role="status">
          {failedCount === 0 && <>Healthy network: all <b>{n}</b> routers reach the gateway.</>}
          {failedCount > 0 && remV.has(gw) && <>The gateway itself is down: <b>every</b> router is cut off.</>}
          {failedCount > 0 && !remV.has(gw) && (cut > 0
            ? <><b>{cut}</b> of {live} working router{live === 1 ? '' : 's'} lost the gateway. The network has fallen into <b>{pieces}</b> pieces.</>
            : <>Still fine: all {live} working routers reach the gateway despite {failedCount} failure{failedCount === 1 ? '' : 's'}.</>)}
          {failedCount > 0 && <> <button className="ghost" onClick={reset}>Restore everything</button></>}
        </div>
        <div className="pbtns">
          <button onClick={failWorst} disabled={!worst}>Fail the most damaging single point</button>
          <button onClick={failRandom}>Fail a random router</button>
        </div>
      </div>

      <div>
        <div className="card">
          <div className="cardh">Single points of failure</div>
          {weakRows.length === 0 ? (
            <p>None. Every router and cable lies on a cycle, so <b>any one failure</b> leaves the network connected. This graph is biconnected and has no bridges.</p>
          ) : (
            <table className="cmp">
              <thead><tr><th>Component</th><th>Found by</th><th>Cut off if it fails alone</th></tr></thead>
              <tbody>
                {weakRows.map((r) => (
                  <tr key={`${r.kind}${r.id}`}>
                    <td>{r.label}</td>
                    <td>{r.kind === 'router' ? 'articulation point' : 'bridge'}</td>
                    <td><b>{r.lost}</b> router{r.lost === 1 ? '' : 's'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted small">
            One DFS computed disc and low for every router: a router is a single point of failure when some child subtree has <code>low[v] ≥ disc[u]</code>, a cable when <code>low[v] &gt; disc[u]</code>. That took {an.ops} operations (V + 2E = {n + 2 * graph.edges.length}); trying every failure by hand would take about V·(V + E) = {(n * (n + graph.edges.length)).toLocaleString()}.
          </p>
          <div className="pbtns">
            <button onClick={() => onOpenGraph('ap', graph)}>Watch the DFS find them</button>
            <button onClick={() => onOpenGraph('bridge', graph)}>…and the critical cables</button>
          </div>
        </div>

        <div className="card">
          <div className="cardh">How to make it more robust</div>
          {advice.best ? (
            <>
              <p>
                Adding the single cable <b>{advice.best.a}–{advice.best.b}</b> would reduce the number of single points of failure (routers plus cables) from <b>{advice.before}</b> to <b>{advice.best.after}</b>. Every possible new cable was tried, and each try is one O(V + E) low-link pass.
              </p>
              <button className="primary" onClick={addLink}>Add cable {advice.best.a}–{advice.best.b}</button>
            </>
          ) : (
            <p>{advice.before === 0 ? 'Nothing to fix: no single failure disconnects this network.' : 'Add more routers and cables to analyse.'}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  2-SAT with strongly connected components                                */
/* ====================================================================== */
const SAT_PRESETS = [
  { id: 'sat', name: 'Satisfiable', nVars: 4, clauses: [[lit(0), lit(1)], [lit(0, true), lit(2)], [lit(1, true), lit(2, true)], [lit(2), lit(3)], [lit(3, true), lit(0, true)]] },
  { id: 'unsat', name: 'Contradiction', nVars: 3, clauses: [[lit(0), lit(1)], [lit(0), lit(1, true)], [lit(0, true), lit(2)], [lit(0, true), lit(2, true)]] },
  { id: 'chain', name: 'Long implication chain', nVars: 5, clauses: [[lit(0, true), lit(1)], [lit(1, true), lit(2)], [lit(2, true), lit(3)], [lit(3, true), lit(4)], [lit(0), lit(0)]] },
];

const satLayout = (nVars) => {
  const gap = Math.min(96, 640 / Math.max(nVars, 1));
  const x0 = 380 - (gap * (nVars - 1)) / 2;
  const pos = [];
  for (let v = 0; v < nVars; v++) {
    pos.push([Math.round(x0 + v * gap), 130]); // x_v
    pos.push([Math.round(x0 + v * gap), 350]); // ¬x_v
  }
  return pos;
};

function TwoSat({ onOpenGraph }) {
  const [nVars, setNVars] = useState(SAT_PRESETS[0].nVars);
  const [clauses, setClauses] = useState(SAT_PRESETS[0].clauses);

  const res = useMemo(() => solve2SAT(nVars, clauses), [nVars, clauses]);
  const graph = useMemo(() => mk(nVars * 2, res.edges, satLayout(nVars)), [nVars, res.edges]);
  const final = useMemo(() => (graph.n && graph.edges.length ? traceSCC(graph, 0).at(-1) : null), [graph]);
  const truth = useMemo(() => bruteSAT(nVars, clauses), [nVars, clauses]);

  const loadPreset = (p) => { setNVars(p.nVars); setClauses(p.clauses.map((c) => [...c])); };
  const setLit = (ci, which, v, neg) => setClauses((cs) => cs.map((c, i) => (i === ci ? c.map((l, k) => (k === which ? lit(v, neg) : l)) : c)));
  const changeVars = (k) => {
    setNVars(k);
    setClauses((cs) => cs.filter(([a, b]) => a >> 1 < k && b >> 1 < k));
  };
  const addClause = () => setClauses((cs) => (cs.length >= 14 ? cs : [...cs, [lit(0), lit(Math.min(1, nVars - 1))]]));
  const formula = clauses.length ? clauses.map(([a, b]) => `(${litName(a)} ∨ ${litName(b)})`).join(' ∧ ') : '(no clauses: everything is satisfiable)';

  const conflict = new Set(res.conflict);
  const vOverride = (v) => (conflict.has(v >> 1) ? { ring: 'var(--red)' } : {});
  const sccGroups = useMemo(() => {
    const g = Array.from({ length: res.count }, () => []);
    res.comp.forEach((c, v) => g[c].push(v));
    return g;
  }, [res]);

  return (
    <div className="appgrid">
      <div className="card">
        <div className="toolbar">
          <label className="inl">Variables
            <select value={nVars} onChange={(e) => changeVars(+e.target.value)}>
              {[2, 3, 4, 5, 6, 7, 8].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          {SAT_PRESETS.map((p) => <button key={p.id} onClick={() => loadPreset(p)}>{p.name}</button>)}
          <button onClick={addClause} disabled={clauses.length >= 14}>Add clause</button>
        </div>
        <p className="formula2" aria-label="The formula">{formula}</p>
        <div className="clauses">
          {clauses.map(([a, b], ci) => (
            <div className="clause" key={ci}>
              {[a, b].map((l, k) => (
                <span key={k} className="litpick">
                  {k === 1 && <span className="or">∨</span>}
                  <select value={l >> 1} onChange={(e) => setLit(ci, k, +e.target.value, (l & 1) === 1)} aria-label={`Clause ${ci + 1} variable ${k + 1}`}>
                    {Array.from({ length: nVars }, (_, v) => <option key={v} value={v}>x{v + 1}</option>)}
                  </select>
                  <label className="inl check"><input type="checkbox" checked={(l & 1) === 1} onChange={(e) => setLit(ci, k, l >> 1, e.target.checked)} /> ¬</label>
                </span>
              ))}
              <button className="ghost" onClick={() => setClauses((cs) => cs.filter((_, i) => i !== ci))} aria-label={`Remove clause ${ci + 1}`}>✕</button>
            </div>
          ))}
        </div>

        <div className="cardh" style={{ marginTop: 14 }}>The implication graph</div>
        <p className="muted small">Each clause (a ∨ b) says "if a is false then b must be true, and if b is false then a must be true": two edges ¬a → b and ¬b → a. Top row: x, bottom row: ¬x. Dotted outlines are SCCs; vertices in one SCC are all forced to have the same truth value.</p>
        <GraphCanvas graph={graph} directed step={final} mode="scc" labelMode="none" tool="none" vLabel={litName} vOverride={vOverride} />
      </div>

      <div>
        <div className={`card verdict2 ${res.sat ? 'sat' : 'unsat'}`}>
          <div className="cardh">Answer from SCCs</div>
          {res.sat ? (
            <>
              <p><b>Satisfiable.</b> One solution:</p>
              <div className="chips">{res.assign.map((t, v) => <span key={v} className="chip" style={{ borderColor: t ? 'var(--green)' : 'var(--red)' }}>x{v + 1} = {t ? 'T' : 'F'}</span>)}</div>
              <p className="muted small">Tarjan finds components in <b>reverse</b> topological order, so a variable is set true when its component was found <i>before</i> its negation's (comp[x] &lt; comp[¬x]). That rule always picks the literal that is later in the implication order, so nothing it sets true can force it false.</p>
            </>
          ) : (
            <>
              <p><b>Unsatisfiable.</b> {res.conflict.map((v) => `x${v + 1}`).join(', ')} and {res.conflict.map((v) => `¬x${v + 1}`).join(', ')} are in the same SCC: x ⇒ … ⇒ ¬x and ¬x ⇒ … ⇒ x, so neither value can hold.</p>
              <div className="chips">{sccGroups.filter((g) => g.some((v) => conflict.has(v >> 1) && g.includes(v ^ 1))).map((g, k) => <span key={k} className="chip" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{'{'}{g.map(litName).join(', ')}{'}'}</span>)}</div>
            </>
          )}
          <p className="muted small">Checked against trying all {2 ** nVars} assignments by brute force: {truth === res.sat ? 'same answer.' : 'MISMATCH (this should never happen).'}</p>
        </div>

        <div className="card">
          <div className="cardh">Strongly connected components</div>
          {sccGroups.length === 0 ? <p className="muted">No vertices.</p> : sccGroups.map((g, k) => (
            <div key={k} className="blockrow"><span className="dot" style={{ background: PALETTE[k % PALETTE.length] }} />#{k + 1}: {'{'}{g.map(litName).join(', ')}{'}'}</div>
          ))}
          <p className="muted small">Why SCCs? If a path leads from x to ¬x and another from ¬x to x, the formula is contradictory. Otherwise a consistent choice exists. One Tarjan run decides it in O(V + E) = O(variables + clauses).</p>
          <div className="pbtns">
            <button className="primary" onClick={() => onOpenGraph('scc', graph)} disabled={graph.n > MAX_N || graph.edges.length === 0}>Watch Tarjan run on this graph</button>
          </div>
          <p className="muted small">In the Visualizer, vertex 2i is x(i+1) and vertex 2i+1 is ¬x(i+1): vertices 0 and 1 are x1 and ¬x1, vertices 2 and 3 are x2 and ¬x2, and so on.</p>
        </div>
      </div>
    </div>
  );
}
