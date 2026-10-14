// Tests for the learning features: injected bugs, DFS-tree provenance, mistake explanations,
// operation counters, lean algorithms, 2-SAT and the code listings in three languages.
import { runTrace, traceUndirected, traceSCC } from '../src/engine/traces.js';
import { BUGS, bugsFor, getCode, LANGS, MARKS, functionLines } from '../src/engine/code.js';
import { compareBug, findCounterexample } from '../src/engine/bugs.js';
import { explainLow } from '../src/engine/explain.js';
import { analyzeUndirected, bruteArticulationOps, tarjanSCC, solve2SAT, bruteSAT, lit } from '../src/engine/lean.js';
import { benchOnce } from '../src/engine/bench.js';
import { bruteArticulation, bruteBridges, randomUndirected, randomDirected, PRESETS_U, PRESETS_D } from '../src/engine/graphs.js';

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; if (failures < 20) console.error('FAIL:', msg); } };
const same = (a, b) => JSON.stringify([...a].sort((x, y) => x - y)) === JSON.stringify([...b].sort((x, y) => x - y));
const last = (s) => s[s.length - 1];

/* ---------- code listings: all languages, all bugs ---------- */
const MODES = ['ap', 'bridge', 'bcc', 'scc'];
const USED = {
  ap: ['main', 'enter', 'visit', 'init', 'loop', 'skip', 'tree', 'child', 'recurse', 'lowUp', 'check', 'verdict', 'else', 'back', 'loopEnd', 'root', 'rootset', 'finish'],
  bridge: ['main', 'enter', 'visit', 'loop', 'skip', 'tree', 'recurse', 'lowUp', 'check', 'verdict', 'else', 'back', 'loopEnd', 'finish'],
  bcc: ['main', 'enter', 'visit', 'loop', 'skip', 'tree', 'push', 'recurse', 'lowUp', 'check', 'pop', 'block', 'back', 'pushBack', 'loopEnd', 'finish'],
  scc: ['main', 'enter', 'visit', 'spush', 'loop', 'tree', 'recurse', 'lowUp', 'check', 'back', 'ignore', 'loopEnd', 'root', 'pop', 'block', 'finish'],
};
for (const [lang] of LANGS) for (const mode of MODES) {
  const c = getCode(mode, lang);
  for (const k of USED[mode]) check(c.marks[k] !== undefined, `mark ${k} missing in ${lang}/${mode}`);
  check(!c.lines.some((l) => /@\w+\s*$/.test(l)), `marker left in display text ${lang}/${mode}`);
  for (const bug of bugsFor(mode)) {
    const b = getCode(mode, lang, bug);
    check(Object.keys(b.bugLines).length > 0, `bug ${bug} changed no line in ${lang}/${mode}`);
    check(b.lines.length === c.lines.length, `bug ${bug} changed line count`);
    check(Object.entries(b.bugLines).every(([i, orig]) => b.lines[i] !== orig && orig === c.lines[i]), `bug ${bug} bugLines wrong`);
    check(b.primaryLine >= 0 && b.primaryLine in b.bugLines, `bug ${bug} primary line is not a changed line (${lang}/${mode})`);
    const f = functionLines(mode, lang, bug);
    check(f.primary >= 0 && f.primary < f.lines.length, `functionLines primary out of range`);
  }
}

/* ---------- bugs: every bug is exposed by a searched counterexample and flagged ---------- */
for (const bug of Object.keys(BUGS)) for (const mode of BUGS[bug].modes) {
  const g = findCounterexample(mode, bug);
  check(!!g, `no counterexample for ${bug}/${mode}`);
  if (!g) continue;
  const c = compareBug(mode, g, 0, bug);
  check(c.wrong, `${bug}/${mode}: counterexample is not wrong`);
  check(c.first >= 0 && c.steps[c.first].hit.title && c.steps[c.first].hit.why, `${bug}/${mode}: no divergence step`);
  check(c.steps.every((s) => !s.quiz), `${bug}/${mode}: quiz leaked into bug mode`);
  check(c.steps.every((s) => s.line >= 0 && Array.isArray(s.trailKeys) && s.trailKeys.length >= 1), `${bug}/${mode}: bad line info`);
  // the correct run must be untouched by the existence of bugs
  check(JSON.stringify(c.refSteps) === JSON.stringify(runTrace(mode, g, 0)), 'reference run changed');
}

// "wrong answer => a divergence was marked" on many random graphs (no silent wrong answers)
let exposed = 0;
for (let i = 0; i < 250; i++) {
  const gu = randomUndirected(3 + (i % 8), i % 4, 900 + i);
  const gd = randomDirected(3 + (i % 7), 2 + (i % 12), 3300 + i);
  for (const bug of Object.keys(BUGS)) for (const mode of BUGS[bug].modes) {
    const g = mode === 'scc' ? gd : gu;
    for (const start of [0, g.n - 1]) {
      const c = compareBug(mode, g, start, bug);
      if (c.wrong) { exposed++; check(c.first >= 0, `${bug}/${mode} wrong answer without a marked divergence ${JSON.stringify(g.edges)} start ${start}`); }
    }
  }
}
for (const p of PRESETS_U) for (const bug of ['parentVertex', 'bridgeGe', 'apGt', 'rootSkip', 'rootAlways', 'pushTwice', 'childDisc']) for (const mode of BUGS[bug].modes) {
  const c = compareBug(mode, p.make(), 0, bug);
  if (c.wrong) check(c.first >= 0, `preset ${p.id} ${bug}/${mode}: wrong without marker`);
}
check(exposed > 100, `bugs should be exposed regularly (${exposed})`);

// known exact expectations
{
  const hub = PRESETS_U.find((p) => p.id === 'hub').make();
  check(same(last(runTrace('ap', hub, 0, 'rootSkip')).aps, []) && same(last(runTrace('ap', hub, 0)).aps, [0]), 'rootSkip on hub');
  const multi = PRESETS_U.find((p) => p.id === 'multi').make();
  check(same(last(runTrace('bridge', multi, 0, 'parentVertex')).bridges, [0]) && same(last(runTrace('bridge', multi, 0)).bridges, []), 'parentVertex on multi');
  const trap = PRESETS_D.find((p) => p.id === 'trap').make();
  check(JSON.stringify(last(runTrace('scc', trap, 0, 'noOnStack')).sccs) === JSON.stringify([[1, 2], [0, 3]]), 'noOnStack on trap');
}

/* ---------- provenance, tree and counters ---------- */
for (let i = 0; i < 200; i++) {
  const g = randomUndirected(2 + (i % 9), i % 4, 70 + i);
  for (const mode of ['ap', 'bridge', 'bcc']) {
    const f = last(traceUndirected(mode, g, 0));
    const roots = f.parent.filter((p) => p === -1).length;
    check(f.parent.filter((p) => p !== -1).length === g.n - roots, 'parent array');
    check(f.ops.v === g.n && f.ops.e === 2 * g.edges.length, `ops ${mode}: ${f.ops.v}/${f.ops.e} vs ${g.n}/${2 * g.edges.length}`);
    for (let v = 0; v < g.n; v++) {
      if (f.low[v] < f.disc[v]) check(f.lowSrc[v] !== null, `low<disc but no source at ${v}`);
      else check(f.lowSrc[v] === null, `source without a lowering at ${v}`);
      if (f.lowSrc[v]?.k === 'back') check(f.disc[f.lowSrc[v].v] === f.low[v], 'back source mismatch');
      if (f.lowSrc[v]?.k === 'child') check(f.low[f.lowSrc[v].v] === f.low[v], 'child source mismatch');
    }
  }
  // steps expose tests and low events
  const steps = traceUndirected('ap', g, 0);
  check(steps.every((s) => !s.ev || typeof s.ev.type === 'string'), 'ev type');
}
for (let i = 0; i < 100; i++) {
  const g = randomDirected(2 + (i % 8), 1 + (i % 14), 400 + i);
  const f = last(traceSCC(g, 0));
  check(f.ops.v === g.n && f.ops.e === g.edges.length, `scc ops ${f.ops.v}/${f.ops.e}`);
}

/* ---------- explain my mistake ---------- */
for (let i = 0; i < 150; i++) {
  const g = randomUndirected(5 + (i % 4), 2, 600 + i);
  const f = last(traceUndirected('ap', g, 0));
  for (let v = 0; v < g.n; v++) {
    const ex = explainLow(g, f, v, '');
    check(ex.answer === f.low[v], 'explain answer');
    check(last(ex.steps).run === f.low[v], `explain steps end at ${last(ex.steps).run}, want ${f.low[v]} (v=${v}, ${JSON.stringify(g.edges)})`);
    check(ex.steps.every((s) => s.text.length > 0 && Array.isArray(s.hlE) && Array.isArray(s.hlV)), 'explain step shape');
    check(explainLow(g, f, v, String(f.low[v])).diagnosis === 'That is correct.', 'diagnosis correct');
    check(explainLow(g, f, v, String(f.low[v] + 1)).diagnosis.length > 10, 'diagnosis wrong');
  }
}

/* ---------- lean algorithms ---------- */
for (let i = 0; i < 300; i++) {
  const g = randomUndirected(2 + (i % 12), i % 5, 2000 + i);
  const a = analyzeUndirected(g.n, g.edges);
  check(same(a.aps, bruteArticulation(g)), `lean aps ${JSON.stringify(g.edges)}`);
  check(same(a.bridges, bruteBridges(g)), `lean bridges ${JSON.stringify(g.edges)}`);
  check(same(bruteArticulationOps(g.n, g.edges).aps, bruteArticulation(g)), 'brute ops aps');
  check(a.ops === g.n + 2 * g.edges.length, `lean ops ${a.ops}`);
}
{
  const g = { n: 6, edges: [[0, 1], [0, 1], [1, 2], [3, 4]] };
  check(same(analyzeUndirected(g.n, g.edges).bridges, bruteBridges(g)), 'lean parallel/disconnected bridges');
  check(same(analyzeUndirected(g.n, g.edges).aps, bruteArticulation(g)), 'lean parallel/disconnected aps');
}
for (let i = 0; i < 200; i++) {
  const g = randomDirected(2 + (i % 8), 1 + (i % 14), 8000 + i);
  const t = tarjanSCC(g.n, g.edges);
  const f = last(traceSCC(g, 0));
  for (let a = 0; a < g.n; a++) for (let b = 0; b < g.n; b++) check((t.comp[a] === t.comp[b]) === (f.sccOf[a] === f.sccOf[b]), 'lean scc partition');
}
const bench = benchOnce(120);
check(bench.same && bench.bruteOps > bench.fastOps * 10, 'benchmark sanity');

/* ---------- 2-SAT ---------- */
let sat = 0;
let unsat = 0;
for (let i = 0; i < 600; i++) {
  let s = 7919 * (i + 1);
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const nv = 1 + (i % 6);
  const nc = 1 + Math.floor(rnd() * (nv * 2 + 2));
  const clauses = Array.from({ length: nc }, () => [lit(Math.floor(rnd() * nv), rnd() < 0.5), lit(Math.floor(rnd() * nv), rnd() < 0.5)]);
  const r = solve2SAT(nv, clauses);
  const truth = bruteSAT(nv, clauses);
  check(r.sat === truth, `2-SAT verdict wrong ${JSON.stringify(clauses)}`);
  if (r.sat) {
    sat++;
    const val = (l) => r.assign[l >> 1] !== ((l & 1) === 1);
    check(clauses.every(([a, b]) => val(a) || val(b)), `2-SAT assignment does not satisfy ${JSON.stringify(clauses)}`);
  } else unsat++;
}
check(sat > 50 && unsat > 50, `2-SAT test mix ${sat}/${unsat}`);

console.log(failures === 0 ? `All feature tests passed (${exposed} wrong-answer cases checked for markers, 2-SAT ${sat} sat / ${unsat} unsat).` : `${failures} failure(s).`);
process.exit(failures ? 1 : 0);
