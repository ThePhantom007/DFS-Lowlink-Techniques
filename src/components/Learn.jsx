import { useState } from 'react';
import { LESSONS } from '../data/lessons.js';

export function Rich({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>;
        if (p.startsWith('*') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function Block({ b, onTry }) {
  switch (b.t) {
    case 'p': return <p><Rich text={b.text} /></p>;
    case 'h': return <h4>{b.text}</h4>;
    case 'list': return <ul>{b.items.map((x, i) => <li key={i}><Rich text={x} /></li>)}</ul>;
    case 'formula': return <pre className="formula">{b.text}</pre>;
    case 'code': return <pre className="codeblock">{b.text}</pre>;
    case 'tip': return <div className="callout tip"><b>Tip</b><div><Rich text={b.text} /></div></div>;
    case 'warn': return <div className="callout warn"><b>Watch out</b><div><Rich text={b.text} /></div></div>;
    case 'try': return <button className="try" onClick={() => onTry(b.mode, b.preset)}>▶ {b.label}</button>;
    default: return null;
  }
}

export default function Learn({ onTry }) {
  const [cur, setCur] = useState(0);
  const [done, setDone] = useState([]); // lives only in memory: a refresh starts everything from scratch
  const lesson = LESSONS[cur];
  const isDone = done.includes(lesson.id);

  const toggleDone = () => {
    const nd = isDone ? done.filter((d) => d !== lesson.id) : [...done, lesson.id];
    setDone(nd);
  };
  const pct = Math.round((done.length / LESSONS.length) * 100);

  return (
    <div className="learn">
      <nav className="lnav card" aria-label="Lessons">
        <div className="prog">
          <div className="progbar"><i style={{ width: `${pct}%` }} /></div>
          <span className="muted small">{done.length} of {LESSONS.length} lessons read · {pct}%</span>
        </div>
        {LESSONS.map((l, i) => (
          <button key={l.id} className={`litem ${i === cur ? 'on' : ''}`} onClick={() => { setCur(i); window.scrollTo({ top: 0 }); }}>
            <span className={`tick ${done.includes(l.id) ? 'y' : ''}`}>{done.includes(l.id) ? '✓' : i + 1}</span>
            <span>
              <b>{l.title}</b>
              <small>{l.summary}</small>
            </span>
          </button>
        ))}
      </nav>
      <article className="lbody card">
        <div className="kicker">Lesson {cur + 1} of {LESSONS.length}</div>
        <h2>{lesson.title}</h2>
        {lesson.blocks.map((b, i) => <Block key={i} b={b} onTry={onTry} />)}
        <div className="lfoot">
          <button disabled={cur === 0} onClick={() => { setCur(cur - 1); window.scrollTo({ top: 0 }); }}>← Previous</button>
          <button className={isDone ? '' : 'primary'} onClick={toggleDone}>{isDone ? 'Marked as read ✓' : 'Mark as read'}</button>
          <button disabled={cur === LESSONS.length - 1} onClick={() => { setCur(cur + 1); window.scrollTo({ top: 0 }); }}>Next →</button>
        </div>
      </article>
    </div>
  );
}
