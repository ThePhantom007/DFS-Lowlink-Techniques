# DFS Low-Link Techniques

An interactive visualiser **and tutor** for the five DFS low-link techniques:

- Articulation points (cut vertices)
- Bridges (cut edges)
- Biconnected components (blocks)
- Block-cut trees, built live from the blocks
- Strongly connected components (Tarjan's algorithm)

It runs entirely in the browser (React + Vite, hand-written SVG, no backend), so it deploys to Vercel as a static site.

## Quick start

```bash
npm install        # needs Node 20.19+ or 22.12+ (Vite 8)
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm test           # engine tests vs. brute force
```

## Deploy to Vercel

Any one of these works (Vercel auto-detects Vite; `vercel.json` is included):

1. **GitHub**: push this folder to a repo, then *Add New → Project* on vercel.com and import it. Click Deploy.
2. **CLI**: `npm i -g vercel`, then run `vercel` in this folder (and `vercel --prod` to publish).
3. **Drag and drop**: run `npm run build`, then upload the `dist/` folder through the Vercel dashboard.

Settings if asked: Framework = Vite, Build = `npm run build`, Output = `dist`.

## Features

**Visualizer**
- Step-by-step playback (play/pause, step back and forward, scrubber, 0.5×–4× speed, keyboard shortcuts).
- Live `disc / low` labels on every vertex, vertex states (unvisited / on path / finished), edge classification (tree, back, forward, cross), cut-vertex rings, bridge highlighting, colour-coded blocks and SCCs.
- The DFS call stack, the **edge stack** (BCC) or **vertex stack** (Tarjan) shown live, plus the edge-stack underlay drawn on the graph.
- C++ source where the highlight walks line by line through what actually executes (loop header, parent check, branch, update). When you jump several steps at once, it replays through all of them quickly and shows a "Replaying N steps" badge.
- Narration for every step explaining *why* it happens, including the exact inequality being tested.
- **Predict mode**: playback pauses at each decision (new `low` value, "is it a cut vertex?", "is it a bridge?", "pop a block?", "is it on the Tarjan stack?") and asks you to answer before revealing the result, with a running score.
- **What-if tool**: delete vertices or edges and see the remaining components, to verify a cut vertex or bridge by brute force.
- Graph editor: drag, add and delete vertices and edges, paste an edge list, choose the DFS starting node, random graphs, 13 curated presets (root case, parallel edges, disconnected graph, cross-edge trap, ...), shareable links.
- Block-cut tree that grows as blocks are popped. When the biconnected-components run finishes, the page scrolls to it and the card glows so it isn't missed.
- Dotted outlines drawn around every block (biconnected components) and every strongly connected component as they are found.
- A one-line description of every toolbar control appears directly under the toolbar (the active tool, or whatever you hover).
- Light and dark themes (sun/moon switch, follows your system setting by default) with a blue colour scheme and theme-aware highlights.

**Break the algorithm** (Visualizer, under the graph)
- Switch on a classic mistake and run it against the correct version. Eight bugs: skip the root rule, apply the non-root test to the root, `>` instead of `≥` (cut vertices and blocks), `≥` instead of `>` (bridges), push a back edge twice, drop the `onStack` check, skip the parent *vertex* instead of the parent *edge*, and use `disc[v]` where `low[v]` belongs.
- The buggy code runs in the player. The changed line is shown in the listing in red with the correct line under it, the scrubber has red ticks at every step where the buggy line behaves differently, and **Jump to the first divergence** lands on the step where it first goes wrong, with an explanation of why.
- A side-by-side of the correct and buggy answers (missed and falsely reported items too). If the current graph happens to hide the bug, **Load a graph that breaks it** finds one (searched by actually running both versions, not hand-written).
- Predict mode pauses while a bug is injected, because its questions describe the correct algorithm.

**DFS tree panel** (Visualizer, top of the right column)
- The DFS tree drawn top-down with back, forward and cross edges as arcs. When `low[u]` changes, the back edge or child that set it is highlighted. While a test such as `low[v] ≥ disc[u]` runs, `v`'s whole subtree is shaded (green: it cannot climb above `u`, amber: it escapes) and the escape route is highlighted when there is one. The note under the tree is worded from the actual numbers, so with a buggy comparison it says exactly where the picture and the test disagree.
- **Why is low[x] this value?** Click any visited vertex: the answer follows the recorded source (child, then child, ... then the back edge).

**Operation counter** (Visualizer): vertices visited and edge checks against the exact bound V + 2E (V + E for directed graphs), live. The **Performance** tab benchmarks the one-pass algorithm against brute force (delete each vertex, recount) on random graphs, as a log-log runtime or operation-count chart with a table view and an equality check on the answers.

**Code language**: the listing can be shown in C++, Python or Java (remembered across visits). The highlight walks through the equivalent line in each language, and bugs are patched in all three.

**Applications**
- *Router failure simulator*: click routers or links to fail them and see who loses the gateway; the single points of failure (articulation points and bridges) are listed with how many routers each one cuts off, and the single best cable to add is found by trying every possibility.
- *2-SAT with SCCs*: edit the clauses, see the implication graph with its SCCs, and get either a satisfying assignment or the contradiction (`x` and `¬x` in one SCC). Checked live against brute force.

**Learn**: ten short lessons with formulas, proof sketches, common traps and "Try it" buttons that jump to the right preset. Progress lasts for the session and resets when the page is refreshed.

**Practice**: Quiz (21-question bank, 10 shuffled per round), *Trace it* (compute `low[]` by hand and get checked; **Explain my mistake** then derives the right value one step at a time, shows which child and which back edge give it, and says what you most likely did wrong), *Spot it* (find cut vertices or bridges on random graphs, with streaks), and *Find the bug* (a listing with one wrong line: click it, then see why and watch it fail on a real graph; the puzzles are generated from the same bugs as Break the algorithm, in the language you pick).

**Compare**: pick a preset or random graph (or edit it in the Visualizer) and see the same graph through every lens (cut vertices, bridges, blocks, block-cut tree, or SCCs plus the condensation DAG) and a table of the test each algorithm uses.

## Code structure

```
src/
  engine/
    traces.js     step-trace generators (AP, bridges, BCC, Tarjan SCC) + block-cut tree; optional bug injection
    code.js       listings in C++, Python and Java; `//@name` / `#@name` markers link source lines to trace steps; the BUGS table
    bugs.js       correct-vs-buggy comparison and counterexample search
    explain.js    "Explain my mistake": derive low[v] step by step and diagnose a wrong answer
    lean.js       fast iterative AP/bridges, brute force, Tarjan, 2-SAT (used by Applications and Performance)
    bench.js      the benchmark behind the Performance tab
    graphs.js     presets, layout, random graphs, edge-list parsing, share links, brute force
  components/
    Visualizer.jsx  GraphCanvas.jsx  Panels.jsx  BlockCutTree.jsx  DfsTree.jsx  BugCard.jsx
    Learn.jsx  Practice.jsx  FindBug.jsx  Compare.jsx  Applications.jsx  Performance.jsx
  data/           lessons.js, practice.js (quiz questions)
  App.jsx  main.jsx  styles.css  store.js
tests/
  engine.test.mjs   brute-force checks (run with `npm test`)
  features.test.mjs bugs, DFS-tree provenance, mistake explanations, counters, lean algorithms, 2-SAT, listings in three languages
  crosscheck.py     optional networkx cross-check (needs `pip install networkx`)
```

## How the engine works

Each algorithm is written as an ordinary recursive DFS that calls `snap(...)` at every interesting moment. A snapshot copies the full state (disc, low, vertex states, edge kinds, stacks, results so far), the C++ line to highlight, the narration text and an optional quiz. The UI is just a player over that array, so adding a new algorithm means writing one more trace function and one listing per language. Steps refer to code lines by marker name, so the same trace drives all three languages. Each snapshot also records the DFS-tree parent of every vertex, what last lowered each `low[]` (a back edge or a child), the operation counts, and an event describing what the step did (`low` update, `test`, ...); the DFS tree panel is drawn from those.

Parallel edges are handled by skipping the parent **edge id** rather than the parent vertex.

## Correctness

`npm test` checks the traces against brute force (delete each vertex or edge and count components, plus reachability for SCCs) on more than 600 graphs, and verifies block invariants (edges partitioned, cut vertices = vertices in two or more blocks, single-edge blocks = bridges). The feature tests additionally check that every injected bug is exposed by a searched counterexample, that **a wrong answer always has a marked divergence step** (about 3000 buggy runs), that the provenance data is consistent with the final `low[]`, that the operation counts equal V + 2E exactly, that the fast and brute-force algorithms agree, that 2-SAT verdicts and assignments match brute force on 600 random formulas, and that every listing has every marker in every language. `python3 tests/crosscheck.py` compares the results with networkx.

## Limits

Up to 24 vertices per graph (keeps the canvas readable). Recursion depth is not a concern at this size.
