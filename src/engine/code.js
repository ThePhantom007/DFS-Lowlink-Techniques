// Source listings shown beside the visualiser, in C++, Python and Java.
// A trailing `//@name` (or `#@name` in Python) marker tags a line so the step engine can point
// at it; markers are stripped before display. Every language uses the SAME marker names, so the
// highlight walks through the code exactly as the program would, whichever language is shown.
//
// "Break the algorithm" mode works by patching marked lines (see BUGS below): the listing is
// rebuilt with the buggy line text and the changed lines are reported so the UI can flag them.

export const LANGS = [
  ['cpp', 'C++'],
  ['py', 'Python'],
  ['java', 'Java'],
];

const RAW = {
  cpp: {
    ap: `#include <bits/stdc++.h>
using namespace std;

int n, timer_ = 0;
vector<vector<pair<int,int>>> adj;   // adj[u] = list of (v, edgeId)
vector<int> disc, low;
vector<bool> isArt;

void dfs(int u, int parentEdge) {                   //@enter
    disc[u] = low[u] = timer_++;                    //@visit
    int children = 0;                               //@init
    for (auto [v, id] : adj[u]) {                   //@loop
        // skip the edge we arrived by (by edge id, so parallel edges still count)
        if (id == parentEdge) continue;             //@skip
        if (disc[v] == -1) {                        //@tree
            children++;                             //@child
            dfs(v, id);                             //@recurse
            low[u] = min(low[u], low[v]);           //@lowUp
            if (parentEdge != -1 && low[v] >= disc[u])   //@check
                isArt[u] = true;                    //@verdict
        } else {                                    //@else
            low[u] = min(low[u], disc[v]);          //@back
        }
    }                                               //@loopEnd
    if (parentEdge == -1 && children > 1)           //@root
        isArt[u] = true;                            //@rootset
}                                                   //@finish

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

void dfs(int u, int parentEdge) {                   //@enter
    disc[u] = low[u] = timer_++;                    //@visit
    for (auto [v, id] : adj[u]) {                   //@loop
        // skip by EDGE id so parallel edges stay correct
        if (id == parentEdge) continue;             //@skip
        if (disc[v] == -1) {                        //@tree
            dfs(v, id);                             //@recurse
            low[u] = min(low[u], low[v]);           //@lowUp
            if (low[v] > disc[u])                   //@check
                bridges.push_back(id);              //@verdict
        } else {                                    //@else
            low[u] = min(low[u], disc[v]);          //@back
        }
    }                                               //@loopEnd
}                                                   //@finish

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

void dfs(int u, int parentEdge) {                   //@enter
    disc[u] = low[u] = timer_++;                    //@visit
    for (auto [v, id] : adj[u]) {                   //@loop
        if (id == parentEdge) continue;             //@skip
        if (disc[v] == -1) {                        //@tree
            edgeStack.push(id);                     //@push
            dfs(v, id);                             //@recurse
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
    }                                               //@loopEnd
}                                                   //@finish

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

void dfs(int u) {                                   //@enter
    disc[u] = low[u] = timer_++;                    //@visit
    st.push(u); onStack[u] = true;                  //@spush
    for (int v : adj[u]) {                          //@loop
        if (disc[v] == -1) {                        //@tree
            dfs(v);                                 //@recurse
            low[u] = min(low[u], low[v]);           //@lowUp
        } else if (onStack[v]) {                    //@check
            low[u] = min(low[u], disc[v]);          //@back
        }                                           //@ignore
    }                                               //@loopEnd
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
}                                                   //@finish

void run() {
    disc.assign(n, -1); low.assign(n, -1); onStack.assign(n, false);
    for (int r : roots)                             //@main
        if (disc[r] == -1) dfs(r);
}`,
  },

  py: {
    ap: `import sys
sys.setrecursionlimit(10**6)

timer = 0
adj = []                      # adj[u] = list of (v, edge_id)
disc, low, is_art = [], [], []

def dfs(u, parent_edge):                          #@enter
    global timer
    disc[u] = low[u] = timer; timer += 1          #@visit
    children = 0                                  #@init
    for v, eid in adj[u]:                         #@loop
        # skip the edge we arrived by (by edge id, so parallel edges still count)
        if eid == parent_edge: continue           #@skip
        if disc[v] == -1:                         #@tree
            children += 1                         #@child
            dfs(v, eid)                           #@recurse
            low[u] = min(low[u], low[v])          #@lowUp
            if parent_edge != -1 and low[v] >= disc[u]:   #@check
                is_art[u] = True                  #@verdict
        else:                                     #@else
            low[u] = min(low[u], disc[v])         #@back
    # all neighbours of u have been examined      #@loopEnd
    if parent_edge == -1 and children > 1:        #@root
        is_art[u] = True                          #@rootset
    return                                        #@finish

def run(roots, n):
    global disc, low, is_art
    disc, low, is_art = [-1] * n, [-1] * n, [False] * n
    for r in roots:                               #@main
        if disc[r] == -1:
            dfs(r, -1)`,

    bridge: `import sys
sys.setrecursionlimit(10**6)

timer = 0
adj = []                      # adj[u] = list of (v, edge_id)
disc, low = [], []
bridges = []                  # edge ids

def dfs(u, parent_edge):                          #@enter
    global timer
    disc[u] = low[u] = timer; timer += 1          #@visit
    for v, eid in adj[u]:                         #@loop
        # skip by EDGE id so parallel edges stay correct
        if eid == parent_edge: continue           #@skip
        if disc[v] == -1:                         #@tree
            dfs(v, eid)                           #@recurse
            low[u] = min(low[u], low[v])          #@lowUp
            if low[v] > disc[u]:                  #@check
                bridges.append(eid)               #@verdict
        else:                                     #@else
            low[u] = min(low[u], disc[v])         #@back
    # all neighbours of u have been examined      #@loopEnd
    return                                        #@finish

def run(roots, n):
    global disc, low
    disc, low = [-1] * n, [-1] * n
    for r in roots:                               #@main
        if disc[r] == -1:
            dfs(r, -1)`,

    bcc: `import sys
sys.setrecursionlimit(10**6)

timer = 0
adj = []                      # adj[u] = list of (v, edge_id)
disc, low = [], []
edge_stack = []               # edge ids
blocks = []                   # each block = list of edge ids

def dfs(u, parent_edge):                          #@enter
    global timer
    disc[u] = low[u] = timer; timer += 1          #@visit
    for v, eid in adj[u]:                         #@loop
        if eid == parent_edge: continue           #@skip
        if disc[v] == -1:                         #@tree
            edge_stack.append(eid)                #@push
            dfs(v, eid)                           #@recurse
            low[u] = min(low[u], low[v])          #@lowUp
            if low[v] >= disc[u]:                 #@check
                block = []
                while True:                       #@pop
                    e = edge_stack.pop()
                    block.append(e)
                    if e == eid: break
                blocks.append(block)              #@block
        elif disc[v] < disc[u]:                   #@back
            edge_stack.append(eid)                #@pushBack
            low[u] = min(low[u], disc[v])
    # all neighbours of u have been examined      #@loopEnd
    return                                        #@finish

def run(roots, n):
    global disc, low
    disc, low = [-1] * n, [-1] * n
    for r in roots:                               #@main
        if disc[r] == -1:
            dfs(r, -1)`,

    scc: `import sys
sys.setrecursionlimit(10**6)

timer = 0
adj = []                      # directed adjacency list
disc, low, on_stack = [], [], []
st = []                       # Tarjan's vertex stack
sccs = []

def dfs(u):                                       #@enter
    global timer
    disc[u] = low[u] = timer; timer += 1          #@visit
    st.append(u); on_stack[u] = True              #@spush
    for v in adj[u]:                              #@loop
        if disc[v] == -1:                         #@tree
            dfs(v)                                #@recurse
            low[u] = min(low[u], low[v])          #@lowUp
        elif on_stack[v]:                         #@check
            low[u] = min(low[u], disc[v])         #@back
        # else: v is in a finished SCC, ignore it #@ignore
    # all out-edges of u have been examined       #@loopEnd
    if low[u] == disc[u]:                         #@root
        comp = []
        while True:                               #@pop
            w = st.pop()
            on_stack[w] = False
            comp.append(w)
            if w == u: break
        sccs.append(comp)                         #@block
    return                                        #@finish

def run(roots, n):
    global disc, low, on_stack
    disc, low, on_stack = [-1] * n, [-1] * n, [False] * n
    for r in roots:                               #@main
        if disc[r] == -1:
            dfs(r)`,
  },

  java: {
    ap: `import java.util.*;

public class LowLink {
    static int n, timer = 0;
    static List<int[]>[] adj;          // adj[u] = list of {v, edgeId}
    static int[] disc, low;
    static boolean[] isArt;

    static void dfs(int u, int parentEdge) {                 //@enter
        disc[u] = low[u] = timer++;                          //@visit
        int children = 0;                                    //@init
        for (int[] e : adj[u]) {                             //@loop
            int v = e[0], id = e[1];
            // skip the edge we arrived by (by edge id, so parallel edges still count)
            if (id == parentEdge) continue;                  //@skip
            if (disc[v] == -1) {                             //@tree
                children++;                                  //@child
                dfs(v, id);                                  //@recurse
                low[u] = Math.min(low[u], low[v]);           //@lowUp
                if (parentEdge != -1 && low[v] >= disc[u])   //@check
                    isArt[u] = true;                         //@verdict
            } else {                                         //@else
                low[u] = Math.min(low[u], disc[v]);          //@back
            }
        }                                                    //@loopEnd
        if (parentEdge == -1 && children > 1)                //@root
            isArt[u] = true;                                 //@rootset
    }                                                        //@finish

    static void run(int[] roots) {
        disc = new int[n]; low = new int[n]; isArt = new boolean[n];
        Arrays.fill(disc, -1); Arrays.fill(low, -1);
        for (int r : roots)                                  //@main
            if (disc[r] == -1) dfs(r, -1);
    }
}`,

    bridge: `import java.util.*;

public class Bridges {
    static int n, timer = 0;
    static List<int[]>[] adj;          // adj[u] = list of {v, edgeId}
    static int[] disc, low;
    static List<Integer> bridges = new ArrayList<>();   // edge ids

    static void dfs(int u, int parentEdge) {                 //@enter
        disc[u] = low[u] = timer++;                          //@visit
        for (int[] e : adj[u]) {                             //@loop
            int v = e[0], id = e[1];
            // skip by EDGE id so parallel edges stay correct
            if (id == parentEdge) continue;                  //@skip
            if (disc[v] == -1) {                             //@tree
                dfs(v, id);                                  //@recurse
                low[u] = Math.min(low[u], low[v]);           //@lowUp
                if (low[v] > disc[u])                        //@check
                    bridges.add(id);                         //@verdict
            } else {                                         //@else
                low[u] = Math.min(low[u], disc[v]);          //@back
            }
        }                                                    //@loopEnd
    }                                                        //@finish

    static void run(int[] roots) {
        disc = new int[n]; low = new int[n];
        Arrays.fill(disc, -1); Arrays.fill(low, -1);
        for (int r : roots)                                  //@main
            if (disc[r] == -1) dfs(r, -1);
    }
}`,

    bcc: `import java.util.*;

public class Blocks {
    static int n, timer = 0;
    static List<int[]>[] adj;          // adj[u] = list of {v, edgeId}
    static int[] disc, low;
    static Deque<Integer> edgeStack = new ArrayDeque<>();     // edge ids
    static List<List<Integer>> blocks = new ArrayList<>();    // each block = list of edge ids

    static void dfs(int u, int parentEdge) {                 //@enter
        disc[u] = low[u] = timer++;                          //@visit
        for (int[] ed : adj[u]) {                            //@loop
            int v = ed[0], id = ed[1];
            if (id == parentEdge) continue;                  //@skip
            if (disc[v] == -1) {                             //@tree
                edgeStack.push(id);                          //@push
                dfs(v, id);                                  //@recurse
                low[u] = Math.min(low[u], low[v]);           //@lowUp
                if (low[v] >= disc[u]) {                     //@check
                    List<Integer> block = new ArrayList<>();
                    while (true) {                           //@pop
                        int e = edgeStack.pop();
                        block.add(e);
                        if (e == id) break;
                    }
                    blocks.add(block);                       //@block
                }
            } else if (disc[v] < disc[u]) {                  //@back
                edgeStack.push(id);                          //@pushBack
                low[u] = Math.min(low[u], disc[v]);
            }
        }                                                    //@loopEnd
    }                                                        //@finish

    static void run(int[] roots) {
        disc = new int[n]; low = new int[n];
        Arrays.fill(disc, -1); Arrays.fill(low, -1);
        for (int r : roots)                                  //@main
            if (disc[r] == -1) dfs(r, -1);
    }
}`,

    scc: `import java.util.*;

public class Tarjan {
    static int n, timer = 0;
    static List<Integer>[] adj;        // directed adjacency list
    static int[] disc, low;
    static boolean[] onStack;
    static Deque<Integer> st = new ArrayDeque<>();            // Tarjan's vertex stack
    static List<List<Integer>> sccs = new ArrayList<>();

    static void dfs(int u) {                                 //@enter
        disc[u] = low[u] = timer++;                          //@visit
        st.push(u); onStack[u] = true;                       //@spush
        for (int v : adj[u]) {                               //@loop
            if (disc[v] == -1) {                             //@tree
                dfs(v);                                      //@recurse
                low[u] = Math.min(low[u], low[v]);           //@lowUp
            } else if (onStack[v]) {                         //@check
                low[u] = Math.min(low[u], disc[v]);          //@back
            }                                                //@ignore
        }                                                    //@loopEnd
        if (low[u] == disc[u]) {                             //@root
            List<Integer> comp = new ArrayList<>();
            while (true) {                                   //@pop
                int w = st.pop();
                onStack[w] = false;
                comp.add(w);
                if (w == u) break;
            }
            sccs.add(comp);                                  //@block
        }
    }                                                        //@finish

    static void run(int[] roots) {
        disc = new int[n]; low = new int[n]; onStack = new boolean[n];
        Arrays.fill(disc, -1); Arrays.fill(low, -1);
        for (int r : roots)                                  //@main
            if (disc[r] == -1) dfs(r);
    }
}`,
  },
};

const MARK_RE = /\s*(?:\/\/|#)@(\w+)\s*$/;

function parse(src) {
  const lines = [];
  const marks = {};
  src.split('\n').forEach((ln, i) => {
    const m = ln.match(MARK_RE);
    if (m) {
      marks[m[1]] = i;
      ln = ln.replace(MARK_RE, '');
    }
    lines.push(ln);
  });
  return { lines, marks };
}

const PARSED = Object.fromEntries(Object.entries(RAW).map(([lang, byMode]) => [lang, Object.fromEntries(Object.entries(byMode).map(([mode, src]) => [mode, parse(src)]))]));

/* ------------------------------------------------------------------ */
/*  Classic bugs                                                       */
/* ------------------------------------------------------------------ */
// An edit replaces the text `from` by `to` on the marked line `at`. Either string may be given
// per language ({ cpp, py, java }). `primary` is the one line a student should be able to point at.
const L3 = (cpp, py, java = cpp) => ({ cpp, py, java });
const GE = L3('low[v] >= disc[u]', 'low[v] >= disc[u]');
const GT = L3('low[v] > disc[u]', 'low[v] > disc[u]');

export const BUGS = {
  rootSkip: {
    label: 'Skip the root rule',
    modes: ['ap'],
    primary: 'root',
    short: 'The root is never tested, so a root with 2+ DFS children is missed.',
    edits: [{ at: 'root', from: L3('parentEdge == -1 && children > 1', 'parent_edge == -1 and children > 1', 'parentEdge == -1 && children > 1'), to: L3('false /* root rule skipped */', 'False  # root rule skipped', 'false /* root rule skipped */') }],
    why: 'A DFS root has no parent edge, so the test "low[v] >= disc[u]" is vacuous for it: every child subtree trivially "cannot climb above" the root. The right question for a root is different: does it have two or more DFS children? In an undirected DFS there are no cross edges, so separate child subtrees are joined only through the root. Delete that rule and a root that links two parts of the graph is never reported.',
    fix: 'Keep both rules: non-root u needs low[v] >= disc[u] for some child v; the root needs children > 1.',
  },
  rootAlways: {
    label: 'Apply the non-root test to the root',
    modes: ['ap'],
    primary: 'check',
    short: 'Dropping the "parentEdge != -1" guard flags every root that has any child.',
    edits: [{ at: 'check', from: L3('parentEdge != -1 && ', 'parent_edge != -1 and ', 'parentEdge != -1 && '), to: '' }],
    why: 'For the root, disc[root] is the smallest value in the whole DFS, so low[v] >= disc[root] is always true. Without the guard, the very first child of the root marks it as an articulation point, even when it ends up with a single child. Removing a root with one DFS child can never disconnect the rest of the graph.',
    fix: 'Guard the test with parentEdge != -1 and decide the root separately with children > 1.',
  },
  apGt: {
    label: 'Use > instead of ≥ (cut vertices / blocks)',
    modes: ['ap', 'bcc'],
    primary: 'check',
    short: 'low[v] > disc[u] misses the case where a back edge lands exactly on u.',
    edits: [{ at: 'check', from: GE, to: GT }],
    why: 'Equality low[v] == disc[u] means the best that v\'s subtree can do is reach u itself. That is NOT an escape route: delete u and the subtree is still cut off from everything above u. So for articulation points and for closing a block the correct test is >=. With a strict > every cut vertex whose child subtree has a back edge landing exactly on it is missed, and blocks are popped too late and merged.',
    fix: 'Use low[v] >= disc[u] for cut vertices and for popping a biconnected component.',
  },
  bridgeGe: {
    label: 'Use ≥ instead of > (bridges)',
    modes: ['bridge'],
    primary: 'check',
    short: 'low[v] >= disc[u] also reports edges that lie on a cycle through u.',
    edits: [{ at: 'check', from: GT, to: GE }],
    why: 'For a bridge the subtree of v must not reach even u itself. If low[v] == disc[u], a back edge lands exactly on u, so the tree edge u-v lies on a cycle and removing it does not disconnect anything. Equality is enough for a cut VERTEX but not for a bridge, so the bridge test must be strictly greater.',
    fix: 'Use low[v] > disc[u] for bridges.',
  },
  pushTwice: {
    label: 'Push a back edge twice',
    modes: ['bcc'],
    primary: 'back',
    short: 'Without disc[v] < disc[u] the ancestor pushes the same back edge again.',
    edits: [
      { at: 'back', from: L3('} else if (disc[v] < disc[u]) {', 'elif disc[v] < disc[u]:', '} else if (disc[v] < disc[u]) {'), to: L3('} else {', 'else:', '} else {') },
    ],
    why: 'In an undirected graph every back edge is seen twice: from the descendant (where disc[v] < disc[u]) and later from the ancestor (where the other end is already finished, disc[v] > disc[u]). The guard disc[v] < disc[u] makes only the descendant push it. Without it the edge sits on the stack twice: the second copy is left behind after its block was popped, so it ends up in a later block (an edge in two blocks) or stays on the stack forever.',
    fix: 'Push a back edge only when disc[v] < disc[u].',
  },
  noOnStack: {
    label: 'Drop the onStack check',
    modes: ['scc'],
    primary: 'check',
    short: 'Every visited neighbour lowers low[u], even one in a finished SCC.',
    edits: [{ at: 'check', from: L3('} else if (onStack[v]) {', 'elif on_stack[v]:', '} else if (onStack[v]) {'), to: L3('} else {', 'else:', '} else {') }],
    why: 'In a directed graph an edge can point into a component that is already finished (a cross edge). Such a vertex was popped from Tarjan\'s stack, so it cannot be in the same SCC as u. Using its disc[] anyway lowers low[u], u is no longer recognised as an SCC root, and unrelated components get merged into one.',
    fix: 'Only use disc[v] when v is still on Tarjan\'s stack: else if (onStack[v]).',
  },
  parentVertex: {
    label: 'Skip the parent vertex, not the parent edge',
    modes: ['bridge', 'bcc'],
    primary: 'skip',
    short: 'A parallel edge to the parent is skipped too, so a cycle of length 2 is missed.',
    edits: [
      { at: 'enter', from: L3('int parentEdge', 'parent_edge', 'int parentEdge'), to: L3('int parent', 'parent', 'int parent') },
      { at: 'skip', from: L3('id == parentEdge', 'eid == parent_edge', 'id == parentEdge'), to: L3('v == parent', 'v == parent', 'v == parent') },
      { at: 'recurse', from: L3('dfs(v, id)', 'dfs(v, eid)', 'dfs(v, id)'), to: L3('dfs(v, u)', 'dfs(v, u)', 'dfs(v, u)') },
    ],
    why: 'Skipping the parent VERTEX throws away every edge back to it, including a second, parallel edge. That parallel edge is a genuine back edge (two edges between the same pair form a cycle), so ignoring it makes the first edge look like a bridge. Skip by edge id: only the one edge you arrived on is excluded.',
    fix: 'Pass the edge id you arrived by and skip with id == parentEdge.',
  },
  childDisc: {
    label: 'Use disc[v] where low[v] belongs',
    modes: ['ap', 'bridge', 'bcc', 'scc'],
    primary: 'lowUp',
    short: 'low[u] = min(low[u], disc[v]) after a child never changes anything.',
    edits: [{ at: 'lowUp', from: L3('low[v])', 'low[v])'), to: L3('disc[v])', 'disc[v])') }],
    why: 'After returning from a child v, u must absorb what v\'s whole subtree can reach: low[v]. The value disc[v] is larger than disc[u] >= low[u], so the min never changes and the back edges deeper in the subtree are never propagated upwards. Every low value becomes too high, so subtrees look cut off when they are not.',
    fix: 'After the recursive call use low[u] = min(low[u], low[v]).',
  },
};

export const bugsFor = (mode) => Object.keys(BUGS).filter((k) => BUGS[k].modes.includes(mode));

const pick = (v, lang) => (typeof v === 'string' ? v : v[lang]);

const cache = new Map();
/* The listing for (mode, language), optionally with a bug applied.
   Returns { lines, marks, bugLines: { lineIndex: correctText } }. */
export function getCode(mode, lang = 'cpp', bug = null) {
  const key = `${mode}|${lang}|${bug || ''}`;
  if (cache.has(key)) return cache.get(key);
  const base = PARSED[lang][mode];
  const lines = [...base.lines];
  const bugLines = {};
  if (bug && BUGS[bug] && BUGS[bug].modes.includes(mode)) {
    for (const ed of BUGS[bug].edits) {
      const i = base.marks[ed.at];
      const from = pick(ed.from, lang);
      if (i === undefined || !lines[i].includes(from)) throw new Error(`bug ${bug}: cannot patch "${ed.at}" in ${lang}/${mode}`);
      if (!(i in bugLines)) bugLines[i] = base.lines[i];
      lines[i] = lines[i].replace(from, pick(ed.to, lang));
    }
  }
  const out = { lines, marks: base.marks, bugLines, primaryLine: bug ? base.marks[BUGS[bug].primary] : -1 };
  cache.set(key, out);
  return out;
}

// Backwards-compatible default export used by the trace engine (marks are language independent in effect:
// the engine only needs the C++ line numbers; the UI maps marks to the language being shown).
export const CODE = Object.fromEntries(Object.keys(RAW.cpp).map((m) => [m, PARSED.cpp[m]]));
export const MARKS = PARSED;

/* The function body only (from the `enter` line to the `finish` line), used by the Find-the-bug puzzles. */
export function functionLines(mode, lang, bug) {
  const c = getCode(mode, lang, bug);
  const a = c.marks.enter;
  const b = c.marks.finish;
  return { lines: c.lines.slice(a, b + 1), offset: a, bugLines: Object.fromEntries(Object.entries(c.bugLines).map(([i, t]) => [i - a, t])), primary: c.primaryLine - a, marks: Object.fromEntries(Object.entries(c.marks).map(([k, v]) => [k, v - a])) };
}
