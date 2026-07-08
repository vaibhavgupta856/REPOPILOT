"""Tests for graph algorithms."""

import pytest

from src.algorithms.graph import (
    Edge,
    Graph,
    build_demo_city_graph,
    dijkstra,
    reconstruct_path,
    topological_sort,
)


def test_dijkstra_demo_graph():
    g = build_demo_city_graph()
    dist, prev = dijkstra(g, "A")
    assert dist["F"] == 15.0
    path = reconstruct_path(prev, "F")
    assert path[0] == "A"
    assert path[-1] == "F"


def test_bfs_visits_all_reachable():
    g = build_demo_city_graph()
    order = g.bfs("A")
    assert set(order) == g.nodes


def test_topological_sort_cycle_raises():
    g = Graph()
    g.add_edge(Edge("X", "Y"))
    g.add_edge(Edge("Y", "Z"))
    g.add_edge(Edge("Z", "X"))
    with pytest.raises(ValueError, match="cycle"):
        topological_sort(g)


def test_negative_weight_rejected():
    with pytest.raises(ValueError):
        Edge("A", "B", -1)
