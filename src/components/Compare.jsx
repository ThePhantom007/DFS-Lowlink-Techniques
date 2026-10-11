import { useMemo } from 'react';
import GraphCanvas, { PALETTE } from './GraphCanvas.jsx';
import BlockCutTree from './BlockCutTree.jsx';
import { runTrace, blockCutTree } from '../engine/traces.js';
import { PRESETS_U, PRESETS_D, matchPreset, randomUndirected, randomDirected } from '../engine/graphs.js';

const TABLE = [
  ['Articulation points', 'Which vertices disconnect the graph?', 'non-root: low[v] ≥ disc[u]; root: ≥ 2 children', 'none', 'set of vertices'],
  ['Bridges', 'Which edges disconnect the graph?', 'low[v] > disc[u]', 'none', 'set of edges'],
  ['Biconnected components', 'Which edges share a cycle?', 'low[v] ≥ disc[u]', 'edge stack', 'partition of the edges'],
  ['Block-cut tree', 'How do the blocks connect?', 'built from blocks and cut vertices', '—', 'a tree'],
  ['SCC (Tarjan)', 'Who can reach whom? (directed)', 'low[u] == disc[u]', 'vertex stack + onStack[]', 'partition of the vertices'],
];

function Pane({ title, children, caption }) {
  return (
    <div className="card pane">
      <div className="cardh">{title}</div>
      {children}
      <p className="muted small">{caption}</p>
    </div>
  );
}

export default function Compare({ mode, graph, setMode, setGraph }) {
  const directed = mode === 'scc';
  const presets = directed ? PRESETS_D : PRESETS_U;
  const presetId = matchPreset(graph, directed);
  const load = (id) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setGraph(p.make());
  };
  const randomize = () => {
    setGraph(directed ? randomDirected(7, 9 + Math.floor(Math.random() * 4)) : randomUndirected(7 + Math.floor(Math.random() * 3), 1 + Math.floor(Math.random() * 3)));
  };
  const res = useMemo(() => {
    if (graph.n === 0) return null;
    if (directed) return { scc: runTrace('scc', graph, 0).at(-1) };
    return {
      ap: runTrace('ap', graph, 0).at(-1),
      br: runTrace('bridge', graph, 0).at(-1),
      bcc: runTrace('bcc', graph, 0).at(-1),
    };
  }, [graph.n, graph.edges, directed]); // eslint-disable-line

  const e = graph.edges;
  const bct = res?.bcc ? blockCutTree(res.bcc.blocks, e) : null;

  return (
    <div className="compare">
      <div className="card intro">
        <h2>One graph, every lens</h2>
        <p>
          The same DFS produces each answer below. Edit the graph in the Visualizer and come back — everything here recomputes. You are looking at the {directed ? 'directed' : 'undirected'} graph.
        </p>
        <div className="pbtns">
          <button className={!directed ? 'primary' : ''} onClick={() => !directed || setMode('ap')}>Undirected graph</button>
          <button className={directed ? 'primary' : ''} onClick={() => directed || setMode('scc')}>Directed graph</button>
          <label className="inl">Preset graphs
            <select aria-label="Preset graphs for comparison" value={presetId} onChange={(e) => load(e.target.value)}>
              <option value="" disabled hidden>Custom graph</option>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <button onClick={randomize}>Random</button>
        </div>
        {presetId && <p className="presetdesc">{presets.find((p) => p.id === presetId)?.desc}</p>}
      </div>

      {res && !directed && (
        <div className="grid2">
          <Pane title="Articulation points" caption={res.ap.aps.length ? `Cut vertices: ${res.ap.aps.join(', ')}` : 'No cut vertices.'}>
            <GraphCanvas graph={graph} step={res.ap} mode="ap" labelMode="none" />
          </Pane>
          <Pane title="Bridges" caption={res.br.bridges.length ? `Bridges: ${res.br.bridges.map((i) => `${e[i][0]}–${e[i][1]}`).join(', ')}` : 'No bridges.'}>
            <GraphCanvas graph={graph} step={res.br} mode="bridge" labelMode="none" />
          </Pane>
          <Pane title="Biconnected components" caption={`${res.bcc.blocks.length} block${res.bcc.blocks.length === 1 ? '' : 's'} — each colour is one block.`}>
            <GraphCanvas graph={graph} step={res.bcc} mode="bcc" labelMode="none" />
          </Pane>
          <Pane title="Block-cut tree" caption="Blocks (coloured boxes) joined through cut vertices (dashed circles).">
            <BlockCutTree bct={bct} mini />
          </Pane>
        </div>
      )}

      {res && directed && (
        <div className="grid2">
          <Pane title="Strongly connected components" caption={`${res.scc.sccs.length} SCC${res.scc.sccs.length === 1 ? '' : 's'}: ${res.scc.sccs.map((c) => `{${c.join(', ')}}`).join('  ')}`}>
            <GraphCanvas graph={graph} directed step={res.scc} mode="scc" labelMode="none" />
          </Pane>
          <Pane title="Condensation (each SCC collapsed)" caption="Collapsing every SCC to a node always gives a DAG.">
            <Condensation graph={graph} scc={res.scc} />
          </Pane>
        </div>
      )}

      <div className="card">
        <div className="cardh">Same skeleton, different question</div>
        <div className="tablewrap">
          <table className="cmp">
            <thead>
              <tr><th>Algorithm</th><th>Question</th><th>Test</th><th>Extra structure</th><th>Output</th></tr>
            </thead>
            <tbody>
              {TABLE.map((r) => (
                <tr key={r[0]}>{r.map((c, i) => <td key={i}>{i === 0 ? <b>{c}</b> : i === 2 ? <code>{c}</code> : c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Condensation({ graph, scc }) {
  const k = scc.sccs.length;
  const links = new Set();
  graph.edges.forEach(([a, b]) => {
    const x = scc.sccOf[a];
    const y = scc.sccOf[b];
    if (x !== y) links.add(`${x}>${y}`);
  });
  // topological layering by longest path from sources
  const edges = [...links].map((s) => s.split('>').map(Number));
  const depth = Array(k).fill(0);
  for (let it = 0; it < k; it++) edges.forEach(([x, y]) => (depth[y] = Math.max(depth[y], depth[x] + 1)));
  const levels = [];
  depth.forEach((d, i) => (levels[d] = levels[d] || []).push(i));
  const pos = {};
  levels.forEach((l, d) => l.forEach((id, j) => (pos[id] = { x: 70 + d * 130, y: 50 + j * 70 + ((Math.max(...levels.map((q) => q.length)) - l.length) * 35) })));
  const w = Math.max(260, 140 + (levels.length - 1) * 130);
  const h = Math.max(110, 60 + Math.max(...levels.map((q) => q.length)) * 70);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="bct" style={{ maxHeight: 280 }} role="img" aria-label="Condensation DAG">
      <defs>
        <marker id="carr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--text)" /></marker>
      </defs>
      {edges.map(([x, y], i) => {
        const a = pos[x], b = pos[y];
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        return <line key={i} x1={a.x + (dx / len) * 34} y1={a.y + (dy / len) * 22} x2={b.x - (dx / len) * 40} y2={b.y - (dy / len) * 26} stroke="var(--text)" strokeWidth="2" markerEnd="url(#carr)" />;
      })}
      {scc.sccs.map((c, i) => (
        <g key={i} transform={`translate(${pos[i].x} ${pos[i].y})`}>
          <rect x="-34" y="-22" width="68" height="44" rx="10" fill={PALETTE[i % PALETTE.length]} />
          <text textAnchor="middle" y="5" fontSize="12" fontWeight="700" fill="#0b1418">{c.length > 3 ? `{${c.slice(0, 3).join(',')},…}` : `{${c.join(',')}}`}</text>
        </g>
      ))}
    </svg>
  );
}
