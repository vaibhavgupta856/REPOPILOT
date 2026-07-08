"""Sorting algorithms — demo module with multiple implementations."""

from __future__ import annotations

import random
from typing import Callable, TypeVar

T = TypeVar("T")


def merge_sort(items: list[T], *, key: Callable[[T], float] | None = None) -> list[T]:
    if len(items) <= 1:
        return items[:]
    mid = len(items) // 2
    left = merge_sort(items[:mid], key=key)
    right = merge_sort(items[mid:], key=key)
    return _merge(left, right, key=key)


def _merge(left: list[T], right: list[T], *, key: Callable[[T], float] | None) -> list[T]:
    result: list[T] = []
    i = j = 0
    while i < len(left) and j < len(right):
        lv = key(left[i]) if key else left[i]  # type: ignore[operator]
        rv = key(right[j]) if key else right[j]  # type: ignore[operator]
        if lv <= rv:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result


def quick_sort(items: list[T]) -> list[T]:
    if len(items) <= 1:
        return items[:]
    pivot = items[len(items) // 2]
    left = [x for x in items if x < pivot]
    mid = [x for x in items if x == pivot]
    right = [x for x in items if x > pivot]
    return quick_sort(left) + mid + quick_sort(right)


def heap_sort(items: list[T]) -> list[T]:
    arr = items[:]
    n = len(arr)

    def heapify(size: int, root: int) -> None:
        largest = root
        left = 2 * root + 1
        right = 2 * root + 2
        if left < size and arr[left] > arr[largest]:
            largest = left
        if right < size and arr[right] > arr[largest]:
            largest = right
        if largest != root:
            arr[root], arr[largest] = arr[largest], arr[root]
            heapify(size, largest)

    for i in range(n // 2 - 1, -1, -1):
        heapify(n, i)
    for i in range(n - 1, 0, -1):
        arr[0], arr[i] = arr[i], arr[0]
        heapify(i, 0)
    return arr


def insertion_sort(items: list[T]) -> list[T]:
    arr = items[:]
    for i in range(1, len(arr)):
        key_item = arr[i]
        j = i - 1
        while j >= 0 and arr[j] > key_item:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key_item
    return arr


def counting_sort(nums: list[int]) -> list[int]:
    if not nums:
        return []
    lo, hi = min(nums), max(nums)
    count = [0] * (hi - lo + 1)
    for n in nums:
        count[n - lo] += 1
    result: list[int] = []
    for i, c in enumerate(count):
        result.extend([i + lo] * c)
    return result


def benchmark_sorts(size: int = 10_000) -> dict[str, float]:
    import time

    data = [random.random() for _ in range(size)]
    results: dict[str, float] = {}
    for name, fn in [
        ("merge", lambda d: merge_sort(d)),
        ("quick", quick_sort),
        ("heap", heap_sort),
        ("insertion", insertion_sort),
    ]:
        sample = data[: min(size, 5000 if name == "insertion" else size)]
        start = time.perf_counter()
        fn(sample)
        results[name] = time.perf_counter() - start
    return results


# Repilot: students often compare stable vs unstable sorts here
