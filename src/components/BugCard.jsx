import { BUGS, bugsFor, getCode } from '../engine/code.js';
import { Syntax } from './Panels.jsx';

const Chips = ({ items, color, empty = 'none' }) => (
  <div className="chips">
    {items.length === 0 ? <span className="muted">{empty}</span> : items.map((s, i) => <span key={i} className="chip" style={color ? { borderColor: color, color } : undefined}>{s}</span>)}
  </div>
);

/* "Break the algorithm": switch on a classic mistake and compare its answer with the correct one. */
export default function BugCard({ mode, lang, bug, setBug, cmp, idx, setIdx, onLoadBreaker, breakerAvailable }) {
  const options = bugsFor(mode);
  const on = !!bug;
  const info = on ? BUGS[bug] : null;
  const code = on ? getCode(mode, lang, bug) : null;
  const reached = cmp && cmp.first >= 0 && idx >= cmp.first;

  return (
    <div className={`card bugcard ${on ? 'on' : ''}`}>
      <div className="bughead">
        <label className="switchrow">
          <input type="checkbox" role="switch" checked={on} onChange={(e) => setBug(e.target.checked ? options[0] : null)} aria-label="Break the algorithm" />
          <span className="sw" aria-hidden="true"><i /></span>
          <b>Break the algorithm</b>
        </label>
        <span className="muted small">Inject a classic mistake and run it against the correct version.</span>
      </div>

      {on && info && cmp && (
        <div className="bugbody">
          <div className="bugsel">
            <label className="inl">Mistake
              <select value={bug} onChange={(e) => setBug(e.target.value)} aria-label="Which mistake to inject">
                {options.map((k) => <option key={k} value={k}>{BUGS[k].label}</option>)}
              </select>
            </label>
            <span className="bugshort">{info.short}</span>
          </div>

          <div className="diff" aria-label="The changed line">
            {Object.entries(code.bugLines).map(([i, correct]) => (
              <div key={i}>
                <div className="drow del"><span className="dsign">−</span><span className="dln">{+i + 1}</span><code><Syntax text={correct.trim()} lang={lang} /></code></div>
                <div className="drow add"><span className="dsign">+</span><span className="dln">{+i + 1}</span><code><Syntax text={code.lines[i].trim()} lang={lang} /></code></div>
              </div>
            ))}
          </div>

          {cmp.wrong ? (
            <div className="verdictbox bad" role="status">
              <b>Wrong answer.</b> The buggy code ends with a different result from the correct one.
              <div className="cmpgrid">
                <div><div className="stitle">Correct — {cmp.good.title}</div><Chips items={cmp.good.items} color="var(--green)" /></div>
                <div><div className="stitle">Buggy — {cmp.bad.title}</div><Chips items={cmp.bad.items} color="var(--red)" /></div>
              </div>
              {(cmp.missed.length > 0 || cmp.extra.length > 0) && (
                <div className="muted small">
                  {cmp.missed.length > 0 && <>Missed: <b>{cmp.missed.join(', ')}</b>. </>}
                  {cmp.extra.length > 0 && <>Falsely reported: <b>{cmp.extra.join(', ')}</b>. </>}
                  {(mode === 'ap' || mode === 'bridge') && cmp.missedIds.length > 0 && 'Missed items are drawn in amber on the graph once the run reaches its end.'}
                </div>
              )}
            </div>
          ) : (
            <div className="verdictbox warn" role="status">
              <b>This graph does not expose the bug.</b> The mistake is on the page but its effect is harmless here, so both versions give the same answer
              {cmp.first >= 0 ? ' (the line still behaves differently at the steps marked in red).' : '.'}
              {breakerAvailable && <> <button className="primary" onClick={onLoadBreaker}>Load a graph that breaks it</button></>}
            </div>
          )}

          <div className="pbtns">
            {cmp.first >= 0 && <button className={reached ? '' : 'primary'} onClick={() => setIdx(cmp.first)}>Jump to the first divergence (step {cmp.first + 1})</button>}
            <button onClick={() => setIdx(0)}>Restart the buggy run</button>
          </div>

          <details className="bugwhy">
            <summary>Why does this go wrong? (the examiner's question)</summary>
            <p>{info.why}</p>
            <p><b>Fix:</b> {info.fix}</p>
          </details>
        </div>
      )}
    </div>
  );
}
