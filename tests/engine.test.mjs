// Self-checking tests for the trace engine.
// 1. Compares against brute force (always runs).
// 2. Writes random cases to tests/cases.json so tests/crosscheck.py can compare with networkx.
import { traceUndirected, traceSCC, blockCutTree } from '../src/engine/traces.js';
import { bruteArticulation, bruteBridges, randomUndirected, randomDirected, PRESETS_U, PRESETS_D } from '../src/engine/graphs.js';
import { writeFileSync } from 'node:fs';

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; if (failures < 15) console.error('FAIL:', msg); } };
const last = (steps) => steps[steps.length - 1];
const same = (a, b) => JSON.stringify([...a].sort((x, y) => x - y)) === JSON.stringify([...b].sort((x, y) => x - y));

const cases = [];
const undirectedGraphs = [...PRESETS_U.map((p) => p.make())];
for (let i = 0; i < 300; i++) {
  const n = 2 + (i % 9);
  undirectedGraphs.push(randomUndirected(n, i % 4, 1000 + i));
}
undirectedGraphs.push({ n: 6, edges: [[0, 1], [2, 3]], pos: [] });
undirectedGraphs.push({ n: 3, edges: [], pos: [] });

for (const g of undirectedGraphs) {
  for (const start of [0, g.n - 1]) {
    const ap = last(traceUndirected('ap', g, start));
    const br = last(traceUndirected('bridge', g, start));
    const bc = last(traceUndirected('bcc', g, start));
    check(same(ap.aps, bruteArticulation(g)), `AP mismatch ${JSON.stringify(g.edges)} start=${start}: got ${ap.aps}, want ${bruteArticulation(g)}`);
    check(same(br.bridges, bruteBridges(g)), `bridge mismatch ${JSON.stringify(g.edges)} start=${start}`);
    const seen = new Set();
    bc.blocks.forEach((b) => b.forEach((e) => { check(!seen.has(e), `edge ${e} in two blocks`); seen.add(e); }));
    check(seen.size === g.edges.length, `blocks do not cover all edges ${JSON.stringify(g.edges)}`);
    const { cuts } = blockCutTree(bc.blocks, g.edges);
    check(same(cuts, bruteArticulation(g)), `block-cut cuts != APs ${JSON.stringify(g.edges)}`);
    check(same(bc.aps, bruteArticulation(g)), `bcc aps != APs ${JSON.stringify(g.edges)}`);
    const singles = bc.blocks.filter((b) => b.length === 1).map((b) => b[0]);
    check(same(singles, bruteBridges(g)), `single-edge blocks != bridges ${JSON.stringify(g.edges)}`);
    check(bc.stack.length === 0, 'edge stack not empty at end');
  }
  if (g.n > 1 && g.edges.length) cases.push({ kind: 'u', n: g.n, edges: g.edges, aps: last(traceUndirected('ap', g, 0)).aps, bridges: last(traceUndirected('bridge', g, 0)).bridges, blocks: last(traceUndirected('bcc', g, 0)).blocks });
}

{
  const g = { n: 4, edges: [[0, 1], [0, 1], [1, 2], [2, 3], [3, 1]], pos: [] };
  check(same(last(traceUndirected('bridge', g, 0)).bridges, []), 'parallel edges must not be bridges');
  check(same(last(traceUndirected('ap', g, 0)).aps, [1]), 'parallel-edge AP');
}

const directedGraphs = PRESETS_D.map((p) => p.make());
for (let i = 0; i < 300; i++) directedGraphs.push(randomDirected(2 + (i % 8), 1 + (i % 14), 5000 + i));
for (const g of directedGraphs) {
  const f = last(traceSCC(g, 0));
  const n = g.n;
  const reach = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j));
  g.edges.forEach(([a, b]) => (reach[a][b] = true));
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (reach[i][k] && reach[k][j]) reach[i][j] = true;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    check((reach[i][j] && reach[j][i]) === (f.sccOf[i] === f.sccOf[j]), `SCC mismatch ${JSON.stringify(g.edges)} (${i},${j})`);
  }
  check(f.stack.length === 0, 'tarjan stack not empty');
  cases.push({ kind: 'd', n: g.n, edges: g.edges, sccs: f.sccs });
}

for (const g of undirectedGraphs.slice(0, 40)) {
  for (const mode of ['ap', 'bridge', 'bcc']) {
    traceUndirected(mode, g, 0).forEach((s, i) => {
      check(typeof s.msg === 'string' && s.msg.length > 0, `empty msg step ${i}`);
      check(s.line >= 0, `no code line for ${mode} step ${i}: ${s.msg}`);
      if (s.quiz) check(s.quiz.answer >= 0 && s.quiz.options.length >= 2, `bad quiz ${mode} step ${i}`);
    });
  }
}
for (const g of directedGraphs.slice(0, 30)) {
  traceSCC(g, 0).forEach((s, i) => {
    check(s.line >= 0, `no code line scc step ${i}: ${s.msg}`);
    if (s.quiz) check(s.quiz.answer >= 0, `bad quiz scc step ${i}`);
  });
}

writeFileSync(new URL('./cases.json', import.meta.url), JSON.stringify(cases));
console.log(failures === 0 ? `All engine tests passed (${undirectedGraphs.length} undirected, ${directedGraphs.length} directed graphs).` : `${failures} failure(s).`);
process.exit(failures ? 1 : 0);
