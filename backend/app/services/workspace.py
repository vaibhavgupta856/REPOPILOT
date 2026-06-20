"""Isolated workspace management (Phase 5)."""

import json
import shutil
import uuid
from datetime import datetime
from pathlib import Path

from app.config import settings
from app.models.task import FileChange

# Extensions safe to send to the LLM as text context
SOURCE_CODE_EXTENSIONS = {
    ".py", ".pyi", ".js", ".jsx", ".ts", ".tsx", ".go", ".rs", ".java", ".kt",
    ".rb", ".php", ".cs", ".cpp", ".c", ".h", ".swift", ".scala", ".sql",
    ".md", ".txt", ".toml", ".json", ".yaml", ".yml", ".cfg", ".ini",
}

BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".zip", ".tar", ".gz",
    ".pdf", ".exe", ".dll", ".so", ".bin", ".woff", ".woff2", ".mp3", ".mp4",
}


def create_task_workspace(source_repo_path: Path, task_id: str | None = None) -> tuple[str, Path]:
    """Copy repository into workspace/task-{id}/ for isolated execution."""
    task_id = task_id or uuid.uuid4().hex[:12]
    workspace = settings.workspace_dir / f"task-{task_id}"
    source = source_repo_path.resolve()

    if workspace.exists():
        shutil.rmtree(workspace)

    def _ignore(dir_path: str, names: list[str]) -> list[str]:
        skip = {
            ".git",
            "node_modules",
            "__pycache__",
            ".venv",
            "venv",
            "dist",
            "build",
            ".pytest_cache",
        }
        return [n for n in names if n in skip]

    shutil.copytree(source, workspace, ignore=_ignore, dirs_exist_ok=False)

    snapshot = workspace / ".forge_snapshot"
    snapshot.mkdir(exist_ok=True)
    meta = {"source": str(source), "created_at": datetime.utcnow().isoformat()}
    (snapshot / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    return task_id, workspace


def rollback_workspace(workspace: Path) -> None:
    """Remove workspace entirely (full rollback)."""
    if workspace.exists() and workspace.is_dir():
        shutil.rmtree(workspace, ignore_errors=True)


def read_files(workspace: Path, paths: list[str], max_bytes: int = 12_000) -> dict[str, str]:
    """Read text/source file contents for agent context (skips binaries)."""
    contents: dict[str, str] = {}
    for rel in paths:
        file_path = workspace / rel
        if not file_path.is_file():
            continue
        suffix = file_path.suffix.lower()
        if suffix in BINARY_EXTENSIONS:
            continue
        try:
            data = file_path.read_bytes()[:max_bytes]
            if b"\x00" in data:
                continue
            text = data.decode("utf-8", errors="replace")
            if not text.strip():
                continue
            contents[rel] = text
        except OSError:
            continue
    return contents


def list_source_files(workspace: Path, extensions: set[str] | None = None) -> list[str]:
    """List relative paths of source/text files in workspace (excludes binaries)."""
    exts = extensions if extensions is not None else SOURCE_CODE_EXTENSIONS
    skip_dirs = {".forge_snapshot", ".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build"}
    results: list[str] = []
    for file_path in workspace.rglob("*"):
        if not file_path.is_file():
            continue
        if any(part in skip_dirs for part in file_path.parts):
            continue
        if extensions and file_path.suffix.lower() not in extensions:
            continue
        if file_path.suffix.lower() in BINARY_EXTENSIONS:
            continue
        results.append(str(file_path.relative_to(workspace)).replace("\\", "/"))
    return sorted(results)


def apply_changes(workspace: Path, changes: list[FileChange]) -> list[str]:
    """Apply file changes to workspace. Returns list of modified paths."""
    modified: list[str] = []
    for change in changes:
        rel = change.path.replace("\\", "/").lstrip("./")
        target = workspace / rel
        if change.action == "delete":
            if target.exists():
                target.unlink()
                modified.append(rel)
            continue

        if change.content is None:
            continue

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(change.content, encoding="utf-8")
        modified.append(rel)

    return modified


def get_diff_summary(workspace: Path, changes: list[FileChange]) -> list[dict]:
    """Summarize changes for reporting."""
    summary = []
    for change in changes:
        entry: dict = {"path": change.path, "action": change.action}
        if change.action != "delete" and change.content is not None:
            entry["lines"] = len(change.content.splitlines())
        summary.append(entry)
    return summary
