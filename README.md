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
- C++ source with the currently executing line highlighted and auto-scrolled.
- Narration for every step explaining *why* it happens, including the exact inequality being tested.
- **Predict mode**: playback pauses at each decision (new `low` value, "is it a cut vertex?", "is it a bridge?", "pop a block?", "is it on the Tarjan stack?") and asks you to answer before revealing the result, with a running score.
- **What-if tool**: delete vertices or edges and see the remaining components, to verify a cut vertex or bridge by brute force.
- Graph editor: drag, add and delete vertices and edges, paste an edge list, choose the DFS start vertex, random graphs, 13 curated presets (root case, parallel edges, disconnected graph, cross-edge trap, ...), shareable links.
- Block-cut tree that grows as blocks are popped.
- Light and dark themes (sun/moon switch, follows your system setting by default) with a blue colour scheme and theme-aware highlights.

**Learn**: ten short lessons with formulas, proof sketches, common traps and "Try it" buttons that jump to the right preset. Progress is saved in the browser.

**Practice**: Quiz (21-question bank, 10 shuffled per round), *Trace it* (compute `low[]` by hand and get checked), *Spot it* (find cut vertices or bridges on random graphs, with streaks), and 16 viva flashcards.

**Compare**: the same graph through every lens (cut vertices, bridges, blocks, block-cut tree, or SCCs plus the condensation DAG) and a table of the test each algorithm uses.

## Code structure

```
src/
  engine/
    traces.js     step-trace generators (AP, bridges, BCC, Tarjan SCC) + block-cut tree
    code.js       the C++ listings; `//@name` markers link source lines to trace steps
    graphs.js     presets, layout, random graphs, edge-list parsing, share links, brute force
  components/
    Visualizer.jsx  GraphCanvas.jsx  Panels.jsx  BlockCutTree.jsx
    Learn.jsx  Practice.jsx  Compare.jsx
  data/           lessons.js, practice.js (quiz + flashcards)
  App.jsx  main.jsx  styles.css  store.js
tests/
  engine.test.mjs   brute-force checks (run with `npm test`)
  crosscheck.py     optional networkx cross-check (needs `pip install networkx`)
```

## How the engine works

Each algorithm is written as an ordinary recursive DFS that calls `snap(...)` at every interesting moment. A snapshot copies the full state (disc, low, vertex states, edge kinds, stacks, results so far), the C++ line to highlight, the narration text and an optional quiz. The UI is just a player over that array, so adding a new algorithm means writing one more trace function and one C++ listing.

Parallel edges are handled by skipping the parent **edge id** rather than the parent vertex.

## Correctness

`npm test` checks the traces against brute force (delete each vertex or edge and count components, plus reachability for SCCs) on more than 600 graphs, and verifies block invariants (edges partitioned, cut vertices = vertices in two or more blocks, single-edge blocks = bridges). `python3 tests/crosscheck.py` compares the results with networkx.

## Limits

Up to 24 vertices per graph (keeps the canvas readable). Recursion depth is not a concern at this size.
