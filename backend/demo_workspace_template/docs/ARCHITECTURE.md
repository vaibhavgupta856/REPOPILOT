# RepoPilot Demo — Architecture

This document describes the **sample project layout** bundled with RepoPilot so you can exercise IDE features: scrolling, markdown preview, outline, search, and multi-language syntax highlighting.

## Overview

```
demo/
├── src/algorithms/     Python graph & sort implementations
├── backend/            FastAPI REST service
├── frontend/           TypeScript React-style UI
├── docs/               Long-form documentation (this file)
├── tests/              Pytest suite
├── data/               Large reference module
└── styles/             CSS theme tokens
```

## Design goals

1. **Realistic structure** — mirrors a small full-stack repo, not a single hello-world file.
2. **Symbol density** — many functions/classes for outline and go-to-symbol.
3. **Cross-file references** — search for `Repilot`, `TODO`, or `dijkstra` across the tree.
4. **Readable docs** — markdown with headings for preview mode.

## Backend layer

The FastAPI app in `backend/main.py` exposes:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Liveness probe |
| `/tasks` | GET | List tasks (optional `completed` filter) |
| `/tasks` | POST | Create task |
| `/tasks/{id}` | GET | Fetch one task |
| `/tasks/{id}/complete` | PATCH | Mark complete |
| `/stats` | GET | Aggregate counters |

State is in-memory (`_TASKS` dict) — suitable for demos, not production.

### Extension ideas

- Persist tasks to SQLite
- Add JWT auth middleware
- Wire OpenTelemetry spans on each route

## Algorithm modules

### `graph.py`

Contains `Graph`, `Edge`, `UnionFind`, and:

- **BFS / DFS** — traversal orders
- **Dijkstra** — shortest paths with non-negative weights
- **Topological sort** — Kahn's algorithm with cycle detection
- **Kruskal MST** — minimum spanning tree via union-find

### `sorting.py`

Classic sorts: merge, quick, heap, insertion, counting. Includes `benchmark_sorts()` for timing comparisons.

## Frontend layer

`frontend/src/api.ts` defines types and fetch helpers. `Dashboard.tsx` is a sample component with:

- Async data loading
- Filter tabs (all / active / done)
- Priority selector
- Memoized derived lists

## Testing strategy

`tests/test_graph.py` and `tests/test_sorting.py` use pytest. Run:

```bash
cd demo_workspace
python -m pytest tests/ -v
```

## Styling

`styles/theme.css` defines CSS variables for a dark dashboard. Try opening it alongside `Dashboard.tsx` in split view.

## Data reference module

`data/reference_catalog.py` is intentionally **large** (~400+ lines) so vertical scrolling feels natural in the editor. It models a product catalog with validators — browse outline to jump between sections.

## Agent workflow examples

When using the RepoPilot agent on this demo:

1. **Plan** — "List files under src/algorithms and summarize each"
2. **Code** — "Implement A* in graph.py using the existing Graph class"
3. **Test** — "Add pytest for topological_sort cycle detection"
4. **Review** — accept green diffs in the IDE

## Security note

This demo uses in-memory storage and has no authentication. Do not deploy as-is to the public internet.

## Glossary

| Term | Meaning |
|------|---------|
| MST | Minimum spanning tree |
| BFS | Breadth-first search |
| DFS | Depth-first search |
| IDE | Integrated development environment |

## Appendix A — Complexity cheatsheet

| Algorithm | Time | Space |
|-----------|------|-------|
| Dijkstra | O((V+E) log V) | O(V) |
| BFS | O(V+E) | O(V) |
| Merge sort | O(n log n) | O(n) |
| Quick sort | O(n log n) avg | O(log n) |
| Heap sort | O(n log n) | O(1) |

## Appendix B — File index

Scroll the explorer for the full tree. Key entry points:

- `README.md` — start here
- `src/algorithms/graph.py` — graph algorithms
- `backend/main.py` — API server
- `frontend/src/Dashboard.tsx` — UI component
- `data/reference_catalog.py` — long scrolling file

---

*Generated for RepoPilot demo workspaces. Last updated: 2026.*
