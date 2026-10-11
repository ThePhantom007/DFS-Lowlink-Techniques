import { useMemo, useState } from 'react';
import GraphCanvas from './GraphCanvas.jsx';
import { QUIZ } from '../data/practice.js';
import { runTrace } from '../engine/traces.js';
import { randomUndirected } from '../engine/graphs.js';

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const SUBS = [
  ['quiz', 'Quiz'],
  ['trace', 'Trace it'],
  ['spot', 'Spot it'],
];

export default function Practice() {
  const [sub, setSub] = useState('quiz');
  return (
    <div className="practice">
      <div className="modebar" role="tablist">
        {SUBS.map(([id, l]) => (
          <button key={id} role="tab" aria-selected={sub === id} className={sub === id ? 'on' : ''} onClick={() => setSub(id)}>{l}</button>
        ))}
      </div>
      {sub === 'quiz' && <Quiz />}
      {sub === 'trace' && <TraceIt />}
      {sub === 'spot' && <SpotIt />}
    </div>
  );
}

/* ------------------------------ Quiz ------------------------------ */
function buildDeck(n = 10) {
  return shuffle(QUIZ).slice(0, n).map((q) => {
    const opts = shuffle(q.o.map((text, i) => ({ text, ok: i === q.a })));
    return { q: q.q, w: q.w, opts, a: opts.findIndex((o) => o.ok) };
  });
}

function Quiz() {
  const [deck, setDeck] = useState(() => buildDeck());
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const done = i >= deck.length;

  const pick = (k) => {
    if (chosen !== null) return;
    setChosen(k);
    if (k === deck[i].a) setScore((s) => s + 1);
  };
  const next = () => {
    const ni = i + 1;
    setI(ni);
    setChosen(null);
    if (ni >= deck.length && score > best) {
      setBest(score);
    }
  };
  const restart = () => { setDeck(buildDeck()); setI(0); setChosen(null); setScore(0); };

  if (done) {
    return (
      <div className="card center">
        <h3>Quiz complete</h3>
        <div className="bigscore">{score} / {deck.length}</div>
        <p className="muted">Best score: {Math.max(best, score)} / {deck.length}. {score === deck.length ? 'Flawless — try the Trace-it drill next.' : 'Review the lessons for anything you missed, then go again.'}</p>
        <button className="primary" onClick={restart}>New quiz</button>
      </div>
    );
  }
  const q = deck[i];
  return (
    <div className="card quizcard">
      <div className="qh"><b>Question {i + 1} of {deck.length}</b><span className="score">score {score}</span></div>
      <div className="progbar"><i style={{ width: `${(i / deck.length) * 100}%` }} /></div>
      <h3 className="qtext">{q.q}</h3>
      <div className="qopts col">
        {q.opts.map((o, k) => {
          const cls = chosen === null ? '' : k === q.a ? 'right' : chosen === k ? 'wrong' : '';
          return <button key={k} className={cls} disabled={chosen !== null} onClick={() => pick(k)}>{o.text}</button>;
        })}
      </div>
      {chosen !== null && (
        <>
          <div className={`qwhy ${chosen === q.a ? 'ok' : 'no'}`}>{chosen === q.a ? 'Correct. ' : 'Not quite. '}{q.w}</div>
          <button className="primary" onClick={next}>{i === deck.length - 1 ? 'Finish' : 'Next question →'}</button>
        </>
      )}
    </div>
  );
}

/* ------------------------------ Spot it ----------------------------- */
const makeSpot = () => randomUndirected(7 + Math.floor(Math.random() * 3), 1 + Math.floor(Math.random() * 3));

function SpotIt() {
  const [kind, setKind] = useState('ap');
  const [graph, setGraph] = useState(makeSpot);
  const [selV, setSelV] = useState(new Set());
  const [selE, setSelE] = useState(new Set());
  const [result, setResult] = useState(null);
  const [streak, setStreak] = useState(0);

  const truth = useMemo(() => {
    const f = runTrace(kind, graph, 0).at(-1);
    return { v: new Set(f.aps), e: new Set(f.bridges) };
  }, [kind, graph]);

  const reset = (g = makeSpot(), k = kind) => { setGraph(g); setKind(k); setSelV(new Set()); setSelE(new Set()); setResult(null); };
  const toggle = (setter) => (k) => !result && setter((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const check = () => {
    const sel = kind === 'ap' ? selV : selE;
    const want = kind === 'ap' ? truth.v : truth.e;
    const ok = [...sel].filter((x) => want.has(x));
    const wrong = [...sel].filter((x) => !want.has(x));
    const missed = [...want].filter((x) => !sel.has(x));
    const perfect = wrong.length === 0 && missed.length === 0;
    setStreak((s) => (perfect ? s + 1 : 0));
    setResult({ ok: new Set(ok), wrong: new Set(wrong), missed: new Set(missed), perfect });
  };

  const mark = (set, k) => (result ? (result.ok.has(k) ? 'var(--green)' : result.wrong.has(k) ? 'var(--red)' : result.missed.has(k) ? 'var(--amber)' : null) : set.has(k) ? 'var(--blue)' : null);
  const vOverride = (v) => (kind === 'ap' ? { ring: mark(selV, v) } : {});
  const eOverride = (i) => {
    if (kind !== 'bridge') return null;
    const c = mark(selE, i);
    return c ? { stroke: c, width: 6 } : null;
  };
  const count = kind === 'ap' ? truth.v.size : truth.e.size;

  return (
    <div className="card">
      <div className="toolbar">
        <div className="seg">
          <button className={kind === 'ap' ? 'on' : ''} onClick={() => reset(graph, 'ap')}>Find articulation points</button>
          <button className={kind === 'bridge' ? 'on' : ''} onClick={() => reset(graph, 'bridge')}>Find bridges</button>
        </div>
        <button onClick={() => reset()}>New graph</button>
        <span className="score">streak {streak}</span>
      </div>
      <p className="muted">Click every {kind === 'ap' ? 'vertex' : 'edge'} you think is {kind === 'ap' ? 'an articulation point' : 'a bridge'}, then press Check. The vertex numbers are shown; no DFS is running — use your head (or sketch the DFS tree).</p>
      <GraphCanvas graph={graph} tool="pick" onClickV={kind === 'ap' ? toggle(setSelV) : undefined} onClickE={kind === 'bridge' ? toggle(setSelE) : undefined} vOverride={vOverride} eOverride={eOverride} />
      <div className="pbtns">
        <button className="primary" onClick={check} disabled={!!result}>Check</button>
        <span className="muted">Selected: {(kind === 'ap' ? selV : selE).size}{result ? '' : ` · hint: there ${count === 1 ? 'is' : 'are'} ${count}`}</span>
      </div>
      {result && (
        <div className={`qwhy ${result.perfect ? 'ok' : 'no'}`}>
          {result.perfect ? 'Perfect!' : `${result.ok.size} correct, ${result.wrong.size} wrong, ${result.missed.size} missed.`} Green = correct, red = wrong, amber = missed.
          {!result.perfect && ' Remember: non-root low[v] ≥ disc[u] for cut vertices, low[v] > disc[u] for bridges, and the root needs two DFS children.'}
          <div><button className="primary" onClick={() => reset()}>Next graph</button></div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Trace it ---------------------------- */
const makeTrace = () => {
  const g = randomUndirected(6 + Math.floor(Math.random() * 2), 2);
  const final = runTrace('ap', g, 0).at(-1);
  return { g, final, view: { ...final, aps: [], bridges: [], cur: -1, hl: -1, vstate: final.vstate.map(() => 2) } };
};

function TraceIt() {
  const [t, setT] = useState(makeTrace);
  const [vals, setVals] = useState({});
  const [checked, setChecked] = useState(false);

  const fresh = () => { setT(makeTrace()); setVals({}); setChecked(false); };
  const right = (v) => String(t.final.low[v]) === String(vals[v] ?? '').trim();
  const nRight = t.g.pos.filter((_, v) => right(v)).length;

  return (
    <div className="card">
      <p className="muted">
        A DFS from vertex 0 has already run (neighbours are visited in edge-creation order). Each vertex shows its <b>disc</b>. Teal solid edges are tree edges, violet dashed edges are back edges.
        Work out <b>low[v]</b> for every vertex, starting from the leaves. Remember: low[u] = min(disc[u], disc[w] over back edges, low[child]).
      </p>
      <GraphCanvas graph={t.g} step={t.view} mode="ap" labelMode="disc" />
      <div className="tracegrid">
        {t.g.pos.map((_, v) => (
          <label key={v} className={checked ? (right(v) ? 'good' : 'bad') : ''}>
            low[{v}]
            <input inputMode="numeric" value={vals[v] ?? ''} onChange={(e) => setVals((s) => ({ ...s, [v]: e.target.value.replace(/[^0-9]/g, '') }))} disabled={checked} aria-label={`low of vertex ${v}`} />
            {checked && !right(v) && <span className="ans">= {t.final.low[v]}</span>}
          </label>
        ))}
      </div>
      <div className="pbtns">
        <button className="primary" onClick={() => setChecked(true)} disabled={checked}>Check</button>
        <button onClick={() => { setVals(Object.fromEntries(t.final.low.map((l, v) => [v, String(l)]))); setChecked(true); }}>Reveal</button>
        <button onClick={fresh}>New graph</button>
        {checked && <span className="score">{nRight} / {t.g.n} correct</span>}
      </div>
    </div>
  );
}
