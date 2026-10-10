// Step-by-step traces of the DFS low-link algorithms.
// Each trace is an array of immutable snapshots. A snapshot carries everything the UI
// needs: disc/low arrays, vertex states, edge classifications, stacks, results so far,
// the C++ line to highlight, a narration message and (optionally) a quiz question.

import { CODE } from './code.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

export function buildAdj(n, edges, directed) {
  const adj = Array.from({ length: n }, () => []);
  edges.forEach(([u, v], id) => {
    adj[u].push({ to: v, id });
    if (!directed) adj[v].push({ to: u, id });
  });
  return adj;
}

function makeRecorder(n, m, mode) {
  const st = {
    disc: Array(n).fill(-1),
    low: Array(n).fill(-1),
    vstate: Array(n).fill(0), // 0 unvisited, 1 on the DFS path, 2 finished
    cur: -1,
    hl: -1,
    edgeKind: Array(m).fill(null),
    callStack: [],
    stack: [], // edge ids (bcc) or vertices (scc)
    onStack: Array(n).fill(false),
    aps: [],
    bridges: [],
    blocks: [], // lists of edge ids
    sccs: [], // lists of vertices
    blockOfEdge: Array(m).fill(-1),
    sccOf: Array(n).fill(-1),
    timer: 0,
  };
  const steps = [];
  const L = CODE[mode].marks;
  const snap = (key, msg, extra = {}) => {
    steps.push({ ...clone(st), line: L[key] ?? -1, msg, kind: 'info', ...extra });
  };
  return { st, steps, snap };
}

const yesNo = (q, ans, why) => ({ q, options: ['Yes', 'No'], answer: ans ? 0 : 1, why });
const pick = (q, vals, ans, why) => {
  const opts = [...new Set(vals)].sort((a, b) => a - b);
  return { q, options: opts.map(String), answer: opts.indexOf(ans), why };
};

const plural = (k, w) => `${k} ${w}${k === 1 ? '' : 's'}`;

function rootsOrder(n, start) {
  const s = start >= 0 && start < n ? start : 0;
  return [s, ...Array.from({ length: n }, (_, i) => i).filter((i) => i !== s)];
}

/* ------------------------------------------------------------------ */
/*  Undirected: articulation points, bridges, biconnected components   */
/* ------------------------------------------------------------------ */
export function traceUndirected(mode, g, start = 0) {
  const { n, edges } = g;
  const adj = buildAdj(n, edges, false);
  const { st, steps, snap } = makeRecorder(n, edges.length, mode);
  const apSet = new Set();
  const markAP = (u) => {
    apSet.add(u);
    st.aps = [...apSet].sort((a, b) => a - b);
  };

  function dfs(u, pe) {
    st.disc[u] = st.low[u] = st.timer++;
    st.vstate[u] = 1;
    st.cur = u;
    st.hl = -1;
    st.callStack.push(u);
    snap('visit', `Visit ${u}: disc[${u}] = low[${u}] = ${st.disc[u]}. For now ${u} can only "reach" itself, so low equals disc.`);
    let children = 0;

    for (const { to: v, id } of adj[u]) {
      if (id === pe) continue; // never walk back along the edge we arrived by
      st.cur = u;
      st.hl = id;

      if (st.disc[v] === -1) {
        /* ---------- tree edge ---------- */
        children++;
        st.edgeKind[id] = 'tree';
        if (mode === 'bcc') st.stack.push(id);
        snap('tree', `Edge ${u}–${v}: ${v} is unvisited, so this is a TREE edge.${mode === 'bcc' ? ' Push it on the edge stack.' : ''} Recurse into ${v}.`);
        dfs(v, id);

        st.cur = u;
        st.hl = id;
        const old = st.low[u];
        const lv = st.low[v];
        const nw = Math.min(old, lv);
        if (old !== lv) {
          snap('lowUp', `Back from ${v}. Its subtree can climb as high as low[${v}] = ${lv}; ${u} currently has low[${u}] = ${old}.`, {
            kind: 'ask',
            quiz: pick(`${u}'s subtree includes ${v}'s subtree. What is low[${u}] after absorbing child ${v}? (now ${old}; child has ${lv})`, [old, lv], nw, `low is a minimum over the whole subtree, so ${u} inherits whatever the child can reach: min(${old}, ${lv}) = ${nw}.`),
          });
        }
        st.low[u] = nw;
        snap('lowUp', `low[${u}] = min(${old}, low[${v}] = ${lv}) = ${nw}.`);

        if (mode === 'ap' && pe !== -1) {
          const cond = lv >= st.disc[u];
          snap('check', `Non-root test for ${u} and child ${v}: is low[${v}] = ${lv} ≥ disc[${u}] = ${st.disc[u]}?`, {
            kind: 'ask',
            quiz: yesNo(`low[${v}] = ${lv} and disc[${u}] = ${st.disc[u]}. Is ${u} an articulation point because of child ${v}?`, cond, cond ? `${lv} ≥ ${st.disc[u]}: ${v}'s subtree cannot climb strictly above ${u}, so every path out of it passes through ${u}.` : `${lv} < ${st.disc[u]}: a back edge from ${v}'s subtree lands strictly above ${u}, giving it a detour around ${u}.`),
          });
          if (cond) {
            markAP(u);
            snap('verdict', `${lv} ≥ ${st.disc[u]} → ${v}'s subtree cannot climb above ${u}. Delete ${u} and that subtree is cut off. ${u} is an ARTICULATION POINT.`, { kind: 'verdict' });
          } else {
            snap('check', `${lv} < ${st.disc[u]} → a back edge from ${v}'s subtree escapes above ${u}. This child does NOT make ${u} a cut vertex.`, { kind: 'verdict' });
          }
        }

        if (mode === 'bridge') {
          const cond = lv > st.disc[u];
          snap('check', `Bridge test for edge ${u}–${v}: is low[${v}] = ${lv} > disc[${u}] = ${st.disc[u]}? (strictly greater)`, {
            kind: 'ask',
            quiz: yesNo(`low[${v}] = ${lv}, disc[${u}] = ${st.disc[u]}. Is edge ${u}–${v} a bridge?`, cond, cond ? `${lv} > ${st.disc[u]}: the subtree of ${v} cannot even get back to ${u}, so ${u}–${v} is its only link.` : lv === st.disc[u] ? `Equal is NOT enough for a bridge: a back edge lands exactly on ${u}, so ${u}–${v} lies on a cycle.` : `${lv} < ${st.disc[u]}: a back edge goes above ${u}, so ${u}–${v} lies on a cycle.`),
          });
          if (cond) {
            st.edgeKind[id] = 'bridge';
            st.bridges.push(id);
            snap('verdict', `${lv} > ${st.disc[u]} → nothing in ${v}'s subtree reaches ${u} or above except through ${u}–${v}. It is a BRIDGE.`, { kind: 'verdict' });
          } else if (lv === st.disc[u]) {
            snap('check', `low[${v}] = disc[${u}] = ${lv}: equal, not greater. A back edge lands exactly on ${u}, so ${u}–${v} is on a cycle → not a bridge (though ${u} can still be an articulation point).`, { kind: 'verdict' });
          } else {
            snap('check', `${lv} < ${st.disc[u]} → a back edge reaches above ${u}, so ${u}–${v} is on a cycle → not a bridge.`, { kind: 'verdict' });
          }
        }

        if (mode === 'bcc') {
          const cond = lv >= st.disc[u];
          snap('check', `Does the subtree of ${v} close off a block at ${u}? Test low[${v}] = ${lv} ≥ disc[${u}] = ${st.disc[u]}.`, {
            kind: 'ask',
            quiz: yesNo(`low[${v}] = ${lv}, disc[${u}] = ${st.disc[u]}. Should we pop a biconnected component off the edge stack now?`, cond, cond ? `${lv} ≥ ${st.disc[u]}: ${v}'s subtree is sealed off by ${u} (the same test as for articulation points), so the edges above ${u}–${v} on the stack form a complete block.` : `${lv} < ${st.disc[u]}: the subtree can still reach above ${u}, so its edges belong to a bigger block that is not finished yet.`),
          });
          if (cond) {
            const block = [];
            for (;;) {
              const e = st.stack.pop();
              block.push(e);
              st.blockOfEdge[e] = st.blocks.length;
              if (e === id) break;
            }
            st.blocks.push(block);
            const cut = pe !== -1;
            if (cut) markAP(u);
            snap('block', `${lv} ≥ ${st.disc[u]} → pop edges down to and including ${u}–${v}. Block #${st.blocks.length} = ${block.map((e) => `${edges[e][0]}–${edges[e][1]}`).join(', ')}.${cut ? ` ${u} is shared with the part above it, so ${u} is an articulation point.` : ''}`, { kind: 'verdict' });
          } else {
            snap('check', `${lv} < ${st.disc[u]} → keep the edges on the stack; the block continues above ${u}.`, { kind: 'verdict' });
          }
        }
      } else if (st.disc[v] < st.disc[u]) {
        /* ---------- back edge to an ancestor ---------- */
        st.edgeKind[id] = 'back';
        const old = st.low[u];
        const dv = st.disc[v];
        const nw = Math.min(old, dv);
        const key = mode === 'bcc' ? 'pushBack' : 'back';
        if (old !== dv) {
          snap('back', `Edge ${u}–${v}: ${v} is already visited and is an ancestor (disc ${dv} < ${st.disc[u]}), so this is a BACK edge.`, {
            kind: 'ask',
            quiz: pick(`The back edge lands on ${v} with disc[${v}] = ${dv}. low[${u}] is ${old} now. What is the new low[${u}]?`, [old, dv], nw, `A back edge lets ${u} jump straight to ${v}, so low[${u}] = min(${old}, ${dv}) = ${nw}.`),
          });
        }
        if (mode === 'bcc') st.stack.push(id);
        st.low[u] = nw;
        snap(key, `Back edge ${u}–${v}.${mode === 'bcc' ? ' Push it on the edge stack (once!).' : ''} low[${u}] = min(${old}, disc[${v}] = ${dv}) = ${nw}.`);
      } else {
        /* ---------- same back edge, seen from the ancestor ---------- */
        snap('back', `Edge ${u}–${v}: ${v} is a descendant that is already finished. This is the same back edge we handled from ${v}'s side, so there is nothing to do.`);
      }
    }

    if (pe === -1 && mode === 'ap') {
      const cond = children > 1;
      snap('root', `${u} is the DFS root and has ${plural(children, 'child')} in the DFS tree.`, {
        kind: 'ask',
        quiz: yesNo(`Root ${u} finished with ${plural(children, 'DFS child')}. Is it an articulation point?`, cond, `A root is a cut vertex exactly when it has 2 or more DFS children: separate child subtrees have no edges between them (no cross edges in an undirected DFS).`),
      });
      if (cond) {
        markAP(u);
        snap('root', `${children} ≥ 2 children → the child subtrees are only connected through ${u}. ${u} is an ARTICULATION POINT.`, { kind: 'verdict' });
      } else {
        snap('root', `Only ${plural(children, 'child')} → removing ${u} cannot split the rest. Not an articulation point.`, { kind: 'verdict' });
      }
    }
    if (pe === -1 && mode === 'bcc' && children > 1) {
      markAP(u);
    }

    st.vstate[u] = 2;
    st.callStack.pop();
    st.cur = u;
    st.hl = -1;
    snap('finish', `Finish ${u}.${pe === -1 && mode === 'bcc' && children > 1 ? ` The root has ${children} children, so ${u} is an articulation point.` : ''}`);
  }

  snap('main', 'Initial state: every disc[] and low[] is -1 (unvisited). Pick a start vertex and run the DFS.');
  let first = true;
  for (const r of rootsOrder(n, start)) {
    if (st.disc[r] !== -1) continue;
    if (!first) snap('main', `Vertex ${r} was not reached — the graph is disconnected. Start a fresh DFS tree at ${r}.`);
    first = false;
    st.cur = r;
    dfs(r, -1);
  }

  st.cur = -1;
  st.hl = -1;
  let summary = '';
  if (mode === 'ap') summary = st.aps.length ? `Done. Articulation points: ${st.aps.join(', ')}.` : 'Done. No articulation points — no single vertex failure disconnects the graph.';
  if (mode === 'bridge') summary = st.bridges.length ? `Done. Bridges: ${st.bridges.map((e) => `${edges[e][0]}–${edges[e][1]}`).join(', ')}.` : 'Done. No bridges — every edge lies on a cycle.';
  if (mode === 'bcc') summary = `Done. ${plural(st.blocks.length, 'biconnected component')}.${st.aps.length ? ` Articulation points: ${st.aps.join(', ')}.` : ' No articulation points.'}`;
  snap('main', summary, { kind: 'done' });
  return steps;
}

/* ------------------------------------------------------------------ */
/*  Directed: strongly connected components (Tarjan)                   */
/* ------------------------------------------------------------------ */
export function traceSCC(g, start = 0) {
  const { n, edges } = g;
  const adj = buildAdj(n, edges, true);
  const { st, steps, snap } = makeRecorder(n, edges.length, 'scc');

  function dfs(u) {
    st.disc[u] = st.low[u] = st.timer++;
    st.vstate[u] = 1;
    st.onStack[u] = true;
    st.stack.push(u);
    st.callStack.push(u);
    st.cur = u;
    st.hl = -1;
    snap('visit', `Visit ${u}: disc[${u}] = low[${u}] = ${st.disc[u]}. Push ${u} onto Tarjan's stack.`);

    for (const { to: v, id } of adj[u]) {
      st.cur = u;
      st.hl = id;
      if (st.disc[v] === -1) {
        st.edgeKind[id] = 'tree';
        snap('tree', `Edge ${u}→${v}: ${v} is unvisited → TREE edge. Recurse into ${v}.`);
        dfs(v);
        st.cur = u;
        st.hl = id;
        const old = st.low[u];
        const lv = st.low[v];
        const nw = Math.min(old, lv);
        if (old !== lv) {
          snap('lowUp', `Back from ${v}: low[${v}] = ${lv}, while low[${u}] = ${old}.`, {
            kind: 'ask',
            quiz: pick(`What is low[${u}] after returning from child ${v}? (now ${old}; child has ${lv})`, [old, lv], nw, `${u} can reach everything its child can reach: min(${old}, ${lv}) = ${nw}.`),
          });
        }
        st.low[u] = nw;
        snap('lowUp', `low[${u}] = min(${old}, low[${v}] = ${lv}) = ${nw}.`);
      } else {
        const kind = st.vstate[v] === 1 ? 'back' : st.disc[v] > st.disc[u] ? 'forward' : 'cross';
        st.edgeKind[id] = kind;
        const on = st.onStack[v];
        snap('check', `Edge ${u}→${v}: ${v} was already visited — a ${kind.toUpperCase()} edge. Is ${v} still on Tarjan's stack?`, {
          kind: 'ask',
          quiz: yesNo(`${kind[0].toUpperCase() + kind.slice(1)} edge ${u}→${v}. Is ${v} still on Tarjan's stack (not yet assigned to a finished SCC)?`, on, on ? `${v} is still waiting for its SCC root to be found, so it may be in the same component as ${u}.` : `${v} was already popped into a finished SCC; it can't share a component with ${u}, or that SCC would have been bigger.`),
        });
        if (on) {
          const old = st.low[u];
          const nw = Math.min(old, st.disc[v]);
          st.low[u] = nw;
          snap('back', `Yes: ${v} is still on the stack, so it belongs to a component still under construction. low[${u}] = min(${old}, disc[${v}] = ${st.disc[v]}) = ${nw}.`, { kind: 'verdict' });
        } else {
          snap('ignore', `No: ${v} is already in a finished SCC, so the edge is ignored. This is exactly why Tarjan's algorithm needs onStack[] — without it this cross edge would wrongly lower low[${u}].`, { kind: 'verdict' });
        }
      }
    }

    const isRoot = st.low[u] === st.disc[u];
    snap('root', `All edges of ${u} done. Test: low[${u}] = ${st.low[u]}, disc[${u}] = ${st.disc[u]}. Is ${u} the root of an SCC?`, {
      kind: 'ask',
      quiz: yesNo(`low[${u}] = ${st.low[u]} and disc[${u}] = ${st.disc[u]}. Is ${u} the root of a strongly connected component?`, isRoot, isRoot ? `low = disc means nothing in ${u}'s subtree can reach an earlier vertex still on the stack, so ${u} is the first vertex of its SCC.` : `low < disc means ${u} can still reach an earlier vertex on the stack, so ${u} belongs to an SCC whose root is higher up.`),
    });
    if (isRoot) {
      const comp = [];
      for (;;) {
        const w = st.stack.pop();
        st.onStack[w] = false;
        st.sccOf[w] = st.sccs.length;
        comp.push(w);
        if (w === u) break;
      }
      comp.sort((a, b) => a - b);
      st.sccs.push(comp);
      snap('block', `low = disc → ${u} is an SCC root. Pop the stack down to ${u}: SCC #${st.sccs.length} = {${comp.join(', ')}}.`, { kind: 'verdict' });
    } else {
      snap('root', `low[${u}] < disc[${u}] → ${u} can still reach a vertex below it on the stack. It stays on the stack; its root will collect it.`, { kind: 'verdict' });
    }

    st.vstate[u] = 2;
    st.callStack.pop();
    st.cur = u;
    st.hl = -1;
    snap('finish', `Finish ${u}.`);
  }

  snap('main', "Initial state: nothing visited, Tarjan's stack is empty.");
  let first = true;
  for (const r of rootsOrder(n, start)) {
    if (st.disc[r] !== -1) continue;
    if (!first) snap('main', `Vertex ${r} has not been reached yet. Start a fresh DFS tree at ${r}.`);
    first = false;
    dfs(r);
  }
  st.cur = -1;
  st.hl = -1;
  snap('main', `Done. ${plural(st.sccs.length, 'strongly connected component')}: ${st.sccs.map((c) => `{${c.join(', ')}}`).join('  ')}.`, { kind: 'done' });
  return steps;
}

export function runTrace(mode, g, start) {
  if (g.n === 0) return [];
  return mode === 'scc' ? traceSCC(g, start) : traceUndirected(mode, g, start);
}

/* ------------------------------------------------------------------ */
/*  Block-cut tree                                                     */
/* ------------------------------------------------------------------ */
export function blockCutTree(blocks, edges) {
  const bv = blocks.map((b) => [...new Set(b.flatMap((e) => edges[e]))].sort((a, c) => a - c));
  const count = {};
  bv.forEach((vs) => vs.forEach((v) => (count[v] = (count[v] || 0) + 1)));
  const cuts = Object.keys(count).filter((v) => count[v] > 1).map(Number).sort((a, b) => a - b);
  const links = [];
  bv.forEach((vs, i) => vs.forEach((v) => count[v] > 1 && links.push([i, v])));
  return { blocks: bv, cuts, links };
}
