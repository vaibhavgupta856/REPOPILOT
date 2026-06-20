"""Shared path helpers."""


def normalize_path(path: str) -> str:
    return path.replace("\\", "/").lstrip("./")
