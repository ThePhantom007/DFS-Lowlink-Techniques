// Lean (no-trace) implementations used by the Applications and Performance tabs.
// They are iterative (no recursion limit) and count operations so the speed-up can be shown exactly.

const buildAdj = (n, edges) => {
  const adj = Array.from({ length: n }, () => []);
  edges.forEach(([a, b], id) => {
    adj[a].push([b, id]);
    adj[b].push([a, id]);
  });
  return adj;
};

/* Articulation points and bridges in one pass: O(V + E). */
export function analyzeUndirected(n, edges) {
  const adj = buildAdj(n, edges);
  const disc = Array(n).fill(-1);
  const low = Array(n).fill(-1);
  const isAp = Array(n).fill(false);
  const bridges = [];
  let timer = 0;
  let ops = 0;
  for (let r = 0; r < n; r++) {
    if (disc[r] !== -1) continue;
    disc[r] = low[r] = timer++;
    ops++;
    const stack = [{ u: r, pe: -1, i: 0, ch: 0 }];
    while (stack.length) {
      const top = stack[stack.length - 1];
      const u = top.u;
      if (top.i < adj[u].length) {
        const [v, id] = adj[u][top.i++];
        ops++;
        if (id === top.pe) continue;
        if (disc[v] === -1) {
          top.ch++;
          disc[v] = low[v] = timer++;
          ops++;
          stack.push({ u: v, pe: id, i: 0, ch: 0 });
        } else if (disc[v] < low[u]) low[u] = disc[v];
      } else {
        stack.pop();
        if (stack.length) {
          const p = stack[stack.length - 1];
          if (low[u] < low[p.u]) low[p.u] = low[u];
          if (p.pe !== -1 && low[u] >= disc[p.u]) isAp[p.u] = true;
          if (low[u] > disc[p.u]) bridges.push(top.pe);
        } else if (top.ch > 1) isAp[u] = true;
      }
    }
  }
  const aps = [];
  isAp.forEach((x, i) => x && aps.push(i));
  return { aps, bridges: bridges.sort((a, b) => a - b), disc, low, ops };
}

/* Brute force: delete every vertex in turn and count the pieces again: O(V * (V + E)). */
export function bruteArticulationOps(n, edges) {
  let ops = 0;
  const par = new Int32Array(n);
  const find = (x) => {
    while (par[x] !== x) {
      par[x] = par[par[x]];
      x = par[x];
    }
    return x;
  };
  const countWithout = (rem) => {
    for (let i = 0; i < n; i++) par[i] = i;
    ops += n;
    let comps = rem === -1 ? n : n - 1;
    for (let k = 0; k < edges.length; k++) {
      const a = edges[k][0];
      const b = edges[k][1];
      ops++;
      if (a === rem || b === rem) continue;
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) {
        par[ra] = rb;
        comps--;
      }
    }
    return comps;
  };
  const base = countWithout(-1);
  const touched = new Uint8Array(n);
  for (const [a, b] of edges) { touched[a] = 1; touched[b] = 1; }
  const aps = [];
  for (let v = 0; v < n; v++) {
    const after = countWithout(v);
    const expected = base - (touched[v] ? 0 : 1);
    if (after > expected) aps.push(v);
  }
  return { aps, ops };
}

/* Tarjan's SCC, recursion is fine at the sizes used here. Components are numbered in the order they are found
   (reverse topological order of the condensation). */
export function tarjanSCC(n, edges) {
  const adj = Array.from({ length: n }, () => []);
  edges.forEach(([a, b]) => adj[a].push(b));
  const disc = Array(n).fill(-1);
  const low = Array(n).fill(0);
  const on = Array(n).fill(false);
  const comp = Array(n).fill(-1);
  const st = [];
  let t = 0;
  let count = 0;
  const dfs = (u) => {
    disc[u] = low[u] = t++;
    st.push(u);
    on[u] = true;
    for (const v of adj[u]) {
      if (disc[v] === -1) {
        dfs(v);
        low[u] = Math.min(low[u], low[v]);
      } else if (on[v]) low[u] = Math.min(low[u], disc[v]);
    }
    if (low[u] === disc[u]) {
      for (;;) {
        const w = st.pop();
        on[w] = false;
        comp[w] = count;
        if (w === u) break;
      }
      count++;
    }
  };
  for (let i = 0; i < n; i++) if (disc[i] === -1) dfs(i);
  return { comp, count };
}

/* ---------------------------- 2-SAT ---------------------------- */
// Literal l: variable l >> 1, negated when l & 1. The implication-graph vertex of a literal is the literal itself.
export const lit = (v, neg = false) => v * 2 + (neg ? 1 : 0);
export const litName = (l) => `${l & 1 ? '¬' : ''}x${(l >> 1) + 1}`;

export function solve2SAT(nVars, clauses) {
  const edges = [];
  for (const [a, b] of clauses) {
    edges.push([a ^ 1, b]); // ¬a ⇒ b
    if (a !== b) edges.push([b ^ 1, a]); // ¬b ⇒ a
  }
  const n = nVars * 2;
  const { comp, count } = tarjanSCC(n, edges);
  const conflict = [];
  for (let v = 0; v < nVars; v++) if (comp[2 * v] === comp[2 * v + 1]) conflict.push(v);
  const sat = conflict.length === 0;
  // Tarjan numbers components in reverse topological order, so x is true when its component comes first.
  const assign = sat ? Array.from({ length: nVars }, (_, v) => comp[2 * v] < comp[2 * v + 1]) : null;
  return { sat, assign, comp, count, edges, n, conflict };
}

export const bruteSAT = (nVars, clauses) => {
  for (let m = 0; m < 1 << nVars; m++) {
    const val = (l) => (((m >> (l >> 1)) & 1) === 1) !== ((l & 1) === 1);
    if (clauses.every(([a, b]) => val(a) || val(b))) return true;
  }
  return false;
};
