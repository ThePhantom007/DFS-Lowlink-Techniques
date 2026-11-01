// Three ways to find strongly connected components, written as step generators so the UI can run them
// side by side at the same speed and show which one is still working.
//
// Cost model (identical for all three, so the counts are comparable): one operation is one vertex visited,
// one edge examined, or one pair of vertices compared. Each generator yields after every operation and
// updates one shared state object { ops, found, phase, progress }.

export function raceGraph(n, seed = 7) {
  let s = seed + n * 31;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const edges = [];
  const m = Math.round(n * 1.6);
  for (let k = 0; k < m; k++) {
    const a = Math.floor(r() * n);
    const b = Math.floor(r() * n);
    if (a !== b) edges.push([a, b]);
  }
  return { n, edges };
}

const adjOf = (n, edges) => {
  const adj = Array.from({ length: n }, () => []);
  edges.forEach(([a, b]) => adj[a].push(b));
  return adj;
};

/* 1. Naive: find everything each vertex can reach, then u and v share a component iff u reaches v and v reaches u.
   Cost: V searches of O(V + E) each, plus V^2 / 2 pair checks. */
export function* naiveSCC(n, edges, st) {
  const adj = adjOf(n, edges);
  const reach = new Uint8Array(n * n);
  const stack = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    st.phase = `searching from vertex ${s}`;
    st.progress = s / n / 2;
    let top = 0;
    stack[top++] = s;
    reach[s * n + s] = 1;
    st.ops++;
    yield st;
    while (top) {
      const u = stack[--top];
      for (const v of adj[u]) {
        st.ops++;
        if (!reach[s * n + v]) {
          reach[s * n + v] = 1;
          st.ops++;
          stack[top++] = v;
        }
        yield st;
      }
    }
  }
  const comp = Array(n).fill(-1);
  let count = 0;
  for (let u = 0; u < n; u++) {
    st.phase = `matching vertex ${u} with every other`;
    st.progress = 0.5 + u / n / 2;
    if (comp[u] !== -1) continue;
    comp[u] = count;
    for (let v = u + 1; v < n; v++) {
      st.ops++;
      if (comp[v] === -1 && reach[u * n + v] && reach[v * n + u]) comp[v] = count;
      yield st;
    }
    count++;
    st.found = count;
  }
  st.progress = 1;
  st.phase = 'done';
  return { comp, count };
}

/* 2. Kosaraju: DFS on G to get finish order, reverse every edge, then DFS on the reversed graph in decreasing finish order.
   Each tree of the second pass is one SCC. Cost: 2 (V + E) plus E to build the reverse graph. */
export function* kosarajuSCC(n, edges, st) {
  const adj = adjOf(n, edges);
  const seen = new Uint8Array(n);
  const order = [];
  const stack = new Int32Array(n);
  const ptr = new Int32Array(n);
  st.phase = 'pass 1: DFS to record finish order';
  for (let s = 0; s < n; s++) {
    st.progress = (s / n) / 3;
    if (seen[s]) continue;
    let top = 0;
    stack[top++] = s;
    seen[s] = 1;
    st.ops++;
    yield st;
    while (top) {
      const u = stack[top - 1];
      if (ptr[u] < adj[u].length) {
        const v = adj[u][ptr[u]++];
        st.ops++;
        if (!seen[v]) {
          seen[v] = 1;
          st.ops++;
          stack[top++] = v;
        }
        yield st;
      } else {
        order.push(u);
        top--;
      }
    }
  }
  st.phase = 'reversing every edge';
  const radj = Array.from({ length: n }, () => []);
  for (let k = 0; k < edges.length; k++) {
    radj[edges[k][1]].push(edges[k][0]);
    st.ops++;
    st.progress = 1 / 3 + (k / Math.max(1, edges.length)) / 3;
    yield st;
  }
  st.phase = 'pass 2: DFS on the reversed graph';
  const comp = Array(n).fill(-1);
  let count = 0;
  for (let i = n - 1; i >= 0; i--) {
    const s = order[i];
    st.progress = 2 / 3 + ((n - 1 - i) / n) / 3;
    if (comp[s] !== -1) continue;
    let top = 0;
    stack[top++] = s;
    comp[s] = count;
    st.ops++;
    yield st;
    while (top) {
      const u = stack[--top];
      for (const v of radj[u]) {
        st.ops++;
        if (comp[v] === -1) {
          comp[v] = count;
          st.ops++;
          stack[top++] = v;
        }
        yield st;
      }
    }
    count++;
    st.found = count;
  }
  st.progress = 1;
  st.phase = 'done';
  return { comp, count };
}

/* 3. Tarjan: one DFS with disc / low and a stack. Cost: V + E. */
export function* tarjanRace(n, edges, st) {
  const adj = adjOf(n, edges);
  const disc = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const on = new Uint8Array(n);
  const ptr = new Int32Array(n);
  const call = new Int32Array(n);
  const vs = new Int32Array(n);
  const comp = Array(n).fill(-1);
  let t = 0;
  let count = 0;
  let sp = 0;
  st.phase = 'one DFS with disc / low';
  for (let s = 0; s < n; s++) {
    st.progress = s / n;
    if (disc[s] !== -1) continue;
    let top = 0;
    call[top++] = s;
    disc[s] = low[s] = t++;
    vs[sp++] = s;
    on[s] = 1;
    st.ops++;
    yield st;
    while (top) {
      const u = call[top - 1];
      if (ptr[u] < adj[u].length) {
        const v = adj[u][ptr[u]++];
        st.ops++;
        if (disc[v] === -1) {
          disc[v] = low[v] = t++;
          vs[sp++] = v;
          on[v] = 1;
          st.ops++;
          call[top++] = v;
        } else if (on[v] && disc[v] < low[u]) low[u] = disc[v];
        yield st;
      } else {
        if (low[u] === disc[u]) {
          for (;;) {
            const w = vs[--sp];
            on[w] = 0;
            comp[w] = count;
            if (w === u) break;
          }
          count++;
          st.found = count;
        }
        top--;
        if (top) {
          const p = call[top - 1];
          if (low[u] < low[p]) low[p] = low[u];
        }
      }
    }
  }
  st.progress = 1;
  st.phase = 'done';
  return { comp, count };
}

export const newState = () => ({ ops: 0, found: 0, phase: 'waiting', progress: 0 });

/* Run a generator to the end. Returns the result plus the operation count and wall-clock milliseconds. */
export function drain(make, n, edges) {
  const st = newState();
  const g = make(n, edges, st);
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let r = g.next();
  while (!r.done) r = g.next();
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return { ...r.value, ops: st.ops, ms };
}

export const ALGOS = [
  { id: 'naive', name: 'Naive', make: naiveSCC, big: 'O(V · (V + E))', color: 'var(--orange)', blurb: 'Search from every vertex, then pair up vertices that reach each other.' },
  { id: 'kosaraju', name: 'Kosaraju', make: kosarajuSCC, big: 'O(V + E), two passes', color: 'var(--violet)', blurb: 'DFS for finish order, reverse the edges, DFS again in that order.' },
  { id: 'tarjan', name: 'Tarjan', make: tarjanRace, big: 'O(V + E), one pass', color: 'var(--accent)', blurb: 'One DFS with disc / low and a stack; pop a component at each root.' },
];
