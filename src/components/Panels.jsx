import { useEffect, useRef } from 'react';
import { CODE } from '../engine/code.js';
import { PALETTE } from './GraphCanvas.jsx';

const KW = /^(?:int|void|for|if|else|while|return|continue|break|auto|const|bool|true|false|using|namespace|vector|pair|stack|struct)$/;
function Syntax({ text }) {
  const parts = [];
  const re = /(\/\/.*$|#include.*$)|(\b\d+\b)|(\b[A-Za-z_]\w*\b)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<span key={m.index} className="cm">{m[1]}</span>);
    else if (m[2]) parts.push(<span key={m.index} className="num">{m[2]}</span>);
    else if (KW.test(m[3])) parts.push(<span key={m.index} className="kw">{m[3]}</span>);
    else if (text[re.lastIndex] === '(') parts.push(<span key={m.index} className="fnc">{m[3]}</span>);
    else parts.push(m[3]);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export function CodePanel({ mode, line }) {
  const { lines } = CODE[mode];
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current?.querySelector('.hl');
    if (el && ref.current) {
      const box = ref.current;
      const top = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
      box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }, [line, mode]);
  return (
    <div className="code" ref={ref} tabIndex={0} aria-label="C++ source, current line highlighted">
      {lines.map((ln, i) => (
        <div key={i} className={`cl ${i === line ? 'hl' : ''}`}>
          <span className="ln">{i + 1}</span>
          <span className="src"><Syntax text={ln || ' '} /></span>
        </div>
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
      <span className="muted">labels: disc / low</span>
    </div>
  );
}
