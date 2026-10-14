// "Explain my mistake": derive low[v] from first principles for a finished DFS, one step at a time,
// and guess what went wrong when a student's answer differs.

function chainOf(f, c) {
  // follow lowSrc down from child c until the back edge that set it (or nothing)
  const path = [c];
  let x = c;
  let guard = 0;
  while (f.lowSrc[x] && f.lowSrc[x].k === 'child' && guard++ < 100) {
    x = f.lowSrc[x].v;
    path.push(x);
  }
  const last = f.lowSrc[x];
  return { path, back: last && last.k === 'back' ? last : null };
}

export function explainLow(g, f, v, userVal) {
  const { edges } = g;
  const kids = [];
  for (let c = 0; c < g.n; c++) if (f.parent[c] === v) kids.push(c);
  const backs = [];
  edges.forEach(([a, b], i) => {
    if (f.edgeKind[i] !== 'back') return;
    const deep = f.disc[a] > f.disc[b] ? a : b;
    const up = deep === a ? b : a;
    if (deep === v) backs.push({ id: i, to: up });
  });

  const d = f.disc[v];
  const steps = [{ text: `Start: low[${v}] = disc[${v}] = ${d}. Vertex ${v} can always "reach" itself.`, run: d, hlV: [v], hlE: [], by: 'self' }];
  let run = d;
  let source = 'self';
  for (const b of backs) {
    const dw = f.disc[b.to];
    const nw = Math.min(run, dw);
    steps.push({ text: `${v} has its own back edge ${edges[b.id][0]}–${edges[b.id][1]} that lands on ${b.to} (disc[${b.to}] = ${dw}). low = min(${run}, ${dw}) = ${nw}${nw < run ? ' — lowered by this back edge' : ' — no change'}.`, run: nw, hlV: [v, b.to], hlE: [b.id], by: nw < run ? 'back' : null });
    if (nw < run) source = `the back edge ${edges[b.id][0]}–${edges[b.id][1]} from ${v} itself`;
    run = nw;
  }
  for (const c of kids) {
    const lc = f.low[c];
    const { path, back } = chainOf(f, c);
    const treeE = path.map((x) => f.pedge[x]);
    let via = '';
    let hlE = [...treeE];
    let hlV = [v, ...path];
    if (lc < f.disc[c] && back) {
      via = ` (it gets there ${path.length > 1 ? `through ${path.join(' → ')} and ` : ''}via the back edge ${edges[back.id][0]}–${edges[back.id][1]} landing on ${back.v})`;
      hlE = [...treeE, back.id];
      hlV = [v, ...path, back.v];
    } else {
      via = ` (nothing in ${c}'s subtree climbs above ${c} itself)`;
    }
    const nw = Math.min(run, lc);
    steps.push({ text: `Child ${c}: its whole subtree can reach low[${c}] = ${lc}${via}. low = min(${run}, ${lc}) = ${nw}${nw < run ? ' — lowered by this child' : ' — no change'}.`, run: nw, hlV, hlE, by: nw < run ? 'child' : null });
    if (nw < run) source = back ? `child ${c}, whose subtree contains the back edge ${edges[back.id][0]}–${edges[back.id][1]}` : `child ${c}`;
    run = nw;
  }
  if (!backs.length && !kids.length) steps.push({ text: `${v} has no back edges and no children, so there is nothing else to take a minimum over.`, run, hlV: [v], hlE: [], by: null });
  steps.push({ text: `Result: low[${v}] = ${run}${source === 'self' ? ` = disc[${v}]: neither a back edge from ${v} nor any child lets ${v}'s subtree climb higher.` : `, which came from ${source}.`}`, run, hlV: [v], hlE: [], by: 'result' });

  const answer = f.low[v];
  const ownOnly = Math.min(d, ...backs.map((b) => f.disc[b.to]));
  let diagnosis = '';
  const u = userVal === '' || userVal === undefined ? NaN : Number(userVal);
  if (Number.isNaN(u)) diagnosis = 'You left this blank.';
  else if (u === answer) diagnosis = 'That is correct.';
  else if (u === d && answer < d) diagnosis = `You stopped at disc[${v}] = ${d}. A vertex's low also takes into account its back edges and everything its children can reach, and here that gives ${answer}.`;
  else if (u === ownOnly && ownOnly > answer) diagnosis = `You used ${v}'s own back edges but forgot to take the minimum with its children's low values. After returning from a child, low[${v}] = min(low[${v}], low[child]) pulls up what the whole subtree can reach.`;
  else if (f.parent[v] >= 0 && u === f.disc[f.parent[v]] && u < answer) diagnosis = `${u} is disc of ${v}'s parent. The tree edge to the parent is NOT a back edge, so it must not lower low[${v}]. Only back edges (and children's lows) count.`;
  else if (u < answer) diagnosis = `Too low: ${u} is smaller than anything ${v}'s subtree can actually reach. Check that every back edge you used starts inside ${v}'s subtree (${v} or a descendant), and that you did not count a tree edge as a back edge.`;
  else diagnosis = `Too high: some back edge or child gives a smaller value. Walk the steps below and compare each candidate with your number.`;
  return { v, answer, steps, diagnosis, kids, backs };
}
