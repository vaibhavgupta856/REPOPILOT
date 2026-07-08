"""Tests for sorting algorithms."""

import pytest

from src.algorithms.sorting import heap_sort, insertion_sort, merge_sort, quick_sort


@pytest.mark.parametrize(
    "sort_fn",
    [merge_sort, quick_sort, heap_sort, insertion_sort],
)
def test_sorts_integers(sort_fn):
    data = [5, 1, 4, 2, 8, 0, 2]
    assert sort_fn(data) == sorted(data)


def test_merge_sort_stable_with_keys():
    items = ["bb", "a", "ccc"]
    result = merge_sort(items, key=len)
    assert result == ["a", "bb", "ccc"]
