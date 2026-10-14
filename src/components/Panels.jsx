import { Fragment, useEffect, useRef } from 'react';
import { getCode, LANGS } from '../engine/code.js';
import { PALETTE } from './GraphCanvas.jsx';

const KW = {
  cpp: /^(?:int|void|for|if|else|while|return|continue|break|auto|const|bool|true|false|using|namespace|vector|pair|stack|struct)$/,
  py: /^(?:def|for|in|if|elif|else|while|return|continue|break|global|True|False|import|not|and|or|None)$/,
  java: /^(?:int|void|for|if|else|while|return|continue|break|static|class|public|boolean|true|false|new|import|final)$/,
};
const TOKENS = {
  cpp: /(\/\/.*$)|(#include.*$)|(\b\d+\b)|(\b[A-Za-z_]\w*\b)/g,
  java: /(\/\/.*$)|(\bimport\b.*$)|(\b\d+\b)|(\b[A-Za-z_]\w*\b)/g,
  py: /(#.*$)|(\bimport\b.*$)|(\b\d+\b)|(\b[A-Za-z_]\w*\b)/g,
};
export function Syntax({ text, lang = 'cpp' }) {
  const parts = [];
  const re = new RegExp(TOKENS[lang].source, 'g');
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<span key={m.index} className="cm">{m[1]}</span>);
    else if (m[2]) parts.push(<span key={m.index} className="pp">{m[2]}</span>);
    else if (m[3]) parts.push(<span key={m.index} className="num">{m[3]}</span>);
    else if (KW[lang].test(m[4])) parts.push(<span key={m.index} className="kw">{m[4]}</span>);
    else if (text[re.lastIndex] === '(') parts.push(<span key={m.index} className="fnc">{m[4]}</span>);
    else parts.push(m[4]);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export function LangToggle({ lang, setLang }) {
  return (
    <div className="seg langseg" role="group" aria-label="Code language">
      {LANGS.map(([id, label]) => (
        <button key={id} className={lang === id ? 'on' : ''} aria-pressed={lang === id} onClick={() => setLang(id)}>{label}</button>
      ))}
    </div>
  );
}

export function CodePanel({ mode, lang = 'cpp', bug = null, line, prev = -1, fast = false }) {
  const { lines, bugLines } = getCode(mode, lang, bug);
  const ref = useRef(null);
  useEffect(() => {
    const box = ref.current;
    const el = box?.querySelector('.hl');
    if (!el) return;
    // only scroll when the running line leaves the visible band, so the view stays calm
    const margin = 44;
    const top = el.offsetTop;
    const bottom = top + el.clientHeight;
    if (top < box.scrollTop + margin || bottom > box.scrollTop + box.clientHeight - margin) {
      box.scrollTo({ top: Math.max(0, top - box.clientHeight / 2), behavior: fast ? 'auto' : 'smooth' });
    }
  }, [line, mode, fast, lang]);
  const langName = LANGS.find(([id]) => id === lang)[1];
  return (
    <div className="code" ref={ref} tabIndex={0} aria-label={`${langName} source, current line highlighted`}>
      {lines.map((ln, i) => (
        <Fragment key={i}>
          <div className={`cl ${i === line ? 'hl' : i === prev ? 'was' : ''} ${i in bugLines ? 'bugl' : ''}`}>
            <span className="ln">{i + 1}</span>
            <span className="src"><Syntax text={ln || ' '} lang={lang} /></span>
            {i in bugLines && <span className="bugtag">BUG</span>}
          </div>
          {i in bugLines && (
            <div className="cl fixl">
              <span className="ln">✓</span>
              <span className="src"><Syntax text={bugLines[i] || ' '} lang={lang} /></span>
              <span className="bugtag ok">correct</span>
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}

const STATE_LABEL = ['unvisited', 'on DFS path', 'finished'];

export function StatePanel({ mode, step, graph }) {
  if (!step) return null;
  const e = graph.edges;
  const ename = (id) => `${e[id][0]}${mode === 'scc' ? '→' : '–'}${e[id][1]}`;
  const stackTitle = mode === 'bcc' ? 'Edge stack (top →)' : mode === 'scc' ? "Tarjan's stack (top →)" : 'DFS call stack (top →)';
  const stackItems = mode === 'bcc' ? step.stack.map(ename) : mode === 'scc' ? step.stack.map(String) : step.callStack.map(String);

  return (
    <div className="state">
      <div className="tablewrap">
        <table className="dl">
          <thead>
            <tr>
              <th>v</th>
              <th>disc</th>
              <th>low</th>
              <th>state</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {graph.pos.map((_, v) => (
              <tr key={v} className={step.cur === v ? 'cur' : ''}>
                <td>{v}</td>
                <td>{step.disc[v] < 0 ? '–' : step.disc[v]}</td>
                <td>{step.low[v] < 0 ? '–' : step.low[v]}</td>
                <td className={`st st${step.vstate[v]}`}>{STATE_LABEL[step.vstate[v]]}</td>
                <td>
                  {mode !== 'scc' && step.aps.includes(v) && <span className="tag red">cut vertex</span>}
                  {mode === 'scc' && step.sccOf[v] >= 0 && <span className="tag" style={{ background: PALETTE[step.sccOf[v] % PALETTE.length], color: '#0b1418' }}>SCC {step.sccOf[v] + 1}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="stackbox">
        <div className="stitle">{stackTitle}</div>
        <div className="chips">
          {stackItems.length === 0 ? <span className="muted">empty</span> : stackItems.map((s, i) => <span className="chip" key={i}>{s}</span>)}
        </div>
      </div>

      <div className="results">
        {mode === 'ap' && <Result title="Articulation points" items={step.aps.map(String)} color="var(--red)" />}
        {mode === 'bridge' && <Result title="Bridges" items={step.bridges.map(ename)} color="var(--red)" />}
        {mode === 'bcc' && (
          <>
            <Result title="Cut vertices" items={step.aps.map(String)} color="var(--red)" />
            <div className="stitle">Blocks found</div>
            {step.blocks.length === 0 ? <span className="muted">none yet</span> : step.blocks.map((b, i) => (
              <div key={i} className="blockrow"><span className="dot" style={{ background: PALETTE[i % PALETTE.length] }} />B{i + 1}: {b.map(ename).join(', ')}</div>
            ))}
          </>
        )}
        {mode === 'scc' && (
          <>
            <div className="stitle">SCCs found</div>
            {step.sccs.length === 0 ? <span className="muted">none yet</span> : step.sccs.map((c, i) => (
              <div key={i} className="blockrow"><span className="dot" style={{ background: PALETTE[i % PALETTE.length] }} />#{i + 1}: {'{'}{c.join(', ')}{'}'}</div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Result({ title, items, color }) {
  return (
    <div>
      <div className="stitle">{title}</div>
      <div className="chips">
        {items.length === 0 ? <span className="muted">none yet</span> : items.map((s) => <span key={s} className="chip" style={{ borderColor: color, color }}>{s}</span>)}
      </div>
    </div>
  );
}

export function Legend({ mode }) {
  const items =
    mode === 'scc'
      ? [['var(--accent)', 'tree'], ['var(--violet)', 'back', 1], ['var(--pink)', 'forward', 1], ['var(--orange)', 'cross', 1]]
      : mode === 'bcc'
      ? [['var(--accent)', 'tree'], ['var(--violet)', 'back', 1], ['var(--amber)', 'on edge stack']]
      : mode === 'bridge'
      ? [['var(--accent)', 'tree'], ['var(--violet)', 'back', 1], ['var(--red)', 'bridge']]
      : [['var(--accent)', 'tree'], ['var(--violet)', 'back', 1]];
  return (
    <div className="legend">
      {items.map(([c, t, dashed]) => (
        <span key={t}><i style={{ background: dashed ? 'transparent' : c, borderTop: dashed ? `3px dashed ${c}` : 'none' }} />{t}</span>
      ))}
      <span><i className="vdot" style={{ background: 'var(--node)' }} />unvisited</span>
      <span><i className="vdot" style={{ background: 'var(--amber)' }} />on path</span>
      <span><i className="vdot" style={{ background: 'var(--accent)' }} />finished</span>
      {mode !== 'scc' && <span><i className="vdot ring" />cut vertex</span>}
      {(mode === 'bcc' || mode === 'scc') && <span><i style={{ background: 'transparent', borderTop: '3px dotted var(--text)', height: 0 }} />{mode === 'bcc' ? 'dotted outline = one block' : 'dotted outline = one SCC'}</span>}
      <span className="muted">labels: disc / low</span>
    </div>
  );
}

export function OpCounter({ step, graph, directed, onOpenTab }) {
  if (!step) return null;
  const V = graph.n;
  const E = graph.edges.length;
  const perEdge = directed ? 1 : 2;
  const entries = perEdge * E;
  const bound = V + entries;
  const done = step.ops.v + step.ops.e;
  const brute = V * (V + E);
  const Row = ({ label, val, max, color }) => (
    <div className="oprow">
      <span className="oplabel">{label}</span>
      <span className="opbar"><i style={{ width: `${max ? (100 * val) / max : 0}%`, background: color }} /></span>
      <span className="opnum">{val} / {max}</span>
    </div>
  );
  return (
    <div className="opcounter">
      <Row label="vertices visited" val={step.ops.v} max={V} color="var(--accent)" />
      <Row label="edge checks" val={step.ops.e} max={entries} color="var(--violet)" />
      <Row label="total work" val={done} max={bound} color="var(--amber)" />
      <p className="muted small">
        Every adjacency entry is examined exactly once{directed ? '' : ', and an undirected edge sits in two lists, so each edge is checked from both ends'}: the total is always <b>V + {directed ? 'E' : '2E'} = {V} + {entries} = {bound}</b>, which is O(V + E). Deleting each vertex and recounting would cost about V·(V + E) = <b>{brute.toLocaleString()}</b>.
        {onOpenTab && <> <button className="ghost" onClick={() => onOpenTab('perf')}>See the speed-up chart</button></>}
      </p>
    </div>
  );
}
