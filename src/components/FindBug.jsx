import { useMemo, useState } from 'react';
import GraphCanvas from './GraphCanvas.jsx';
import { LangToggle, Syntax } from './Panels.jsx';
import { BUGS, functionLines } from '../engine/code.js';
import { compareBug, findCounterexample } from '../engine/bugs.js';

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const TASK = {
  ap: 'find the articulation points (cut vertices) of an undirected graph',
  bridge: 'find the bridges of an undirected graph',
  bcc: 'split an undirected graph into biconnected components using an edge stack',
  scc: "find the strongly connected components of a directed graph (Tarjan's algorithm)",
};

// Every puzzle is a real bug from "Break the algorithm" applied to a real listing, in the language the student picks.
const ALL = Object.keys(BUGS).flatMap((bug) => BUGS[bug].modes.map((mode) => ({ bug, mode })));
const ROUND = 8;
const buildDeck = () => shuffle(ALL).slice(0, ROUND);
const isCode = (ln) => ln.trim() !== '' && !/^\s*(\/\/|#)/.test(ln) && !/^\s*[{}]\s*$/.test(ln);

export default function FindBug({ lang, setLang, onOpenGraph }) {
  const [deck, setDeck] = useState(buildDeck);
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [hint, setHint] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [streak, setStreak] = useState(0);
  const done = i >= deck.length;
  const pz = deck[Math.min(i, deck.length - 1)];

  const fn = useMemo(() => functionLines(pz.mode, lang, pz.bug), [pz, lang]);
  const demo = useMemo(() => {
    const g = findCounterexample(pz.mode, pz.bug);
    return g ? { g, c: compareBug(pz.mode, g, 0, pz.bug) } : null;
  }, [pz]);

  const answered = chosen !== null;
  const right = answered && chosen === fn.primary;
  const pick = (k) => {
    if (answered || !isCode(fn.lines[k])) return;
    setChosen(k);
    if (k === fn.primary) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
    } else setStreak(0);
  };
  const next = () => {
    const ni = i + 1;
    setI(ni);
    setChosen(null);
    setHint(false);
    if (ni >= deck.length) setBest((b) => Math.max(b, score));
  };
  const restart = () => { setDeck(buildDeck()); setI(0); setChosen(null); setHint(false); setScore(0); setStreak(0); };

  if (done) {
    return (
      <div className="card center">
        <h3>Round complete</h3>
        <div className="bigscore">{score} / {deck.length}</div>
        <p className="muted">Best this session: {Math.max(best, score)} / {deck.length}. Each of these mistakes can be switched on in the Visualizer ("Break the algorithm") to watch it fail step by step.</p>
        <button className="primary" onClick={restart}>New round</button>
      </div>
    );
  }

  const info = BUGS[pz.bug];
  return (
    <div className="card findbug">
      <div className="qh"><b>Puzzle {i + 1} of {deck.length}</b><span className="score">score {score} · streak {streak}</span></div>
      <div className="progbar"><i style={{ width: `${(i / deck.length) * 100}%` }} /></div>
      <div className="toolbar">
        <h3 className="qtext" style={{ margin: 0 }}>This function is meant to {TASK[pz.mode]}. Exactly one line is wrong. Click it.</h3>
        <span style={{ marginLeft: 'auto' }}><LangToggle lang={lang} setLang={setLang} /></span>
      </div>

      <div className="code puzzle" role="group" aria-label="Code with one mistake">
        {fn.lines.map((ln, k) => {
          const cls = answered ? (k === fn.primary ? 'rightline' : k === chosen ? 'wrongline' : '') : '';
          const clickable = !answered && isCode(ln);
          return (
            <div key={k} className={`cl pick ${cls} ${clickable ? 'can' : ''}`} onClick={() => pick(k)} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick(k))} aria-label={clickable ? `Line ${k + 1}` : undefined}>
              <span className="ln">{k + 1}</span>
              <span className="src"><Syntax text={ln || ' '} lang={lang} /></span>
              {answered && k === fn.primary && <span className="bugtag">BUG</span>}
            </div>
          );
        })}
      </div>

      {!answered && (
        <div className="pbtns">
          <button onClick={() => setHint(true)} disabled={hint}>Show a symptom</button>
          {hint && demo && (
            <span className="muted">
              On a graph with edges <code>{demo.g.edges.map(([a, b]) => `${a}${pz.mode === 'scc' ? '→' : '-'}${b}`).join(' ')}</code> this code reports <b>{demo.c.bad.items.join(', ') || 'nothing'}</b> but the right answer is <b>{demo.c.good.items.join(', ') || 'nothing'}</b>.
            </span>
          )}
        </div>
      )}

      {answered && (
        <>
          <div className={`qwhy ${right ? 'ok' : 'no'}`}>
            <b>{right ? 'Correct.' : chosen in fn.bugLines ? 'Close, but not that one.' : 'Not that line.'}</b>{' '}
            {!right && chosen in fn.bugLines ? `Line ${chosen + 1} was edited to match the bug, but the faulty decision is on line ${fn.primary + 1}. ` : !right ? `The mistake is on line ${fn.primary + 1}. ` : ''}
            {info.why}
            <div className="diff">
              <div className="drow del"><span className="dsign">−</span><span className="dln">{fn.primary + 1}</span><code><Syntax text={fn.lines[fn.primary].trim()} lang={lang} /></code></div>
              <div className="drow add"><span className="dsign">+</span><span className="dln">{fn.primary + 1}</span><code><Syntax text={(fn.bugLines[fn.primary] ?? '').trim()} lang={lang} /></code></div>
            </div>
            <p style={{ margin: '8px 0 0' }}><b>Fix:</b> {info.fix} (the red line is what the puzzle showed; the green one is correct.)</p>
          </div>

          {demo && (
            <div className="demo">
              <div className="stitle">Watch it fail on a real graph</div>
              <div className="demogrid">
                <div className="democ"><GraphCanvas graph={demo.g} directed={pz.mode === 'scc'} step={demo.c.steps.at(-1)} mode={pz.mode} tool="none" /></div>
                <div>
                  <div className="stitle">Correct — {demo.c.good.title}</div>
                  <div className="chips">{demo.c.good.items.length ? demo.c.good.items.map((x, k) => <span key={k} className="chip" style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>{x}</span>) : <span className="muted">none</span>}</div>
                  <div className="stitle">With the bug</div>
                  <div className="chips">{demo.c.bad.items.length ? demo.c.bad.items.map((x, k) => <span key={k} className="chip" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{x}</span>) : <span className="muted">none</span>}</div>
                  <p className="muted small">The graph drawing shows the buggy run's final state.</p>
                  <button className="primary" onClick={() => onOpenGraph(pz.mode, demo.g, pz.bug)}>Step through it in the Visualizer</button>
                </div>
              </div>
            </div>
          )}
          <button className="primary" onClick={next}>{i === deck.length - 1 ? 'Finish' : 'Next puzzle →'}</button>
        </>
      )}
    </div>
  );
}
