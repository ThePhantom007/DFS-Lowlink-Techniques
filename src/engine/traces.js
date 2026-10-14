// Step-by-step traces of the DFS low-link algorithms.
// Each trace is an array of immutable snapshots. A snapshot carries everything the UI
// needs: disc/low arrays, vertex states, edge classifications, stacks, results so far,
// the C++ line to highlight, a narration message and (optionally) a quiz question.

import { CODE, BUGS } from './code.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

export function buildAdj(n, edges, directed) {
  const adj = Array.from({ length: n }, () => []);
  edges.forEach(([u, v], id) => {
    adj[u].push({ to: v, id });
    if (!directed) adj[v].push({ to: u, id });
  });
  return adj;
}

function makeRecorder(n, m, mode, bugMode = false) {
  const st = {
    parent: Array(n).fill(-1), // DFS-tree parent vertex (-1 = root / not reached)
    pedge: Array(n).fill(-1), // id of the tree edge that reached each vertex
    lowSrc: Array(n).fill(null), // what last lowered low[v]: { k: 'back'|'child', v, id? }
    ops: { v: 0, e: 0 }, // vertices visited / adjacency entries examined (for the operation counter)
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
  // `pre` lists the marks of lines that execute just before `key`, so the code highlight
  // can walk through them in order instead of jumping straight to the destination line.
  const snap = (key, msg, extra = {}) => {
    const { pre = [], ...rest } = extra;
    if (bugMode) {
      // predict-mode questions describe the CORRECT algorithm, so they are switched off while a bug is injected
      delete rest.quiz;
      if (rest.kind === 'ask') rest.kind = 'info';
    }
    const keys = [...pre, key].filter((k) => L[k] !== undefined);
    const lines = keys.map((k) => L[k]);
    const trail = lines.filter((x, i) => i === 0 || x !== lines[i - 1]);
    const trailKeys = keys.filter((x, i) => i === 0 || L[x] !== L[keys[i - 1]]);
    steps.push({ ...clone(st), line: L[key] ?? -1, trail, key, trailKeys, msg, kind: 'info', ...rest });
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
// `bug` injects one of the classic mistakes from code.js (BUGS). `ref` is the final state of the correct run
// (only needed by the bugs that must know what the right answer is, e.g. rootAlways).
// Steps where the buggy line behaves differently from the correct line carry a `hit` object.
export function traceUndirected(mode, g, start = 0, bug = null, ref = null) {
  const { n, edges } = g;
  const B = bug && BUGS[bug] && BUGS[bug].modes.includes(mode) ? bug : null;
  const adj = buildAdj(n, edges, false);
  const { st, steps, snap } = makeRecorder(n, edges.length, mode, !!B);
  const callPath = mode === 'ap' ? ['child', 'recurse'] : mode === 'bcc' ? ['push', 'recurse'] : ['recurse'];
  const apSet = new Set();
  const markAP = (u) => {
    apSet.add(u);
    st.aps = [...apSet].sort((a, b) => a - b);
  };
  const refChildren = (u) => (ref ? ref.parent.filter((p) => p === u).length : 0);

  function dfs(u, pe, pv) {
    st.disc[u] = st.low[u] = st.timer++;
    st.vstate[u] = 1;
    st.cur = u;
    st.hl = -1;
    st.ops.v++;
    st.callStack.push(u);
    snap('visit', `Visit ${u}: disc[${u}] = low[${u}] = ${st.disc[u]}. For now ${u} can only "reach" itself, so low equals disc.`, { pre: pe === -1 ? ['main', 'enter'] : [...callPath, 'enter'] });
    let children = 0;
    let pendingInit = true; // 'int children = 0;' runs once, before the first loop iteration
    const loopPre = () => {
      const base = pendingInit ? ['init', 'loop', 'skip'] : ['loop', 'skip'];
      pendingInit = false;
      return base;
    };

    for (const { to: v, id } of adj[u]) {
      st.ops.e++;
      if (B === 'parentVertex') {
        if (v === pv) {
          if (id !== pe) {
            st.cur = u;
            st.hl = id;
            snap('skip', `Edge ${u}–${v} is a PARALLEL edge to the parent ${v}. The buggy code skips by vertex (v == parent), so it throws this edge away.`, {
              kind: 'bug',
              pre: loopPre(),
              hit: { title: 'A parallel edge was skipped', why: `Edge ${u}–${v} (id ${id}) is a second edge between ${u} and its parent ${v}, so it is a real back edge and would give low[${u}] = min(${st.low[u]}, disc[${v}] = ${st.disc[v]}) = ${Math.min(st.low[u], st.disc[v])}. Skipping by vertex ignores it.` },
            });
          }
          continue;
        }
      } else if (id === pe) continue; // never walk back along the edge we arrived by
      st.cur = u;
      st.hl = id;

      if (st.disc[v] === -1) {
        /* ---------- tree edge ---------- */
        children++;
        st.edgeKind[id] = 'tree';
        st.parent[v] = u;
        st.pedge[v] = id;
        if (mode === 'bcc') st.stack.push(id);
        snap('tree', `Edge ${u}–${v}: ${v} is unvisited, so this is a TREE edge.${mode === 'bcc' ? ' Push it on the edge stack.' : ''} Recurse into ${v}.`, { pre: loopPre(), ev: { type: 'tree', u, v, id } });
        dfs(v, id, u);

        st.cur = u;
        st.hl = id;
        const old = st.low[u];
        const lv = st.low[v];
        const nwC = Math.min(old, lv);
        const nw = B === 'childDisc' ? Math.min(old, st.disc[v]) : nwC;
        if (old !== lv) {
          snap('lowUp', `Back from ${v}. Its subtree can climb as high as low[${v}] = ${lv}; ${u} currently has low[${u}] = ${old}.`, {
            kind: 'ask',
            pre: ['recurse'],
            quiz: pick(`${u}'s subtree includes ${v}'s subtree. What is low[${u}] after absorbing child ${v}? (now ${old}; child has ${lv})`, [old, lv], nwC, `low is a minimum over the whole subtree, so ${u} inherits whatever the child can reach: min(${old}, ${lv}) = ${nwC}.`),
          });
        }
        st.low[u] = nw;
        if (nw < old) st.lowSrc[u] = { k: 'child', v };
        const lowEv = { type: 'low', u, k: 'child', v, old, nw };
        if (B === 'childDisc') {
          snap('lowUp', `low[${u}] = min(${old}, disc[${v}] = ${st.disc[v]}) = ${nw}.${nw !== nwC ? ` BUG: the child's low[${v}] = ${lv} should have been used, giving ${nwC}.` : ''}`, {
            ev: lowEv,
            ...(nw !== nwC ? { kind: 'bug', hit: { title: `low[${u}] was not lowered by child ${v}`, why: `The code takes disc[${v}] = ${st.disc[v]}, which is larger than disc[${u}], so the min changes nothing. Child ${v}'s subtree reaches low[${v}] = ${lv}, so low[${u}] should have become ${nwC}. Everything above ${u} now believes this subtree has no way out.` } } : {}),
          });
        } else {
          snap('lowUp', `low[${u}] = min(${old}, low[${v}] = ${lv}) = ${nw}.`, { ev: lowEv });
        }

        if (mode === 'ap' && (pe !== -1 || B === 'rootAlways')) {
          const strict = B === 'apGt';
          const d = st.disc[u];
          const condC = pe !== -1 && lv >= d;
          const cond = strict ? lv > d : lv >= d;
          const op = strict ? '>' : '≥';
          const ev = { type: 'test', u, v, op, cond, lv, d };
          let hit;
          if (cond !== condC) {
            if (B === 'rootAlways') {
              if (refChildren(u) <= 1) hit = { title: `Root ${u} flagged although it has one DFS child`, why: `${u} is the DFS root: disc[${u}] = ${d} is the smallest value, so low[${v}] = ${lv} ≥ ${d} is always true. Without the parentEdge != -1 guard the first child of the root marks it. A root needs 2 or more DFS children, and ${u} has only ${refChildren(u)}.` };
            } else {
              hit = { title: `${u} should have been marked`, why: `low[${v}] = ${lv} equals disc[${u}] = ${d}: the subtree of ${v} reaches ${u} itself but nothing above it. Remove ${u} and that subtree is cut off, so ${u} IS an articulation point. The strict test low[${v}] > disc[${u}] says no.` };
            }
          }
          snap('check', `${pe === -1 ? `Test for ${u} (the root!)` : `Non-root test for ${u} and child ${v}`}: is low[${v}] = ${lv} ${op} disc[${u}] = ${d}?`, {
            kind: 'ask',
            ev,
            quiz: yesNo(`low[${v}] = ${lv} and disc[${u}] = ${d}. Is ${u} an articulation point because of child ${v}?`, cond, cond ? `${lv} ≥ ${d}: ${v}'s subtree cannot climb strictly above ${u}, so every path out of it passes through ${u}.` : `${lv} < ${d}: a back edge from ${v}'s subtree lands strictly above ${u}, giving it a detour around ${u}.`),
          });
          if (cond) {
            markAP(u);
            snap('verdict', `${lv} ${op} ${d} → ${v}'s subtree cannot climb above ${u}. Delete ${u} and that subtree is cut off. ${u} is an ARTICULATION POINT.${hit ? ' BUG: but a root only counts with 2+ children.' : ''}`, { kind: hit ? 'bug' : 'verdict', ev, ...(hit ? { hit } : {}) });
          } else if (hit) {
            snap('check', `${lv} > ${d} is false because they are equal → this child does not cut ${u}. BUG: with ≥ it would.`, { kind: 'bug', ev, hit });
          } else {
            snap('check', `${lv} < ${d} → a back edge from ${v}'s subtree escapes above ${u}. This child does NOT make ${u} a cut vertex.`, { kind: 'verdict', ev });
          }
        }

        if (mode === 'bridge') {
          const ge = B === 'bridgeGe';
          const d = st.disc[u];
          const condC = lv > d;
          const cond = ge ? lv >= d : condC;
          const op = ge ? '≥' : '>';
          const ev = { type: 'test', u, v, op, cond, lv, d };
          const hit = cond !== condC ? { title: `${u}–${v} reported as a bridge but lies on a cycle`, why: `low[${v}] = disc[${u}] = ${d}: a back edge from ${v}'s subtree lands exactly on ${u}, so ${u}–${v} is on a cycle and removing it disconnects nothing. A bridge needs low[${v}] > disc[${u}] (strictly).` } : undefined;
          snap('check', `Bridge test for edge ${u}–${v}: is low[${v}] = ${lv} ${op} disc[${u}] = ${d}?${ge ? '' : ' (strictly greater)'}`, {
            kind: 'ask',
            ev,
            quiz: yesNo(`low[${v}] = ${lv}, disc[${u}] = ${d}. Is edge ${u}–${v} a bridge?`, cond, cond ? `${lv} > ${d}: the subtree of ${v} cannot even get back to ${u}, so ${u}–${v} is its only link.` : lv === d ? `Equal is NOT enough for a bridge: a back edge lands exactly on ${u}, so ${u}–${v} lies on a cycle.` : `${lv} < ${d}: a back edge goes above ${u}, so ${u}–${v} lies on a cycle.`),
          });
          if (cond) {
            st.edgeKind[id] = 'bridge';
            st.bridges.push(id);
            snap('verdict', hit ? `${lv} ≥ ${d} → the buggy code declares ${u}–${v} a BRIDGE. BUG: equality means a back edge lands on ${u}, so the edge is on a cycle.` : `${lv} ${op} ${d} → nothing in ${v}'s subtree reaches ${u} or above except through ${u}–${v}. It is a BRIDGE.`, { kind: hit ? 'bug' : 'verdict', ev, ...(hit ? { hit } : {}) });
          } else if (lv === d) {
            snap('check', `low[${v}] = disc[${u}] = ${lv}: equal, not greater. A back edge lands exactly on ${u}, so ${u}–${v} is on a cycle → not a bridge (though ${u} can still be an articulation point).`, { kind: 'verdict', ev });
          } else {
            snap('check', `${lv} < ${d} → a back edge reaches above ${u}, so ${u}–${v} is on a cycle → not a bridge.`, { kind: 'verdict', ev });
          }
        }

        if (mode === 'bcc') {
          const strict = B === 'apGt';
          const d = st.disc[u];
          const condC = lv >= d;
          const cond = strict ? lv > d : condC;
          const op = strict ? '>' : '≥';
          const ev = { type: 'test', u, v, op, cond, lv, d };
          const hit = cond !== condC ? { title: `Block at ${u} not closed`, why: `low[${v}] = disc[${u}] = ${d}: ${v}'s subtree is sealed off by ${u} (a back edge lands exactly on ${u}), so the edges down to ${u}–${v} are a finished block. The strict test low[${v}] > disc[${u}] refuses to pop, so this block stays on the stack and is merged into the next one.` } : undefined;
          snap('check', `Does the subtree of ${v} close off a block at ${u}? Test low[${v}] = ${lv} ${op} disc[${u}] = ${d}.`, {
            kind: 'ask',
            ev,
            quiz: yesNo(`low[${v}] = ${lv}, disc[${u}] = ${d}. Should we pop a biconnected component off the edge stack now?`, cond, cond ? `${lv} ≥ ${d}: ${v}'s subtree is sealed off by ${u} (the same test as for articulation points), so the edges above ${u}–${v} on the stack form a complete block.` : `${lv} < ${d}: the subtree can still reach above ${u}, so its edges belong to a bigger block that is not finished yet.`),
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
            snap('block', `${lv} ${op} ${d} → pop edges down to and including ${u}–${v}. Block #${st.blocks.length} = ${block.map((e) => `${edges[e][0]}–${edges[e][1]}`).join(', ')}.${cut ? ` ${u} is shared with the part above it, so ${u} is an articulation point.` : ''}`, { kind: 'verdict', pre: ['pop'], ev });
          } else if (hit) {
            snap('check', `${lv} > ${d} is false because they are equal → the buggy code keeps the edges on the stack. BUG: the block at ${u} should have been popped here.`, { kind: 'bug', ev, hit });
          } else {
            snap('check', `${lv} < ${d} → keep the edges on the stack; the block continues above ${u}.`, { kind: 'verdict', ev });
          }
        }
      } else if (st.disc[v] < st.disc[u]) {
        /* ---------- back edge to an ancestor ---------- */
        st.edgeKind[id] = 'back';
        const old = st.low[u];
        const dv = st.disc[v];
        const nw = Math.min(old, dv);
        const key = mode === 'bcc' ? 'pushBack' : 'back';
        let walked = false;
        const backPre = () => {
          if (walked) return [];
          walked = true;
          return [...loopPre(), 'tree', 'else', ...(mode === 'bcc' ? ['back'] : [])];
        };
        if (old !== dv) {
          snap('back', `Edge ${u}–${v}: ${v} is already visited and is an ancestor (disc ${dv} < ${st.disc[u]}), so this is a BACK edge.`, {
            kind: 'ask',
            pre: backPre(),
            ev: { type: 'back', u, v, id },
            quiz: pick(`The back edge lands on ${v} with disc[${v}] = ${dv}. low[${u}] is ${old} now. What is the new low[${u}]?`, [old, dv], nw, `A back edge lets ${u} jump straight to ${v}, so low[${u}] = min(${old}, ${dv}) = ${nw}.`),
          });
        }
        if (mode === 'bcc') st.stack.push(id);
        st.low[u] = nw;
        if (nw < old) st.lowSrc[u] = { k: 'back', v, id };
        snap(key, `Back edge ${u}–${v}.${mode === 'bcc' ? ' Push it on the edge stack (once!).' : ''} low[${u}] = min(${old}, disc[${v}] = ${dv}) = ${nw}.`, { pre: backPre(), ev: { type: 'low', u, k: 'back', v, id, old, nw } });
      } else if (mode === 'bcc' && B === 'pushTwice') {
        /* ---------- BUG: the same back edge, seen from the ancestor, is pushed again ---------- */
        st.stack.push(id);
        snap('pushBack', `Edge ${u}–${v}: the same back edge, now seen from the ancestor side. The buggy code has no disc[v] < disc[u] guard, so it pushes the edge a SECOND time.`, {
          kind: 'bug',
          pre: [...loopPre(), 'tree', 'back'],
          ev: { type: 'back', u, v, id },
          hit: { title: `Back edge ${u}–${v} pushed twice`, why: `This edge was already pushed from ${v}'s side (where disc[${v}] > disc[${u}] made it a back edge to an ancestor). Now ${u} pushes it again. The extra copy stays on the edge stack after the block containing the first copy is popped, so it lands in a later block or is never popped.` },
        });
      } else {
        /* ---------- same back edge, seen from the ancestor ---------- */
        snap('back', `Edge ${u}–${v}: ${v} is a descendant that is already finished. This is the same back edge we handled from ${v}'s side, so there is nothing to do.`, { pre: [...loopPre(), 'tree', 'else'], ev: { type: 'back', u, v, id } });
      }
    }

    if (pe === -1 && mode === 'ap') {
      const cond = children > 1;
      if (B === 'rootSkip') {
        snap('root', `${u} is the DFS root with ${plural(children, 'child')}. The buggy code has no root rule (the test is "if (false)"), so nothing is checked here.${cond ? ` BUG: the correct rule would mark ${u}.` : ''}`, {
          pre: ['loopEnd'],
          kind: cond ? 'bug' : 'info',
          ...(cond ? { hit: { title: `Root ${u} never tested`, why: `${u} has ${children} DFS children. Different child subtrees are joined only through ${u} (an undirected DFS has no cross edges), so removing ${u} splits them: it IS an articulation point. The test low[v] ≥ disc[u] cannot find this, because for a root it is always true and is guarded away. Only the children > 1 rule catches it, and that rule was skipped.` } } : {}),
        });
      } else {
        snap('root', `${u} is the DFS root and has ${plural(children, 'child')} in the DFS tree.`, {
          kind: 'ask',
          pre: ['loopEnd'],
          quiz: yesNo(`Root ${u} finished with ${plural(children, 'DFS child')}. Is it an articulation point?`, cond, `A root is a cut vertex exactly when it has 2 or more DFS children: separate child subtrees have no edges between them (no cross edges in an undirected DFS).`),
        });
        if (cond) {
          markAP(u);
          snap('rootset', `${children} ≥ 2 children → the child subtrees are only connected through ${u}. ${u} is an ARTICULATION POINT.`, { kind: 'verdict' });
        } else {
          snap('root', `Only ${plural(children, 'child')} → removing ${u} cannot split the rest. Not an articulation point.`, { kind: 'verdict' });
        }
      }
    }
    if (pe === -1 && mode === 'bcc' && children > 1) {
      markAP(u);
    }

    st.vstate[u] = 2;
    st.callStack.pop();
    st.cur = u;
    st.hl = -1;
    snap('finish', `Finish ${u}.${pe === -1 && mode === 'bcc' && children > 1 ? ` The root has ${children} children, so ${u} is an articulation point.` : ''}`, {
      pre: mode === 'ap' ? (pe === -1 ? [] : ['loopEnd', 'root']) : ['loopEnd'],
    });
  }

  snap('main', 'Initial state: every disc[] and low[] is -1 (unvisited). Pick a starting node and run the DFS.');
  let first = true;
  for (const r of rootsOrder(n, start)) {
    if (st.disc[r] !== -1) continue;
    if (!first) snap('main', `Vertex ${r} was not reached — the graph is disconnected. Start a fresh DFS tree at ${r}.`);
    first = false;
    st.cur = r;
    dfs(r, -1, -1);
  }

  st.cur = -1;
  st.hl = -1;
  let summary = '';
  if (mode === 'ap') summary = st.aps.length ? `Done. Articulation points: ${st.aps.join(', ')}.` : 'Done. No articulation points — no single vertex failure disconnects the graph.';
  if (mode === 'bridge') summary = st.bridges.length ? `Done. Bridges: ${st.bridges.map((e) => `${edges[e][0]}–${edges[e][1]}`).join(', ')}.` : 'Done. No bridges — every edge lies on a cycle.';
  if (mode === 'bcc') summary = `Done. ${plural(st.blocks.length, 'biconnected component')}.${st.aps.length ? ` Articulation points: ${st.aps.join(', ')}.` : ' No articulation points.'}${st.stack.length ? ` The edge stack should be empty now but still holds ${st.stack.map((e) => `${edges[e][0]}–${edges[e][1]}`).join(', ')}.` : ''}`;
  snap('main', summary, { kind: 'done' });
  return steps;
}

/* ------------------------------------------------------------------ */
/*  Directed: strongly connected components (Tarjan)                   */
/* ------------------------------------------------------------------ */
export function traceSCC(g, start = 0, bug = null) {
  const { n, edges } = g;
  const B = bug && BUGS[bug] && BUGS[bug].modes.includes('scc') ? bug : null;
  const adj = buildAdj(n, edges, true);
  const { st, steps, snap } = makeRecorder(n, edges.length, 'scc', !!B);

  function dfs(u, fromMain = false) {
    st.disc[u] = st.low[u] = st.timer++;
    st.vstate[u] = 1;
    st.onStack[u] = true;
    st.stack.push(u);
    st.callStack.push(u);
    st.cur = u;
    st.hl = -1;
    st.ops.v++;
    snap('spush', `Visit ${u}: disc[${u}] = low[${u}] = ${st.disc[u]}. Push ${u} onto Tarjan's stack.`, { pre: [fromMain ? 'main' : 'recurse', 'enter', 'visit'] });

    for (const { to: v, id } of adj[u]) {
      st.ops.e++;
      st.cur = u;
      st.hl = id;
      if (st.disc[v] === -1) {
        st.edgeKind[id] = 'tree';
        st.parent[v] = u;
        st.pedge[v] = id;
        snap('tree', `Edge ${u}→${v}: ${v} is unvisited → TREE edge. Recurse into ${v}.`, { pre: ['loop'], ev: { type: 'tree', u, v, id } });
        dfs(v);
        st.cur = u;
        st.hl = id;
        const old = st.low[u];
        const lv = st.low[v];
        const nwC = Math.min(old, lv);
        const nw = B === 'childDisc' ? Math.min(old, st.disc[v]) : nwC;
        if (old !== lv) {
          snap('lowUp', `Back from ${v}: low[${v}] = ${lv}, while low[${u}] = ${old}.`, {
            kind: 'ask',
            pre: ['recurse'],
            quiz: pick(`What is low[${u}] after returning from child ${v}? (now ${old}; child has ${lv})`, [old, lv], nwC, `${u} can reach everything its child can reach: min(${old}, ${lv}) = ${nwC}.`),
          });
        }
        st.low[u] = nw;
        if (nw < old) st.lowSrc[u] = { k: 'child', v };
        const lowEv = { type: 'low', u, k: 'child', v, old, nw };
        if (B === 'childDisc') {
          snap('lowUp', `low[${u}] = min(${old}, disc[${v}] = ${st.disc[v]}) = ${nw}.${nw !== nwC ? ` BUG: the child's low[${v}] = ${lv} should have been used, giving ${nwC}.` : ''}`, {
            ev: lowEv,
            ...(nw !== nwC ? { kind: 'bug', hit: { title: `low[${u}] was not lowered by child ${v}`, why: `The code takes disc[${v}] = ${st.disc[v]}, which is larger than disc[${u}], so the min changes nothing. Child ${v} can reach low[${v}] = ${lv}, so low[${u}] should be ${nwC}. ${u} will wrongly look like the root of its own SCC.` } } : {}),
          });
        } else {
          snap('lowUp', `low[${u}] = min(${old}, low[${v}] = ${lv}) = ${nw}.`, { ev: lowEv });
        }
      } else {
        const kind = st.vstate[v] === 1 ? 'back' : st.disc[v] > st.disc[u] ? 'forward' : 'cross';
        st.edgeKind[id] = kind;
        const on = st.onStack[v];
        const use = B === 'noOnStack' ? true : on;
        snap('check', B ? `Edge ${u}→${v}: ${v} was already visited — a ${kind.toUpperCase()} edge. The buggy code does not ask whether ${v} is still on Tarjan's stack; it uses disc[${v}] regardless.` : `Edge ${u}→${v}: ${v} was already visited — a ${kind.toUpperCase()} edge. Is ${v} still on Tarjan's stack?`, {
          kind: 'ask',
          pre: ['loop', 'tree'],
          ev: { type: 'edge', u, v, id, on },
          quiz: yesNo(`${kind[0].toUpperCase() + kind.slice(1)} edge ${u}→${v}. Is ${v} still on Tarjan's stack (not yet assigned to a finished SCC)?`, on, on ? `${v} is still waiting for its SCC root to be found, so it may be in the same component as ${u}.` : `${v} was already popped into a finished SCC; it can't share a component with ${u}, or that SCC would have been bigger.`),
        });
        if (use) {
          const old = st.low[u];
          const nw = Math.min(old, st.disc[v]);
          st.low[u] = nw;
          if (nw < old) st.lowSrc[u] = { k: 'back', v, id };
          const bad = !on && nw < old;
          snap('back', on ? `Yes: ${v} is still on the stack, so it belongs to a component still under construction. low[${u}] = min(${old}, disc[${v}] = ${st.disc[v]}) = ${nw}.` : `${v} is already in a finished SCC, but the buggy code uses it anyway: low[${u}] = min(${old}, disc[${v}] = ${st.disc[v]}) = ${nw}.${bad ? ' BUG: this wrongly lowers low.' : ''}`, {
            kind: bad ? 'bug' : 'verdict',
            ev: { type: 'low', u, k: 'back', v, id, old, nw },
            ...(bad ? { hit: { title: `Cross edge ${u}→${v} lowered low[${u}]`, why: `${v} was already popped into a finished SCC, so ${u} can never be in its component: there is no path from ${v} back to ${u}. Using disc[${v}] = ${st.disc[v]} drops low[${u}] from ${old} to ${nw}, so ${u} is no longer recognised as an SCC root and gets merged with unrelated vertices.` } } : {}),
          });
        } else {
          snap('ignore', `No: ${v} is already in a finished SCC, so the edge is ignored. This is exactly why Tarjan's algorithm needs onStack[] — without it this cross edge would wrongly lower low[${u}].`, { kind: 'verdict', ev: { type: 'edge', u, v, id, on } });
        }
      }
    }

    const isRoot = st.low[u] === st.disc[u];
    const rootEv = { type: 'test', u, v: u, op: '=', cond: isRoot, lv: st.low[u], d: st.disc[u] };
    snap('root', `All edges of ${u} done. Test: low[${u}] = ${st.low[u]}, disc[${u}] = ${st.disc[u]}. Is ${u} the root of an SCC?`, {
      kind: 'ask',
      pre: ['loopEnd'],
      ev: rootEv,
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
      snap('block', `low = disc → ${u} is an SCC root. Pop the stack down to ${u}: SCC #${st.sccs.length} = {${comp.join(', ')}}.`, { kind: 'verdict', pre: ['pop'], ev: rootEv });
    } else {
      snap('root', `low[${u}] < disc[${u}] → ${u} can still reach a vertex below it on the stack. It stays on the stack; its root will collect it.`, { kind: 'verdict', ev: rootEv });
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
    dfs(r, true);
  }
  st.cur = -1;
  st.hl = -1;
  snap('main', `Done. ${plural(st.sccs.length, 'strongly connected component')}: ${st.sccs.map((c) => `{${c.join(', ')}}`).join('  ')}.${st.stack.length ? ` Tarjan's stack should be empty but still holds ${st.stack.join(', ')}: those vertices never found their SCC root.` : ''}`, { kind: 'done' });
  return steps;
}

// `bug` (optional) injects one of the classic mistakes listed in code.js (BUGS) into the trace.
export function runTrace(mode, g, start, bug = null) {
  if (g.n === 0) return [];
  const B = bug && BUGS[bug] && BUGS[bug].modes.includes(mode) ? bug : null;
  if (mode === 'scc') return traceSCC(g, start, B);
  const ref = B === 'rootAlways' ? traceUndirected(mode, g, start).at(-1) : null;
  return traceUndirected(mode, g, start, B, ref);
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
