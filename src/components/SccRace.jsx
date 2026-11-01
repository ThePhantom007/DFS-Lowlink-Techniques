import { useEffect, useMemo, useRef, useState } from 'react';
import { ALGOS, raceGraph, drain, newState } from '../engine/sccRace.js';

const SIZES = [20, 40, 60, 100, 200, 400];
const fmt = (x) => x.toLocaleString();
const fmtMs = (x) => (x >= 1000 ? `${(x / 1000).toFixed(2)} s` : x >= 10 ? `${x.toFixed(0)} ms` : x >= 0.1 ? `${x.toFixed(2)} ms` : `${(x * 1000).toFixed(0)} µs`);
const fmtSec = (s) => (s >= 3600 ? `${(s / 3600).toFixed(1)} hours` : s >= 120 ? `${(s / 60).toFixed(1)} minutes` : `${s.toFixed(s >= 10 ? 0 : 1)} seconds`);

const blank = () => ALGOS.map(() => ({ ops: 0, found: 0, phase: 'waiting', progress: 0, doneAt: null }));

/* A live race: the three algorithms run side by side, one generator each, advanced by the same number of
   operations per frame. A bar shows how much work each has done on one shared scale, so the slow one keeps going
   long after the fast ones have stopped. */
export default function SccRace() {
  const [n, setN] = useState(60);
  const [speed, setSpeed] = useState('lapse'); // lapse: slowest takes about 10 s. slow: fastest takes about 3 s.
  const [run, setRun] = useState('idle'); // idle | running | paused | done
  const [lanes, setLanes] = useState(blank);
  const [clock, setClock] = useState(0);

  // Totals are measured up front (one silent run of each algorithm) so the bars can use one shared scale.
  const prep = useMemo(() => {
    const g = raceGraph(n);
    const totals = ALGOS.map((a) => drain(a.make, g.n, g.edges));
    return { g, totals, max: Math.max(...totals.map((t) => t.ops)), min: Math.min(...totals.map((t) => t.ops)) };
  }, [n]);

  const gens = useRef(null);
  const states = useRef(null);
  const clockRef = useRef(0);
  const doneAt = useRef([null, null, null]);
  const raf = useRef(0);
  const runRef = useRef(run);
  runRef.current = run;

  const perFrame = speed === 'lapse' ? Math.max(1, Math.ceil(prep.max / 600)) : Math.max(1, Math.ceil(prep.min / 180));

  const publish = () => {
    setLanes(states.current.map((s, i) => ({ ops: s.ops, found: s.found, phase: s.phase, progress: s.progress, doneAt: doneAt.current[i] })));
    setClock(clockRef.current);
  };

  const stop = () => cancelAnimationFrame(raf.current);

  const begin = () => {
    stop();
    states.current = ALGOS.map(() => newState());
    gens.current = ALGOS.map((a, i) => a.make(prep.g.n, prep.g.edges, states.current[i]));
    clockRef.current = 0;
    doneAt.current = [null, null, null];
    setRun('running');
    runRef.current = 'running';
    publish();
    raf.current = requestAnimationFrame(tick);
  };

  // The clock counts operations, the same unit as the totals: each algorithm runs until it has done as many as the clock says.
  const advance = (steps) => {
    clockRef.current += steps;
    gens.current.forEach((g, i) => {
      if (doneAt.current[i] !== null) return;
      const st = states.current[i];
      while (st.ops < clockRef.current) {
        const r = g.next();
        if (r.done) {
          doneAt.current[i] = st.ops;
          break;
        }
      }
    });
  };

  const tick = () => {
    if (runRef.current !== 'running') return;
    advance(perFrame);
    publish();
    if (doneAt.current.every((d) => d !== null)) {
      setRun('done');
      runRef.current = 'done';
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };

  const pause = () => { stop(); setRun('paused'); runRef.current = 'paused'; };
  const resume = () => { setRun('running'); runRef.current = 'running'; raf.current = requestAnimationFrame(tick); };
  const skip = () => {
    stop();
    if (!gens.current) begin();
    stop();
    while (!doneAt.current.every((d) => d !== null)) advance(Math.max(1000, perFrame));
    publish();
    setRun('done');
    runRef.current = 'done';
  };
  const reset = () => { stop(); gens.current = null; setLanes(blank()); setClock(0); setRun('idle'); runRef.current = 'idle'; };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  // changing the size or the speed restarts from a clean slate
  useEffect(() => { reset(); }, [n]); // eslint-disable-line

  const finished = run === 'done';
  const tj = prep.totals[2];
  const tarjanSec = 1; // the "if Tarjan took one second" scale
  const winnerDone = lanes[2].doneAt;

  return (
    <div className="race">
      <div className="card intro">
        <h2>Race: three ways to find strongly connected components</h2>
        <p>
          All three run on the same random directed graph ({prep.g.n} vertices, {prep.g.edges.length} edges), advanced by the same number of steps per frame. One step is one vertex visited, one edge examined or one pair compared. Watch which ones stop first.
        </p>
        <div className="toolbar">
          <label className="inl">Vertices
            <select value={n} onChange={(e) => setN(+e.target.value)} aria-label="Number of vertices in the race graph" disabled={run === 'running'}>
              {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="seg" role="group" aria-label="Playback speed">
            <button className={speed === 'lapse' ? 'on' : ''} onClick={() => { setSpeed('lapse'); reset(); }} disabled={run === 'running'}>Time-lapse</button>
            <button className={speed === 'slow' ? 'on' : ''} onClick={() => { setSpeed('slow'); reset(); }} disabled={run === 'running'}>Slow motion</button>
          </div>
          {run === 'idle' && <button className="primary" onClick={begin}>Start the race</button>}
          {run === 'running' && <button onClick={pause}>Pause</button>}
          {run === 'paused' && <button className="primary" onClick={resume}>Resume</button>}
          {(run === 'running' || run === 'paused') && <button onClick={skip}>Skip to the end</button>}
          {run !== 'idle' && <button onClick={reset}>Reset</button>}
          <span className="raceclock" aria-hidden="true">step {fmt(clock)}</span>
        </div>
        <p className="muted small">
          {speed === 'lapse' ? 'Time-lapse: the slowest algorithm takes about ten seconds, so the fast ones are over almost at once.' : 'Slow motion: the fastest algorithm takes about three seconds. The naive one will take far longer, use “Skip to the end” whenever you like.'}
        </p>
      </div>

      <div className="card">
        <div className="cardh">Work done, on one shared scale (full bar = the naive total, {fmt(prep.max)} steps)</div>
        <div className="lanes">
          {ALGOS.map((a, i) => {
            const L = lanes[i];
            const total = prep.totals[i].ops;
            const pctShared = Math.min(100, (L.ops / prep.max) * 100);
            const isDone = L.doneAt !== null;
            return (
              <div className={`lane ${isDone ? 'done' : ''}`} key={a.id} style={{ '--lc': a.color }}>
                <div className="lanehead">
                  <b><i className="ldot" />{a.name}</b>
                  <code>{a.big}</code>
                  <span className={`lstat ${isDone ? 'ok' : run === 'running' ? 'run' : ''}`}>
                    {isDone ? `✓ finished at step ${fmt(L.doneAt)}` : run === 'idle' ? 'ready' : run === 'paused' ? 'paused' : 'still working…'}
                  </span>
                </div>
                <div className="track" role="progressbar" aria-label={`${a.name}: work done as a share of the naive total`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pctShared)}>
                  <div className="fill" style={{ width: `${pctShared}%` }} />
                  <span className="endmark" style={{ left: `${Math.min(100, (total / prep.max) * 100)}%` }} aria-hidden="true" title={`${a.name} needs ${fmt(total)} steps in total`} />
                </div>
                <div className="own" aria-hidden="true"><div style={{ width: `${(isDone ? 1 : L.progress) * 100}%` }} /></div>
                <div className="lanefoot">
                  <span>steps <b>{fmt(L.ops)}</b></span>
                  <span>components found <b>{L.found}</b></span>
                  <span className="muted">{isDone ? 'done' : L.phase}</span>
                </div>
                <p className="muted small laneblurb">{a.blurb}</p>
              </div>
            );
          })}
        </div>
        <p className="muted small">The thin bar under each track is that algorithm's own progress. The tick on the track marks where it will finish.</p>
      </div>

      {finished && (
        <div className="card" role="status">
          <div className="cardh">Result</div>
          <p className="takeaway">
            Tarjan finished at step <b>{fmt(winnerDone)}</b>. Kosaraju needed <b>{fmt(prep.totals[1].ops)}</b> ({(prep.totals[1].ops / tj.ops).toFixed(1)}× as many) and the naive method <b>{fmt(prep.totals[0].ops)}</b> (<b>{(prep.totals[0].ops / tj.ops).toFixed(0)}×</b>). If Tarjan took {tarjanSec} second, the naive method would take about <b>{fmtSec((prep.totals[0].ops / tj.ops) * tarjanSec)}</b> on this graph. All three found the same <b>{tj.count}</b> components.
          </p>
          <div className="tablewrap">
            <table className="cmp">
              <thead><tr><th>Algorithm</th><th>Steps</th><th>Compared with Tarjan</th><th>Measured time</th><th>Components</th></tr></thead>
              <tbody>
                {ALGOS.map((a, i) => (
                  <tr key={a.id}>
                    <td><b>{a.name}</b></td><td>{fmt(prep.totals[i].ops)}</td><td>{(prep.totals[i].ops / tj.ops).toFixed(1)}×</td><td>{fmtMs(prep.totals[i].ms)}</td><td>{prep.totals[i].count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Steps are exact and machine independent. Measured time depends on your browser. Try a larger graph and the gap widens: naive grows like V², the other two like V.</p>
        </div>
      )}
    </div>
  );
}
