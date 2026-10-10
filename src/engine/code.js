// C++ listings shown beside the visualiser. A trailing `//@name` marker tags a line
// so the step engine can point at it; markers are stripped before display.

const RAW = {
  ap: `#include <bits/stdc++.h>
using namespace std;

int n, timer_ = 0;
vector<vector<pair<int,int>>> adj;   // adj[u] = list of (v, edgeId)
vector<int> disc, low;
vector<bool> isArt;

void dfs(int u, int parentEdge) {
    disc[u] = low[u] = timer_++;                    //@visit
    int children = 0;
    for (auto [v, id] : adj[u]) {
        if (id == parentEdge) continue;             // don't reuse the edge we came by
        if (disc[v] == -1) {                        //@tree
            children++;
            dfs(v, id);
            low[u] = min(low[u], low[v]);           //@lowUp
            if (parentEdge != -1 && low[v] >= disc[u])   //@check
                isArt[u] = true;                    //@verdict
        } else {
            low[u] = min(low[u], disc[v]);          //@back
        }
    }
    if (parentEdge == -1 && children > 1)           //@root
        isArt[u] = true;
}                                                    //@finish

void run() {
    disc.assign(n, -1); low.assign(n, -1); isArt.assign(n, false);
    for (int r : roots)                             //@main
        if (disc[r] == -1) dfs(r, -1);
}`,

  bridge: `#include <bits/stdc++.h>
using namespace std;

int n, timer_ = 0;
vector<vector<pair<int,int>>> adj;   // adj[u] = list of (v, edgeId)
vector<int> disc, low;
vector<int> bridges;                 // edge ids

void dfs(int u, int parentEdge) {
    disc[u] = low[u] = timer_++;                    //@visit
    for (auto [v, id] : adj[u]) {
        if (id == parentEdge) continue;             // skip by EDGE id (handles parallel edges)
        if (disc[v] == -1) {                        //@tree
            dfs(v, id);
            low[u] = min(low[u], low[v]);           //@lowUp
            if (low[v] > disc[u])                   //@check
                bridges.push_back(id);              //@verdict
        } else {
            low[u] = min(low[u], disc[v]);          //@back
        }
    }
}                                                    //@finish

void run() {
    disc.assign(n, -1); low.assign(n, -1);
    for (int r : roots)                             //@main
        if (disc[r] == -1) dfs(r, -1);
}`,

  bcc: `#include <bits/stdc++.h>
using namespace std;

int n, timer_ = 0;
vector<vector<pair<int,int>>> adj;   // adj[u] = list of (v, edgeId)
vector<pair<int,int>> E;             // E[id] = (a, b)
vector<int> disc, low;
stack<int> edgeStack;                // edge ids
vector<vector<int>> blocks;          // each block = list of edge ids

void dfs(int u, int parentEdge) {
    disc[u] = low[u] = timer_++;                    //@visit
    for (auto [v, id] : adj[u]) {
        if (id == parentEdge) continue;
        if (disc[v] == -1) {                        //@tree
            edgeStack.push(id);                     //@push
            dfs(v, id);
            low[u] = min(low[u], low[v]);           //@lowUp
            if (low[v] >= disc[u]) {                //@check
                vector<int> block;
                while (true) {                      //@pop
                    int e = edgeStack.top(); edgeStack.pop();
                    block.push_back(e);
                    if (e == id) break;
                }
                blocks.push_back(block);            //@block
            }
        } else if (disc[v] < disc[u]) {             //@back
            edgeStack.push(id);                     //@pushBack
            low[u] = min(low[u], disc[v]);
        }
    }
}                                                    //@finish

void run() {
    disc.assign(n, -1); low.assign(n, -1);
    for (int r : roots)                             //@main
        if (disc[r] == -1) dfs(r, -1);
}`,

  scc: `#include <bits/stdc++.h>
using namespace std;

int n, timer_ = 0;
vector<vector<int>> adj;             // directed adjacency list
vector<int> disc, low;
vector<bool> onStack;
stack<int> st;                       // Tarjan's vertex stack
vector<vector<int>> sccs;

void dfs(int u) {
    disc[u] = low[u] = timer_++;                    //@visit
    st.push(u); onStack[u] = true;
    for (int v : adj[u]) {
        if (disc[v] == -1) {                        //@tree
            dfs(v);
            low[u] = min(low[u], low[v]);           //@lowUp
        } else if (onStack[v]) {                    //@check
            low[u] = min(low[u], disc[v]);          //@back
        }                                           //@ignore
    }
    if (low[u] == disc[u]) {                        //@root
        vector<int> comp;
        while (true) {                              //@pop
            int w = st.top(); st.pop();
            onStack[w] = false;
            comp.push_back(w);
            if (w == u) break;
        }
        sccs.push_back(comp);                       //@block
    }
}                                                    //@finish

void run() {
    disc.assign(n, -1); low.assign(n, -1); onStack.assign(n, false);
    for (int r : roots)                             //@main
        if (disc[r] == -1) dfs(r);
}`,
};

function parse(src) {
  const lines = [];
  const marks = {};
  src.split('\n').forEach((ln, i) => {
    const m = ln.match(/\s*\/\/@(\w+)\s*$/);
    if (m) {
      marks[m[1]] = i;
      ln = ln.replace(/\s*\/\/@\w+\s*$/, '');
    }
    lines.push(ln);
  });
  return { lines, marks };
}

export const CODE = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, parse(v)]));
