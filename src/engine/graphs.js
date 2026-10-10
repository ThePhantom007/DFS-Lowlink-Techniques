export const W = 760;
export const H = 480;
export const MAX_N = 24;

/* ---------- layout ---------- */
export function circleLayout(n) {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
    return { x: Math.round(W / 2 + Math.cos(a) * 190), y: Math.round(H / 2 + Math.sin(a) * 170) };
  });
}

// Small deterministic Fruchterman–Reingold layout.
export function forceLayout(n, edges, seed = 7) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pos = circleLayout(n).map((p) => ({ x: p.x + rnd() * 12, y: p.y + rnd() * 12 }));
  const k = Math.sqrt((W * H) / Math.max(n, 1)) * 0.6;
  const ITER = 300;
  for (let it = 0; it < ITER; it++) {
    const t = 1 - it / ITER;
    const d = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        const dist = Math.max(0.01, Math.hypot(dx, dy));
        const f = (k * k) / dist;
        dx = (dx / dist) * f;
        dy = (dy / dist) * f;
        d[i].x += dx; d[i].y += dy;
        d[j].x -= dx; d[j].y -= dy;
      }
    }
    for (const [a, b] of edges) {
      let dx = pos[a].x - pos[b].x;
      let dy = pos[a].y - pos[b].y;
      const dist = Math.max(0.01, Math.hypot(dx, dy));
      const f = (dist * dist) / k;
      dx = (dx / dist) * f;
      dy = (dy / dist) * f;
      d[a].x -= dx; d[a].y -= dy;
      d[b].x += dx; d[b].y += dy;
    }
    for (let i = 0; i < n; i++) {
      d[i].x += (W / 2 - pos[i].x) * 0.05;
      d[i].y += (H / 2 - pos[i].y) * 0.05;
      const len = Math.max(0.01, Math.hypot(d[i].x, d[i].y));
      const lim = 14 * t + 1;
      pos[i].x += (d[i].x / len) * Math.min(len, lim);
      pos[i].y += (d[i].y / len) * Math.min(len, lim);
      pos[i].x = Math.min(W - 45, Math.max(45, pos[i].x));
      pos[i].y = Math.min(H - 50, Math.max(55, pos[i].y));
    }
  }
  return pos.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
}

export const mk = (n, edges, pos) => ({ n, edges: edges.map((e) => [...e]), pos: pos ? pos.map(([x, y]) => ({ x, y })) : forceLayout(n, edges) });

/* ---------- presets ---------- */
export const PRESETS_U = [
  {
    id: 'classic',
    name: 'Triangle + tail',
    desc: 'The running example: triangle 0-1-2 with a tail 1-3-4. Vertices 1 and 3 are cut vertices; both tail edges are bridges.',
    make: () => mk(5, [[0, 1], [1, 2], [2, 0], [1, 3], [3, 4]], [[150, 250], [300, 140], [300, 360], [480, 140], [650, 140]]),
  },
  {
    id: 'hinge',
    name: 'Two triangles + hinge',
    desc: 'Two triangles joined through vertex 3 and a bridge 1–3, plus a pendant edge. Four blocks, two cut vertices.',
    make: () => mk(7, [[0, 1], [1, 2], [2, 0], [1, 3], [3, 4], [3, 5], [5, 6], [6, 3]], [[110, 250], [260, 140], [260, 360], [430, 190], [600, 100], [570, 280], [450, 400]]),
  },
  {
    id: 'bowtie',
    name: 'Bowtie (shared vertex)',
    desc: 'Two triangles sharing vertex 2. Only one cut vertex, no bridges, two blocks that share a vertex.',
    make: () => mk(5, [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 2]], [[140, 150], [140, 340], [330, 245], [520, 150], [520, 340]]),
  },
  {
    id: 'hub',
    name: 'Hub & spokes (root case)',
    desc: 'Vertex 0 has many DFS children when started there — try start = 0, then start = 1 to see the root rule appear and vanish.',
    make: () => mk(6, [[0, 1], [0, 2], [0, 3], [0, 4], [4, 5], [5, 0]], [[380, 240], [380, 70], [610, 150], [150, 150], [560, 390], [250, 390]]),
  },
  {
    id: 'cycle',
    name: 'Cycle (no weak points)',
    desc: 'A single 6-cycle is one block: no articulation points, no bridges.',
    make: () => mk(6, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]]),
  },
  {
    id: 'tree',
    name: 'Tree (every edge a bridge)',
    desc: 'In a tree every edge is a bridge and every internal vertex is a cut vertex. Every block is a single edge.',
    make: () => mk(7, [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]], [[380, 60], [220, 200], [540, 200], [140, 380], [300, 380], [460, 380], [620, 380]]),
  },
  {
    id: 'multi',
    name: 'Parallel edges',
    desc: 'Edges 0–1 appear twice. Skipping the parent by EDGE id (not vertex) is what keeps this correct: 0–1 is not a bridge, yet 1 is a cut vertex.',
    make: () => mk(4, [[0, 1], [0, 1], [1, 2], [2, 3], [3, 1]], [[150, 250], [330, 250], [520, 140], [520, 360]]),
  },
  {
    id: 'split',
    name: 'Disconnected graph',
    desc: 'Two components. The DFS must restart; each tree is analysed separately.',
    make: () => mk(6, [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5]], [[120, 170], [260, 90], [260, 300], [480, 170], [610, 250], [480, 360]]),
  },
  {
    id: 'campus',
    name: 'Campus network (10 nodes)',
    desc: 'Three clusters chained together — a realistic "which router failing hurts most?" scenario.',
    make: () => mk(10, [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [3, 4], [4, 5], [5, 6], [6, 4], [6, 7], [7, 8], [8, 9], [9, 7]], [[70, 150], [180, 70], [280, 150], [180, 260], [350, 330], [450, 220], [500, 360], [600, 300], [690, 190], [690, 400]]),
  },
];

export const PRESETS_D = [
  {
    id: 'twocycles',
    name: 'Two cycles',
    desc: 'A 3-cycle feeding into a 2-cycle: SCCs {0,1,2} and {3,4}.',
    make: () => mk(5, [[0, 1], [1, 2], [2, 0], [1, 3], [3, 4], [4, 3]], [[120, 250], [290, 140], [290, 360], [500, 160], [660, 270]]),
  },
  {
    id: 'clrs',
    name: 'Textbook graph (8 nodes)',
    desc: 'The classic CLRS example: SCCs {0,1,4}, {2,3}, {5,6} and {7}.',
    make: () => mk(8, [[0, 1], [1, 2], [1, 4], [1, 5], [2, 3], [2, 6], [3, 2], [3, 7], [4, 0], [4, 5], [5, 6], [6, 5], [6, 7]], [[100, 120], [260, 120], [460, 120], [640, 120], [100, 340], [300, 340], [470, 340], [640, 340]]),
  },
  {
    id: 'trap',
    name: 'Cross-edge trap',
    desc: 'Edge 3→2 points into an SCC that is already finished. Without onStack[] Tarjan would merge the wrong vertices.',
    make: () => mk(4, [[0, 1], [1, 2], [2, 1], [0, 3], [3, 2]], [[120, 240], [320, 110], [540, 240], [320, 370]]),
  },
  {
    id: 'dag',
    name: 'DAG (all singletons)',
    desc: 'No cycles at all: every vertex is its own SCC.',
    make: () => mk(5, [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]], [[100, 240], [270, 120], [270, 360], [450, 240], [630, 240]]),
  },
];

/* ---------- random graphs ---------- */
function rng(seed) {
  let s = seed || Math.floor(Math.random() * 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function randomUndirected(n = 8, extra = 2, seed) {
  const r = rng(seed);
  const edges = [];
  const has = new Set();
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  for (let v = 1; v < n; v++) {
    const p = Math.floor(r() * v);
    edges.push([p, v]);
    has.add(key(p, v));
  }
  let tries = 0;
  while (extra > 0 && tries++ < 200) {
    const a = Math.floor(r() * n);
    const b = Math.floor(r() * n);
    if (a === b || has.has(key(a, b))) continue;
    has.add(key(a, b));
    edges.push([Math.min(a, b), Math.max(a, b)]);
    extra--;
  }
  // shuffle labels so vertex 0 is not always the tree root
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const e2 = edges.map(([a, b]) => [perm[a], perm[b]]);
  return mk(n, e2);
}

export function randomDirected(n = 7, m = 10, seed) {
  const r = rng(seed);
  const edges = [];
  const has = new Set();
  let tries = 0;
  while (edges.length < m && tries++ < 400) {
    const a = Math.floor(r() * n);
    const b = Math.floor(r() * n);
    if (a === b || has.has(`${a}>${b}`)) continue;
    has.add(`${a}>${b}`);
    edges.push([a, b]);
  }
  return mk(n, edges);
}

/* ---------- edge-list text ---------- */
export function parseEdgeList(text, directed) {
  const edges = [];
  let max = -1;
  const re = /(\d+)\s*(?:->|→|–|-|,|\s)\s*(\d+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a === b || a >= MAX_N || b >= MAX_N) continue;
    edges.push([a, b]);
    max = Math.max(max, a, b);
  }
  if (max < 0) return null;
  return mk(max + 1, edges);
}

export const edgeListText = (g, directed) => g.edges.map(([a, b]) => `${a}${directed ? '->' : '-'}${b}`).join('\n');

/* ---------- connectivity helpers ---------- */
export function componentsAfterRemoval(n, edges, remV = new Set(), remE = new Set()) {
  const par = Array.from({ length: n }, (_, i) => i);
  const find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
  edges.forEach(([a, b], i) => {
    if (remE.has(i) || remV.has(a) || remV.has(b)) return;
    par[find(a)] = find(b);
  });
  const ids = new Map();
  const comp = Array(n).fill(-1);
  for (let v = 0; v < n; v++) {
    if (remV.has(v)) continue;
    const r = find(v);
    if (!ids.has(r)) ids.set(r, ids.size);
    comp[v] = ids.get(r);
  }
  return { comp, count: ids.size };
}

/* Brute-force reference answers (used by tests and the practice checker). */
export function bruteArticulation(g) {
  const base = componentsAfterRemoval(g.n, g.edges).count;
  const res = [];
  for (let v = 0; v < g.n; v++) {
    const after = componentsAfterRemoval(g.n, g.edges, new Set([v])).count;
    // removing v deletes it from the count; compare to components among the rest
    const isolated = g.edges.every(([a, b]) => a !== v && b !== v);
    const expected = base - (isolated ? 1 : 0);
    if (after > expected) res.push(v);
  }
  return res;
}

export function bruteBridges(g) {
  const base = componentsAfterRemoval(g.n, g.edges).count;
  const res = [];
  g.edges.forEach((_, i) => {
    if (componentsAfterRemoval(g.n, g.edges, new Set(), new Set([i])).count > base) res.push(i);
  });
  return res;
}

/* ---------- share links ---------- */
export function encodeShare(obj) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  } catch {
    return '';
  }
}

export function decodeShare(hash) {
  try {
    const m = /#g=([^&]+)/.exec(hash || '');
    if (!m) return null;
    const obj = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    const ok = (g) => g && Number.isInteger(g.n) && g.n <= MAX_N && Array.isArray(g.edges) && Array.isArray(g.pos) && g.pos.length === g.n;
    if (!ok(obj.u) || !ok(obj.d)) return null;
    return obj;
  } catch {
    return null;
  }
}
