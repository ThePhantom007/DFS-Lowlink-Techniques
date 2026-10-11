import { useEffect, useMemo, useRef, useState } from 'react';
import GraphCanvas, { PALETTE } from './GraphCanvas.jsx';
import BlockCutTree from './BlockCutTree.jsx';
import { IconPlay, IconPause, IconStart, IconEnd, IconBack, IconNext } from './Icons.jsx';
import { CodePanel, StatePanel, Legend } from './Panels.jsx';
import { runTrace, blockCutTree } from '../engine/traces.js';
import { PRESETS_U, PRESETS_D, randomUndirected, randomDirected, parseEdgeList, edgeListText, componentsAfterRemoval, MAX_N } from '../engine/graphs.js';

export const MODES = [
  { id: 'ap', label: 'Articulation points', rule: 'low[v] ≥ disc[u]   (root: ≥ 2 children)', blurb: 'A vertex whose removal disconnects the graph.' },
  { id: 'bridge', label: 'Bridges', rule: 'low[v] > disc[u]   (strictly greater)', blurb: 'An edge whose removal disconnects the graph.' },
  { id: 'bcc', label: 'Biconnected components', rule: 'low[v] ≥ disc[u]  →  pop the edge stack', blurb: 'Maximal edge sets in which any two edges share a cycle.' },
  { id: 'scc', label: 'Strongly connected (Tarjan)', rule: 'low[u] == disc[u]  →  pop the vertex stack', blurb: 'Maximal vertex sets that can all reach each other.' },
];

const TOOLS = [
  ['move', 'Move'],
  ['addv', 'Add Vertex'],
  ['adde', 'Add Edge'],
  ['del', 'Delete'],
  ['whatif', 'What-if'],
];

// One short description per control, shown directly under the toolbar (the active tool, or whatever is hovered / focused).
const HELP = {
  move: ['Move', 'Drag any vertex to rearrange the drawing. Positions never change the algorithm, only how readable the graph is.'],
  addv: ['Add Vertex', 'Click on empty space in the graph to place a new vertex (up to 24). It starts with no edges.'],
  adde: ['Add Edge', 'Click one vertex, then another, to connect them. Duplicate edges are ignored; click empty space to cancel.'],
  adde_d: ['Add Edge', 'Click the vertex the edge starts from, then the vertex it points to. Click empty space to cancel.'],
  del: ['Delete', 'Click a vertex to remove it together with its edges, or click an edge to remove only that edge. The remaining vertices are renumbered.'],
  whatif: ['What-if', 'Click vertices or edges to remove them temporarily and see how many separate pieces the graph breaks into. Click again to restore. A cut vertex or bridge always increases the count.'],
  preset: ['Preset graphs', 'Load a ready-made example that shows one behaviour clearly, such as the root rule, parallel edges or a disconnected graph.'],
  start: ['Start vertex', 'Choose where the DFS begins. It changes the DFS tree and which vertex counts as the root.'],
  random: ['Random', 'Generate a new random graph to experiment with.'],
  edgelist: ['Edge list', 'Show the graph as text, one edge per line like 0-1. Edit it or paste your own, then press Apply.'],
  share: ['Share', 'Copy a link that opens this exact graph and technique.'],
};

// Keyboard shortcuts must not hijack typing, slider/select arrows, or Space on a focused button or checkbox.
const typing = (e) => {
  const t = e.target;
  if (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
  if (t.tagName === 'INPUT') return !(t.type === 'checkbox' && e.key !== ' ');
  if (t.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return true;
  return false;
};

export default function Visualizer({ mode, setMode, graph, setGraph, start, setStart, onShare }) {
  const directed = mode === 'scc';
  const presets = directed ? PRESETS_D : PRESETS_U;
  const info = MODES.find((m) => m.id === mode);

  const [tool, setTool] = useState('move');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [predict, setPredict] = useState(false);
  const [answers, setAnswers] = useState({});
  const [remV, setRemV] = useState(new Set());
  const [remE, setRemE] = useState(new Set());
  const [presetId, setPresetId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [textErr, setTextErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState(null);
  const [pendingV, setPendingV] = useState(null);
  const [glow, setGlow] = useState(false);
  const bctRef = useRef(null);
  const hv = (k) => ({ onMouseEnter: () => setHint(k), onMouseLeave: () => setHint(null), onFocus: () => setHint(k), onBlur: () => setHint(null) });

  const steps = useMemo(() => runTrace(mode, graph, start), [mode, graph.n, graph.edges, start]); // eslint-disable-line
  useEffect(() => {
    setIdx(0);
    setPlaying(false);
    setAnswers({});
    setRemV(new Set());
    setRemE(new Set());
  }, [steps]);
  useEffect(() => {
    if (directed && tool === 'whatif') setTool('move');
  }, [directed, tool]);

  const last = steps.length - 1;
  const step = steps[Math.min(idx, Math.max(last, 0))];
  const needsAnswer = predict && step?.quiz && answers[idx] === undefined;
  const canNext = idx < last && !needsAnswer;

  const next = () => canNext && setIdx((i) => i + 1);
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  useEffect(() => {
    if (!playing) return;
    if (!canNext) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIdx((i) => i + 1), 1300 / speed);
    return () => clearTimeout(t);
  }, [playing, idx, canNext, speed]);

  useEffect(() => {
    const h = (e) => {
      if (typing(e) || e.metaKey || e.ctrlKey) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === 'Home') { e.preventDefault(); setIdx(0); }
      else if (e.key === 'End') { e.preventDefault(); setIdx(last); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  /* ---------- code-line runner ----------
     The highlighted C++ line walks through every line a step executes (loop header, parent check,
     branch, ...). When several steps are skipped at once (scrubber, Home/End, jumps) it replays
     through all of them quickly, so the viewer sees that the program ran in between. */
  const [shown, setShown] = useState(0);
  const [prevShown, setPrevShown] = useState(-1);
  const [replaying, setReplaying] = useState(0);
  const shownRef = useRef(0);
  const prevIdxRef = useRef(0);
  const stepsRef = useRef(steps);
  const timersRef = useRef([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const cur = steps[Math.min(idx, Math.max(last, 0))];
    if (!cur) return undefined;
    const from = prevIdxRef.current;
    const sameTrace = stepsRef.current === steps;
    prevIdxRef.current = idx;
    stepsRef.current = steps;
    const land = (ln) => { setPrevShown(shownRef.current); shownRef.current = ln; setShown(ln); };

    const delta = idx - from;
    if (!sameTrace || delta < 1) {          // new trace, restart, or stepping backwards: jump straight there
      shownRef.current = cur.line;
      setShown(cur.line);
      setPrevShown(-1);
      setReplaying(0);
      return undefined;
    }

    let queue = [];
    let unit;
    if (delta === 1) {
      queue = cur.trail;
      unit = playing ? Math.min(150, Math.max(40, (1300 / speed) * 0.7 / queue.length)) : 130;
      setReplaying(0);
    } else {
      for (let k = from + 1; k <= idx; k++) queue.push(...steps[k].trail);
      queue = queue.filter((x, i) => i === 0 || x !== queue[i - 1]);
      const CAP = 70;
      if (queue.length > CAP) {
        const sampled = [];
        for (let i = 0; i < CAP; i++) sampled.push(queue[Math.floor((i * (queue.length - 1)) / (CAP - 1))]);
        queue = sampled;
      }
      unit = queue.length > 40 ? 28 : 55;
      setReplaying(delta);
    }
    queue.forEach((ln, i) => {
      timersRef.current.push(setTimeout(() => {
        land(ln);
        if (i === queue.length - 1) timersRef.current.push(setTimeout(() => setReplaying(0), 500));
      }, i * unit));
    });
    return () => { timersRef.current.forEach(clearTimeout); };
  }, [idx, steps]); // eslint-disable-line

  const answered = Object.entries(answers).filter(([, v]) => v >= 0);
  const correct = answered.filter(([i, v]) => steps[i]?.quiz?.answer === v).length;

  const changeGraph = (g) => {
    setGraph(g);
    setPresetId(null);
    setPendingV(null);
  };

  const loadPreset = (id) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setGraph(p.make());
    setStart(0);
    setPresetId(id);
    setEditing(false);
  };

  const randomize = () => {
    setGraph(directed ? randomDirected(7, 9 + Math.floor(Math.random() * 4)) : randomUndirected(7 + Math.floor(Math.random() * 3), 1 + Math.floor(Math.random() * 3)));
    setStart(0);
    setPresetId(null);
  };

  const openEditor = () => {
    setText(edgeListText(graph, directed));
    setTextErr('');
    setEditing((e) => !e);
  };
  const applyText = () => {
    const g = parseEdgeList(text, directed);
    if (!g) return setTextErr(`No edges found. Write one per line, like 0-1 (vertices 0 to ${MAX_N - 1}).`);
    setGraph(g);
    setStart(0);
    setPresetId(null);
    setTextErr('');
  };

  const share = async () => {
    const ok = await onShare();
    setCopied(ok);
    setTimeout(() => setCopied(false), 1800);
  };

  /* ---------- what-if removal ---------- */
  const toggle = (setter) => (k) => setter((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const base = useMemo(() => componentsAfterRemoval(graph.n, graph.edges).count, [graph.n, graph.edges]);
  const wi = remV.size || remE.size ? componentsAfterRemoval(graph.n, graph.edges, remV, remE) : null;
  let wiVerdict = '';
  if (wi && remV.size === 1 && remE.size === 0) {
    const v = [...remV][0];
    const isolated = graph.edges.every(([a, b]) => a !== v && b !== v);
    wiVerdict = wi.count > base - (isolated ? 1 : 0) ? `Removing ${v} split the graph — ${v} is an articulation point.` : `Removing ${v} did not split the graph — ${v} is not an articulation point.`;
  } else if (wi && remE.size === 1 && remV.size === 0) {
    const [a, b] = graph.edges[[...remE][0]];
    wiVerdict = wi.count > base ? `Removing ${a}–${b} split the graph — it is a bridge.` : `Removing ${a}–${b} left the graph connected as before — not a bridge.`;
  }

  const canvasTool = tool === 'whatif' ? 'pick' : tool;
  const vOverride = wi ? (v) => (remV.has(v) ? { opacity: 0.3 } : { fill: PALETTE[wi.comp[v] % PALETTE.length] }) : tool === 'whatif' ? () => ({}) : undefined;
  const eOverride = wi ? (i) => { const [a, b] = graph.edges[i]; return remE.has(i) || remV.has(a) || remV.has(b) ? { opacity: 0.18, dash: '3 7' } : null; } : undefined;

  const bct = useMemo(() => (step && mode === 'bcc' ? blockCutTree(step.blocks, graph.edges) : null), [step, mode, graph.edges]);
  // When the biconnected-components run ends, bring the finished block-cut tree into view and make it glow.
  useEffect(() => {
    if (mode !== 'bcc' || last < 1 || idx !== last) return undefined;
    setGlow(true);
    const el = bctRef.current;
    const box = el?.closest('.vright');
    if (el && box && window.getComputedStyle(box).position === 'sticky') {
      // wide layout: scroll only the side panel, so the graph stays where it is
      box.scrollTo?.({ top: Math.max(0, el.offsetTop - (box.clientHeight - el.clientHeight) / 2), behavior: 'smooth' });
    } else {
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }
    const t = setTimeout(() => setGlow(false), 4500);
    return () => { clearTimeout(t); setGlow(false); };
  }, [idx, mode, steps]); // eslint-disable-line

  const hintKey = hint || tool;
  const [helpTitle, helpText] = HELP[hintKey === 'adde' && directed ? 'adde_d' : hintKey] || HELP.move;

  const kindLabel = { ask: 'Question', verdict: 'Verdict', done: 'Done', info: 'Step' }[step?.kind || 'info'];

  if (!step) {
    return (
      <div className="viz">
        <section className="vleft card">
          <div className="toolbar">
            <button onClick={() => setTool('addv')}>Add Vertex</button>
            <select value="" onChange={(e) => loadPreset(e.target.value)}>
              <option value="">Load a preset…</option>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <GraphCanvas graph={graph} directed={directed} tool={tool} onChange={changeGraph} />
        </section>
      </div>
    );
  }

  return (
    <div className="viz">
      <section className="vleft">
        <div className="modebar" role="tablist">
          {MODES.map((m) => (
            <button key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>{m.label}</button>
          ))}
        </div>

        <div className="card">
          <div className="toolbar">
            <div className="seg" role="group" aria-label="Editing tool">
              {TOOLS.filter(([t]) => !(directed && t === 'whatif')).map(([t, l]) => (
                <button key={t} className={tool === t ? 'on' : ''} onClick={() => { setTool(t); setPendingV(null); }} {...hv(t)}>{l}</button>
              ))}
            </div>
            <select aria-label="Preset graphs" value={presetId || ''} onChange={(e) => loadPreset(e.target.value)} {...hv('preset')}>
              <option value="">Preset graphs…</option>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label className="inl" {...hv('start')}>start
              <select value={start} onChange={(e) => setStart(+e.target.value)}>
                {graph.pos.map((_, v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <button onClick={randomize} {...hv('random')}>Random</button>
            <button onClick={openEditor} {...hv('edgelist')}>{editing ? 'Close list' : 'Edge list'}</button>
            <button onClick={share} {...hv('share')}>{copied ? 'Link copied' : 'Share'}</button>
          </div>

          <div className="toolhelp" role="status" aria-live="polite">
            <div><b>{helpTitle}.</b> {helpText}</div>
            {tool === 'adde' && pendingV !== null && <div className="toolnote">Vertex {pendingV} selected. Now click the vertex to {directed ? 'point to' : 'connect it to'}.</div>}
            {tool === 'whatif' && (
              <div className="toolnote">
                {wi ? <>Remaining graph: <b>{wi.count}</b> component{wi.count === 1 ? '' : 's'} (originally {base}). {wiVerdict} <button className="ghost" onClick={() => { setRemV(new Set()); setRemE(new Set()); }}>Restore</button></> : 'Nothing removed yet.'}
              </div>
            )}
          </div>

          {editing && (
            <div className="editor">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} spellCheck={false} aria-label="Edge list" />
              <div>
                <button className="primary" onClick={applyText}>Apply</button>
                <span className="muted"> one edge per line: <code>{directed ? '0->1' : '0-1'}</code>. Repeated lines create parallel edges.</span>
                {textErr && <div className="err">{textErr}</div>}
              </div>
            </div>
          )}

          {presetId && <p className="presetdesc">{presets.find((p) => p.id === presetId)?.desc}</p>}

          <GraphCanvas graph={graph} directed={directed} step={step} mode={mode} tool={canvasTool} onChange={changeGraph} vOverride={vOverride} eOverride={eOverride} onClickV={toggle(setRemV)} onClickE={toggle(setRemE)} pending={pendingV} onPending={setPendingV} />
          <Legend mode={mode} />
        </div>

        <div className="card player">
          <div className="pbtns">
            <button className="icon" onClick={() => setIdx(0)} aria-label="Restart" title="Restart (Home)"><IconStart /></button>
            <button className="icon" onClick={prev} disabled={idx === 0} aria-label="Previous step" title="Previous (←)"><IconBack /></button>
            <button className="primary withicon" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'} title="Play / pause (Space)">{playing ? <><IconPause /> Pause</> : <><IconPlay /> Play</>}</button>
            <button className="icon" onClick={next} disabled={!canNext} aria-label="Next step" title="Next (→)"><IconNext /></button>
            <button className="icon" onClick={() => setIdx(last)} aria-label="Jump to the end" title="End"><IconEnd /></button>
            <label className="inl">speed
              <select value={speed} onChange={(e) => setSpeed(+e.target.value)}>
                <option value={0.5}>0.5×</option>
                <option value={1}>1×</option>
                <option value={2}>2×</option>
                <option value={4}>4×</option>
              </select>
            </label>
            <label className="inl check">
              <input type="checkbox" checked={predict} onChange={(e) => setPredict(e.target.checked)} /> Predict mode
            </label>
          </div>
          <input className="scrub" type="range" min={0} max={last} value={Math.min(idx, last)} onChange={(e) => setIdx(+e.target.value)} aria-label="Step scrubber" />
          <div className="muted small">Step {idx + 1} / {last + 1} &nbsp;·&nbsp; keys: ← → step, Space play, Home / End</div>
        </div>

        <div className={`card narr ${step.kind}`}>
          <div className="narrh"><span className={`badge ${step.kind}`}>{kindLabel}</span></div>
          <p>{step.msg}</p>
        </div>

        {predict && step.quiz && (
          <div className="card quiz">
            <div className="qh">
              <b>Predict the outcome</b>
              <span className="score">{correct} / {answered.length} correct</span>
            </div>
            <div className="qq">{step.quiz.q}</div>
            <div className="qopts">
              {step.quiz.options.map((o, k) => {
                const a = answers[idx];
                const cls = a === undefined ? '' : k === step.quiz.answer ? 'right' : a === k ? 'wrong' : '';
                return <button key={k} className={cls} disabled={a !== undefined} onClick={() => setAnswers((s) => ({ ...s, [idx]: k }))}>{o}</button>;
              })}
            </div>
            {answers[idx] === undefined ? (
              <button className="ghost" onClick={() => setAnswers((s) => ({ ...s, [idx]: -1 }))}>Skip question</button>
            ) : (
              <div className={`qwhy ${answers[idx] === step.quiz.answer ? 'ok' : 'no'}`}>
                {answers[idx] === -1 ? 'Skipped. ' : answers[idx] === step.quiz.answer ? 'Correct. ' : 'Not quite. '}
                {step.quiz.why} <span className="muted">Press → for the verdict.</span>
              </div>
            )}
          </div>
        )}
      </section>

      <aside className="vright">
        <div className="card">
          <div className="cardh">Live state</div>
          <StatePanel mode={mode} step={step} graph={graph} />
        </div>
        <div className="card">
          <div className="cardh">
            C++ — highlighted line is the one running
            {replaying > 0 && <span className="ffwd">Replaying {replaying} steps</span>}
          </div>
          <CodePanel mode={mode} line={shown} prev={prevShown} fast={replaying > 0} />
        </div>
        {bct && (
          <div ref={bctRef} className={`card ${glow ? 'glow' : ''}`}>
            <div className="cardh">
              Block-cut tree (grows as blocks are popped)
              {glow && <span className="ffwd">Complete</span>}
            </div>
            <BlockCutTree bct={bct} />
            <p className="muted small">Rectangles are blocks, dashed circles are cut vertices. Blocks only touch through cut vertices, so the result is always a tree (or forest).</p>
          </div>
        )}
        <div className="card">
          <div className="cardh">{info.label}</div>
          <p className="blurb">{info.blurb}</p>
          <code className="rule">{info.rule}</code>
        </div>
      </aside>
    </div>
  );
}
