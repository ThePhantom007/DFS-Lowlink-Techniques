// Benchmark: the one-pass low-link algorithm against brute force (delete each vertex, recount components).
import { analyzeUndirected, bruteArticulationOps } from './lean.js';

function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/* Connected random graph: a random spanning tree plus about n extra edges (E close to 2n). */
export function benchGraph(n, seed = 12345) {
  const r = rng(seed + n);
  const edges = [];
  for (let v = 1; v < n; v++) edges.push([Math.floor(r() * v), v]);
  for (let k = 0; k < n; k++) {
    const a = Math.floor(r() * n);
    const b = Math.floor(r() * n);
    if (a !== b) edges.push([a, b]);
  }
  return { n, edges };
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function timeIt(fn, minMs = 15) {
  let reps = 0;
  const t0 = now();
  let res;
  do {
    res = fn();
    reps++;
  } while (now() - t0 < minMs && reps < 2000);
  return { ms: (now() - t0) / reps, res };
}

export function benchOnce(n) {
  const g = benchGraph(n);
  const fast = timeIt(() => analyzeUndirected(g.n, g.edges));
  const brute = timeIt(() => bruteArticulationOps(g.n, g.edges), 5);
  const same = JSON.stringify(fast.res.aps) === JSON.stringify(brute.res.aps);
  return { n, e: g.edges.length, fastMs: fast.ms, bruteMs: brute.ms, fastOps: fast.res.ops, bruteOps: brute.res.ops, speedup: brute.ms / fast.ms, same };
}

export async function runBench(sizes, onRow) {
  const rows = [];
  for (const n of sizes) {
    await new Promise((r) => setTimeout(r, 0)); // let the UI paint between sizes
    const row = benchOnce(n);
    rows.push(row);
    onRow?.(row, rows);
  }
  return rows;
}
