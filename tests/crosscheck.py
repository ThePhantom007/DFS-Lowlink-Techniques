"""Cross-check the JS engine against networkx. Run `npm test` first to produce cases.json."""
import json, sys
import networkx as nx

cases = json.load(open("tests/cases.json"))
bad = 0
checked = 0
for c in cases:
    if c["kind"] == "u":
        if len({tuple(sorted(e)) for e in c["edges"]}) != len(c["edges"]):
            continue  # networkx is simple-graph only
        G = nx.Graph(); G.add_nodes_from(range(c["n"])); G.add_edges_from(c["edges"])
        aps = sorted(nx.articulation_points(G))
        br = sorted(tuple(sorted(e)) for e in nx.bridges(G))
        mine_br = sorted(tuple(sorted(c["edges"][i])) for i in c["bridges"])
        mine_blocks = sorted(sorted(tuple(sorted(c["edges"][e])) for e in b) for b in c["blocks"])
        nx_blocks = sorted(sorted(tuple(sorted(e)) for e in comp) for comp in nx.biconnected_component_edges(G))
        checked += 1
        if sorted(c["aps"]) != aps or mine_br != br or mine_blocks != nx_blocks:
            bad += 1; print("MISMATCH undirected", c["edges"])
    else:
        G = nx.DiGraph(); G.add_nodes_from(range(c["n"])); G.add_edges_from(c["edges"])
        theirs = sorted(sorted(s) for s in nx.strongly_connected_components(G))
        mine = sorted(sorted(s) for s in c["sccs"])
        checked += 1
        if theirs != mine:
            bad += 1; print("MISMATCH directed", c["edges"])
print("networkx cross-check:", "OK" if bad == 0 else f"{bad} mismatches", f"({checked} cases)")
sys.exit(1 if bad else 0)
