import { useEffect, useMemo, useState } from 'react';
import Visualizer from './components/Visualizer.jsx';
import Learn from './components/Learn.jsx';
import Practice from './components/Practice.jsx';
import Compare from './components/Compare.jsx';
import { IconSun, IconMoon } from './components/Icons.jsx';
import { PRESETS_U, PRESETS_D, encodeShare, decodeShare } from './engine/graphs.js';
import { load, save } from './store.js';

const TABS = [
  ['viz', 'Visualizer'],
  ['learn', 'Learn'],
  ['practice', 'Practice'],
  ['compare', 'Compare'],
  ['about', 'About'],
];

export default function App() {
  const shared = useMemo(() => (typeof location === 'undefined' ? null : decodeShare(location.hash)), []);
  const [tab, setTab] = useState('viz');
  const [mode, setMode] = useState(shared?.mode || 'bcc');
  const [graphs, setGraphs] = useState(() => ({
    u: shared?.u || PRESETS_U[1].make(),
    d: shared?.d || PRESETS_D[0].make(),
  }));
  const [start, setStart] = useState(shared?.start || 0);
  const [theme, setTheme] = useState(() => load('dll-theme', null) || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

  const directed = mode === 'scc';
  const graph = directed ? graphs.d : graphs.u;
  const setGraph = (g) => setGraphs((p) => ({ ...p, [directed ? 'd' : 'u']: g }));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    save('dll-theme', theme);
  }, [theme]);

  // switching between the directed and undirected worlds: keep the starting node valid
  useEffect(() => {
    if (start >= graph.n) setStart(0);
  }, [graph.n, start]);

  const tryIt = (m, presetId) => {
    const list = m === 'scc' ? PRESETS_D : PRESETS_U;
    const p = list.find((x) => x.id === presetId);
    setMode(m);
    if (p) setGraphs((g) => ({ ...g, [m === 'scc' ? 'd' : 'u']: p.make() }));
    setStart(0);
    setTab('viz');
    window.scrollTo({ top: 0 });
  };

  const onShare = async () => {
    const enc = encodeShare({ mode, u: graphs.u, d: graphs.d, start });
    const url = `${location.origin}${location.pathname}#g=${enc}`;
    try {
      await navigator.clipboard.writeText(url);
      history.replaceState(null, '', `#g=${enc}`);
      return true;
    } catch {
      window.prompt('Copy this link:', url);
      return false;
    }
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <svg width="30" height="30" viewBox="0 0 100 100" aria-hidden="true">
            <path d="M25 70L55 30L80 72Z" stroke="var(--accent)" strokeWidth="7" fill="none" strokeLinejoin="round" />
            <circle cx="25" cy="70" r="13" fill="var(--accent)" />
            <circle cx="55" cy="30" r="13" fill="var(--amber)" />
            <circle cx="80" cy="72" r="13" fill="var(--accent)" />
          </svg>
          <div>
            <h1>DFS Low-Link Techniques</h1>
            <span>Articulation Points · Bridges · Biconnected Components · Block-Cut Trees · Strongly Connected Components</span>
          </div>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map(([id, l]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); window.scrollTo({ top: 0 }); }} aria-current={tab === id ? 'page' : undefined}>{l}</button>
          ))}
        </nav>
        <button
          className="themeswitch"
          role="switch"
          aria-checked={theme === 'dark'}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        >
          <span className={`ti ${theme === 'light' ? 'act' : ''}`}><IconSun /></span>
          <span className={`ti ${theme === 'dark' ? 'act' : ''}`}><IconMoon /></span>
          <span className="knob" aria-hidden="true" />
        </button>
      </header>

      <main>
        {tab === 'viz' && <Visualizer mode={mode} setMode={setMode} graph={graph} setGraph={setGraph} start={start} setStart={setStart} onShare={onShare} />}
        {/* Learn and Practice stay mounted while hidden, so progress survives switching tabs but not a refresh */}
        <div hidden={tab !== 'learn'}><Learn onTry={tryIt} /></div>
        <div hidden={tab !== 'practice'}><Practice /></div>
        {tab === 'compare' && <Compare mode={mode} setMode={setMode} graph={graph} setGraph={setGraph} />}
        {tab === 'about' && <About />}
      </main>
    </div>
  );
}

function About() {
  return (
    <div className="about">
      <div className="card">
        <h2>Why this tool exists</h2>
        <p>
          Sorting and shortest-path algorithms have polished visualisers everywhere. The <b>DFS low-link family</b> does not: biconnected components are usually explained with static text, articulation points and bridges are shown in isolation, the block-cut tree is almost never drawn, and nobody shows how the <i>same</i> disc/low bookkeeping powers all of them — including Tarjan's SCC algorithm on directed graphs.
        </p>
        <p>This tool closes that gap by letting you <b>watch</b> one DFS, <b>predict</b> its decisions, <b>edit</b> the graph, and <b>compare</b> every lens side by side.</p>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>What you can do</h3>
          <ul>
            <li><b>Step through</b> each algorithm with live <code>disc / low</code> labels, the DFS call stack, the edge or vertex stack, and highlighted C++.</li>
            <li><b>Predict mode</b>: the player pauses at every decision and asks you what happens next.</li>
            <li><b>What-if</b>: delete a vertex or edge and see the graph split, to verify a result by brute force.</li>
            <li><b>Edit anything</b>: drag, add and delete vertices and edges, paste an edge list, pick the starting node, or load 13 curated presets.</li>
            <li><b>Block-cut tree</b> that grows live as blocks pop.</li>
            <li><b>Learn</b>: ten short lessons with proofs, traps and "try it" buttons.</li>
            <li><b>Practice</b>: a quiz, Trace-it (compute low by hand) and Spot-it (find cut vertices and bridges).</li>
            <li><b>Share</b> any graph as a link.</li>
          </ul>
        </div>
        <div className="card">
          <h3>Keyboard shortcuts (Visualizer)</h3>
          <table className="cmp">
            <tbody>
              <tr><td><kbd>→</kbd> / <kbd>←</kbd></td><td>next / previous step</td></tr>
              <tr><td><kbd>Space</kbd></td><td>play or pause</td></tr>
              <tr><td><kbd>Home</kbd> / <kbd>End</kbd></td><td>restart / jump to the end</td></tr>
            </tbody>
          </table>
          <h3>Correctness</h3>
          <p>
            Every algorithm is written to produce a full step trace, and the traces are tested against brute force and against networkx on hundreds of random graphs (<code>npm test</code>). Parallel edges are handled by skipping the parent <i>edge</i>, not the parent vertex.
          </p>
          <h3>Built with</h3>
          <p>React 18, Vite, hand-written SVG. No runtime dependencies beyond React, so it deploys to Vercel as a static site.</p>
        </div>
      </div>
    </div>
  );
}
