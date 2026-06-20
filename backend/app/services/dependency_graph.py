"""Build import-based dependency graph from source files."""

import re
from pathlib import Path

from app.models.repository import DependencyGraph, DependencyNode
from app.services.language_detector import should_skip

# Python: import x / from x import y
PY_IMPORT = re.compile(r"^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))", re.MULTILINE)

# JS/TS: import ... from 'x' / require('x')
JS_IMPORT = re.compile(
    r"""(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))""",
    re.MULTILINE,
)

# Go: import "x"
GO_IMPORT = re.compile(r'import\s+(?:\([\s\S]*?\)|"([^"]+)")', re.MULTILINE)

SOURCE_EXTENSIONS = {".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java"}


def _extract_imports(path: Path, content: str) -> list[str]:
    suffix = path.suffix.lower()
    imports: list[str] = []

    if suffix == ".py":
        for m in PY_IMPORT.finditer(content):
            mod = m.group(1) or m.group(2)
            if mod:
                imports.append(mod.split(".")[0])
    elif suffix in {".js", ".ts", ".tsx", ".jsx"}:
        for m in JS_IMPORT.finditer(content):
            mod = m.group(1) or m.group(2)
            if mod and not mod.startswith("."):
                imports.append(mod.split("/")[0].split("@")[-1])
            elif mod and mod.startswith("."):
                imports.append(mod)
    elif suffix == ".go":
        for m in GO_IMPORT.finditer(content):
            if m.group(1):
                imports.append(m.group(1).split("/")[-1])

    return list(dict.fromkeys(imports))


def _relative_key(root: Path, file_path: Path) -> str:
    return str(file_path.relative_to(root)).replace("\\", "/")


def build_dependency_graph(root: Path) -> DependencyGraph:
    """Parse imports across source files and build a cross-reference graph."""
    root = root.resolve()
    file_imports: dict[str, list[str]] = {}
    module_to_files: dict[str, list[str]] = {}

    for file_path in root.rglob("*"):
        if not file_path.is_file() or should_skip(file_path, root):
            continue
        if file_path.suffix.lower() not in SOURCE_EXTENSIONS:
            continue

        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue

        rel = _relative_key(root, file_path)
        imports = _extract_imports(file_path, content)
        file_imports[rel] = imports

        stem = file_path.stem
        module_to_files.setdefault(stem, []).append(rel)

    nodes: list[DependencyNode] = []
    for rel, imports in file_imports.items():
        imported_by: list[str] = []
        for other_rel, other_imports in file_imports.items():
            if other_rel == rel:
                continue
            other_stem = Path(other_rel).stem
            if other_stem in imports or any(imp in rel for imp in imports if imp.startswith(".")):
                imported_by.append(other_rel)

        nodes.append(DependencyNode(path=rel, imports=imports, imported_by=imported_by))

    entry_points = [
        rel
        for rel in file_imports
        if any(
            name in rel.lower()
            for name in ("main.py", "app.py", "index.ts", "index.js", "main.go", "server.ts", "server.js")
        )
    ]

    return DependencyGraph(nodes=nodes, entry_points=entry_points)
