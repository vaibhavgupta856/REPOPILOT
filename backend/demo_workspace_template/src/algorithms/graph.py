"""Graph algorithms — demo module for RepoPilot IDE scrolling & outline."""

from __future__ import annotations

import heapq
from collections import deque
from dataclasses import dataclass, field
from typing import Callable, Generic, Hashable, Iterable, TypeVar

T = TypeVar("T", bound=Hashable)


@dataclass
class Edge:
    source: str
    target: str
    weight: float = 1.0

    def __post_init__(self) -> None:
        if self.weight < 0:
            raise ValueError("negative edge weight")


@dataclass
class Graph:
    """Adjacency-list weighted directed graph."""

    nodes: set[str] = field(default_factory=set)
    adjacency: dict[str, list[tuple[str, float]]] = field(default_factory=dict)

    def add_node(self, node: str) -> None:
        self.nodes.add(node)
        self.adjacency.setdefault(node, [])

    def add_edge(self, edge: Edge) -> None:
        self.add_node(edge.source)
        self.add_node(edge.target)
        self.adjacency[edge.source].append((edge.target, edge.weight))

    def neighbors(self, node: str) -> list[tuple[str, float]]:
        return self.adjacency.get(node, [])

    def bfs(self, start: str) -> list[str]:
        if start not in self.nodes:
            raise KeyError(start)
        visited: set[str] = set()
        order: list[str] = []
        queue: deque[str] = deque([start])
        visited.add(start)
        while queue:
            node = queue.popleft()
            order.append(node)
            for neighbor, _ in self.neighbors(node):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        return order

    def dfs(self, start: str) -> list[str]:
        if start not in self.nodes:
            raise KeyError(start)
        visited: set[str] = set()
        order: list[str] = []

        def visit(node: str) -> None:
            visited.add(node)
            order.append(node)
            for neighbor, _ in self.neighbors(node):
                if neighbor not in visited:
                    visit(neighbor)

        visit(start)
        return order


def dijkstra(graph: Graph, source: str) -> tuple[dict[str, float], dict[str, str | None]]:
    """Single-source shortest paths (non-negative weights)."""
    if source not in graph.nodes:
        raise KeyError(source)

    dist: dict[str, float] = {node: float("inf") for node in graph.nodes}
    prev: dict[str, str | None] = {node: None for node in graph.nodes}
    dist[source] = 0.0
    heap: list[tuple[float, str]] = [(0.0, source)]

    while heap:
        current_dist, node = heapq.heappop(heap)
        if current_dist > dist[node]:
            continue
        for neighbor, weight in graph.neighbors(node):
            alt = current_dist + weight
            if alt < dist[neighbor]:
                dist[neighbor] = alt
                prev[neighbor] = node
                heapq.heappush(heap, (alt, neighbor))

    return dist, prev


def reconstruct_path(prev: dict[str, str | None], target: str) -> list[str]:
    path: list[str] = []
    cursor: str | None = target
    while cursor is not None:
        path.append(cursor)
        cursor = prev[cursor]
    path.reverse()
    return path


def topological_sort(graph: Graph) -> list[str]:
    """Kahn's algorithm — raises ValueError if cycle detected."""
    indegree = {node: 0 for node in graph.nodes}
    for node in graph.nodes:
        for neighbor, _ in graph.neighbors(node):
            indegree[neighbor] = indegree.get(neighbor, 0) + 1

    queue = deque([n for n, d in indegree.items() if d == 0])
    order: list[str] = []

    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor, _ in graph.neighbors(node):
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)

    if len(order) != len(graph.nodes):
        raise ValueError("graph contains a cycle")
    return order


def build_demo_city_graph() -> Graph:
    """Sample map for testing pathfinding visualizations."""
    g = Graph()
    edges = [
        Edge("A", "B", 4),
        Edge("A", "C", 2),
        Edge("B", "C", 1),
        Edge("B", "D", 5),
        Edge("C", "D", 8),
        Edge("C", "E", 10),
        Edge("D", "E", 2),
        Edge("D", "F", 6),
        Edge("E", "F", 3),
    ]
    for edge in edges:
        g.add_edge(edge)
    return g


class UnionFind:
    def __init__(self, items: Iterable[T]) -> None:
        self.parent = {item: item for item in items}
        self.rank = {item: 0 for item in items}

    def find(self, item: T) -> T:
        if self.parent[item] != item:
            self.parent[item] = self.find(self.parent[item])
        return self.parent[item]

    def union(self, a: T, b: T) -> bool:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        if self.rank[ra] < self.rank[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        if self.rank[ra] == self.rank[rb]:
            self.rank[ra] += 1
        return True


def kruskal_mst(edges: list[Edge]) -> list[Edge]:
    nodes = {e.source for e in edges} | {e.target for e in edges}
    uf = UnionFind(nodes)
    sorted_edges = sorted(edges, key=lambda e: e.weight)
    mst: list[Edge] = []
    for edge in sorted_edges:
        if uf.union(edge.source, edge.target):
            mst.append(edge)
    return mst


# TODO: add A* heuristic search for game maps
# TODO: benchmark against NetworkX on large sparse graphs

if __name__ == "__main__":
    demo = build_demo_city_graph()
    distances, previous = dijkstra(demo, "A")
    print("Distances from A:", distances)
    print("Path A→F:", reconstruct_path(previous, "F"))
    print("BFS:", demo.bfs("A"))
    print("DFS:", demo.dfs("A"))
