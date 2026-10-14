// Comparing a buggy run against the correct one, and finding graphs on which a given bug gives a wrong answer.
import { runTrace } from './traces.js';
import { BUGS } from './code.js';
import { PRESETS_U, PRESETS_D, randomUndirected, randomDirected } from './graphs.js';

const ename = (g, id, directed) => `${g.edges[id][0]}${directed ? '→' : '–'}${g.edges[id][1]}`;

/* A comparable summary of the answer a run ended with. */
export function summarize(mode, f, g) {
  if (mode === 'ap') {
    const items = f.aps.map(String);
    return { items, ids: f.aps.map(Number), key: items.join('|'), title: 'Articulation points' };
  }
  if (mode === 'bridge') {
    const ids = [...f.bridges].sort((a, b) => a - b);
    return { items: ids.map((e) => ename(g, e)), ids, key: ids.join('|'), title: 'Bridges' };
  }
  if (mode === 'bcc') {
    const blocks = f.blocks.map((b) => [...b].sort((a, c) => a - c));
    const items = blocks.map((b) => `{${b.map((e) => ename(g, e)).join(', ')}}`).sort();
    const left = f.stack.length ? [`left on stack: ${f.stack.map((e) => ename(g, e)).join(', ')}`] : [];
    return { items: [...items, ...left], ids: [], key: [...items, ...left].join('|'), title: 'Biconnected components' };
  }
  const groups = f.sccs.map((c) => `{${[...c].sort((a, b) => a - b).join(', ')}}`).sort();
  const left = f.stack.length ? [`never popped: ${[...f.stack].sort((a, b) => a - b).join(', ')}`] : [];
  return { items: [...groups, ...left], ids: [], key: [...groups, ...left].join('|'), title: 'Strongly connected components' };
}

/* Run the correct algorithm and the buggy one on the same graph. */
export function compareBug(mode, g, start, bug) {
  const refSteps = runTrace(mode, g, start);
  const steps = runTrace(mode, g, start, bug);
  const good = summarize(mode, refSteps.at(-1), g);
  const bad = summarize(mode, steps.at(-1), g);
  const hits = [];
  steps.forEach((s, i) => s.hit && hits.push(i));
  const missed = good.items.filter((x) => !bad.items.includes(x));
  const extra = bad.items.filter((x) => !good.items.includes(x));
  const missedIds = good.ids.filter((x) => !bad.ids.includes(x));
  const extraIds = bad.ids.filter((x) => !good.ids.includes(x));
  return { steps, refSteps, good, bad, hits, first: hits.length ? hits[0] : -1, wrong: good.key !== bad.key, missed, extra, missedIds, extraIds };
}

const found = new Map();
/* A small graph on which `bug` really produces a wrong answer (searched, not hand-written, so it is always true). */
export function findCounterexample(mode, bug) {
  const key = `${mode}|${bug}`;
  if (found.has(key)) return found.get(key);
  const directed = mode === 'scc';
  const cands = [];
  (directed ? PRESETS_D : PRESETS_U).forEach((p) => cands.push(p.make()));
  for (let n = 4; n <= 8; n++) {
    for (let seed = 1; seed <= 60; seed++) {
      cands.push(directed ? randomDirected(n, n + (seed % 4), seed * 31 + n) : randomUndirected(n, 1 + (seed % 3), seed * 31 + n));
    }
  }
  const hasParallel = (g) => new Set(g.edges.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`))).size < g.edges.length;
  // only the parent-vertex bug needs parallel edges; for the others a simple graph teaches the point more cleanly
  const usable = bug === 'parentVertex' ? cands.filter(hasParallel) : cands.filter((g) => directed || !hasParallel(g));
  cands.length = 0;
  cands.push(...usable);
  cands.sort((a, b) => a.n - b.n);
  let best = null;
  for (const g of cands) {
    const c = compareBug(mode, g, 0, bug);
    if (c.wrong && c.first >= 0) {
      best = g;
      break;
    }
  }
  found.set(key, best);
  return best;
}

export { BUGS };
