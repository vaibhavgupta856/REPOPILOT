"""Language detection from file extensions and content heuristics."""

from collections import Counter
from pathlib import Path

# Extension → language label
EXTENSION_MAP: dict[str, str] = {
    ".py": "Python",
    ".pyi": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".kt": "Kotlin",
    ".kts": "Kotlin",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "C++",
    ".cc": "C++",
    ".cxx": "C++",
    ".c": "C",
    ".h": "C",
    ".hpp": "C++",
    ".swift": "Swift",
    ".scala": "Scala",
    ".r": "R",
    ".R": "R",
    ".sql": "SQL",
    ".sh": "Shell",
    ".bash": "Shell",
    ".zsh": "Shell",
    ".ps1": "PowerShell",
    ".vue": "Vue",
    ".svelte": "Svelte",
    ".dart": "Dart",
    ".lua": "Lua",
    ".ex": "Elixir",
    ".exs": "Elixir",
    ".erl": "Erlang",
    ".hs": "Haskell",
    ".ml": "OCaml",
    ".clj": "Clojure",
    ".jl": "Julia",
}

SKIP_DIRS = {
    ".git",
    ".svn",
    ".hg",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "env",
    ".env",
    "dist",
    "build",
    ".next",
    ".nuxt",
    "target",
    "vendor",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    "coverage",
    ".idea",
    ".vscode",
    "workspace",
    "sandbox",
}


def should_skip(path: Path, root: Path | None = None) -> bool:
    """Skip vendor/cache dirs. When *root* is given, only inspect path relative to it."""
    if root is not None:
        try:
            parts = path.relative_to(root.resolve()).parts
        except ValueError:
            parts = path.parts
    else:
        parts = path.parts
    return any(part in SKIP_DIRS for part in parts)


def detect_languages(root: Path) -> dict[str, int]:
    """Count source files by language under *root*."""
    root = root.resolve()
    counts: Counter[str] = Counter()

    for file_path in root.rglob("*"):
        if not file_path.is_file() or should_skip(file_path, root):
            continue
        lang = EXTENSION_MAP.get(file_path.suffix.lower())
        if lang:
            counts[lang] += 1

    return dict(counts.most_common())


def primary_language(languages: dict[str, int]) -> str | None:
    if not languages:
        return None
    return next(iter(languages))
