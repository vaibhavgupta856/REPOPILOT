"""Workspace file browsing, diff, and manual edits."""

import difflib
import json
from pathlib import Path

from app.models.task import FileChange
from app.models.workspace import WorkspaceFileDetail, WorkspaceFileInfo
from app.services.path_utils import normalize_path
from app.services.repo_workspace import originals_dir, repo_meta_dir
from app.services.workspace import BINARY_EXTENSIONS

SKIP_DIRS = {
    ".forge",
    ".forge_snapshot",
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
}


def _accepted_path(user_id: str, repo_id: str) -> Path:
    return repo_meta_dir(user_id, repo_id) / "accepted.json"


def read_original(
    user_id: str, repo_id: str, rel_path: str, pending: list[FileChange] | None = None
) -> str:
    rel = normalize_path(rel_path)
    snap = originals_dir(user_id, repo_id) / rel
    if snap.is_file():
        return snap.read_text(encoding="utf-8", errors="replace")
    if pending:
        change = next((c for c in pending if normalize_path(c.path) == rel), None)
        if change and change.action == "create":
            return ""
    return ""


def read_baseline(
    user_id: str,
    repo_id: str,
    workspace: Path,
    rel_path: str,
    pending: list[FileChange],
) -> str:
    """Baseline for diffing — agent snapshot if present, else current file content."""
    rel = normalize_path(rel_path)
    snap = originals_dir(user_id, repo_id) / rel
    if snap.is_file():
        return snap.read_text(encoding="utf-8", errors="replace")
    change = next((c for c in pending if normalize_path(c.path) == rel), None)
    if change and change.action == "create":
        return ""
    target = workspace / rel
    if target.is_file():
        return read_workspace_file(workspace, rel)
    return ""


def get_changed_line_indices(original: str, current: str) -> list[int]:
    orig_lines = original.splitlines()
    curr_lines = current.splitlines()
    matcher = difflib.SequenceMatcher(None, orig_lines, curr_lines)
    changed: set[int] = set()
    for tag, _i1, _i2, j1, j2 in matcher.get_opcodes():
        if tag in ("insert", "replace"):
            for j in range(j1, j2):
                changed.add(j)
    return sorted(changed)


def list_workspace_files(workspace: Path) -> list[str]:
    results: list[str] = []
    for file_path in workspace.rglob("*"):
        if not file_path.is_file():
            continue
        if any(part in SKIP_DIRS for part in file_path.parts):
            continue
        if file_path.suffix.lower() in BINARY_EXTENSIONS:
            continue
        results.append(str(file_path.relative_to(workspace)).replace("\\", "/"))
    return sorted(results)


def list_workspace_dirs(workspace: Path) -> list[str]:
    results: list[str] = []
    for dir_path in workspace.rglob("*"):
        if not dir_path.is_dir():
            continue
        if any(part in SKIP_DIRS for part in dir_path.parts):
            continue
        results.append(str(dir_path.relative_to(workspace)).replace("\\", "/"))
    return sorted(results)


def read_workspace_file(workspace: Path, rel_path: str) -> str:
    rel = normalize_path(rel_path)
    target = workspace / rel
    if not target.is_file():
        raise FileNotFoundError(rel)
    return target.read_text(encoding="utf-8", errors="replace")


def write_workspace_file(workspace: Path, rel_path: str, content: str) -> None:
    rel = normalize_path(rel_path)
    target = workspace / rel
    if any(part in SKIP_DIRS for part in target.parts):
        raise PermissionError("Cannot write to system path")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def _has_agent_change(
    user_id: str,
    repo_id: str,
    workspace: Path,
    rel_path: str,
    pending: list[FileChange],
    change_map: dict[str, str],
    orig_paths: set[str],
    is_file: bool,
) -> bool:
    if rel_path in change_map:
        return True
    if not is_file or rel_path not in orig_paths:
        return False
    try:
        current = read_workspace_file(workspace, rel_path)
        baseline = read_baseline(user_id, repo_id, workspace, rel_path, pending)
        return bool(get_changed_line_indices(baseline, current))
    except FileNotFoundError:
        return False


def build_file_list_for_repo(
    user_id: str, repo_id: str, workspace: Path, pending: list[FileChange]
) -> list[WorkspaceFileInfo]:
    change_map = {normalize_path(c.path): c.action for c in pending}
    orig_paths: set[str] = set()
    orig_root = originals_dir(user_id, repo_id)
    if orig_root.exists():
        for f in orig_root.rglob("*"):
            if f.is_file():
                orig_paths.add(str(f.relative_to(orig_root)).replace("\\", "/"))

    file_paths = set(list_workspace_files(workspace))
    dir_paths = set(list_workspace_dirs(workspace))

    paths = sorted(set(file_paths) | dir_paths | set(change_map.keys()) | orig_paths)
    return [
        WorkspaceFileInfo(
            path=p,
            is_dir=p in dir_paths and p not in file_paths and p not in change_map,
            action=change_map.get(p),
            has_agent_change=_has_agent_change(
                user_id, repo_id, workspace, p, pending, change_map, orig_paths, p in file_paths
            ),
        )
        for p in paths
    ]


def build_file_detail(
    user_id: str,
    repo_id: str,
    workspace: Path,
    rel_path: str,
    pending: list[FileChange],
) -> WorkspaceFileDetail:
    rel = normalize_path(rel_path)
    target = workspace / rel
    if target.is_file():
        current = read_workspace_file(workspace, rel)
    else:
        change = next((c for c in pending if normalize_path(c.path) == rel), None)
        current = change.content if change and change.content else ""
    original = read_baseline(user_id, repo_id, workspace, rel, pending)
    change_map = {normalize_path(c.path): c.action for c in pending}
    action = change_map.get(rel)
    changed = get_changed_line_indices(original, current)
    return WorkspaceFileDetail(
        path=rel,
        original=original,
        current=current,
        action=action,
        changed_lines=changed,
        lines=current.splitlines(),
    )


def load_accepted_lines(user_id: str, repo_id: str) -> dict[str, list[int]]:
    path = _accepted_path(user_id, repo_id)
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def save_accepted_lines(user_id: str, repo_id: str, accepted: dict[str, list[int]]) -> None:
    _accepted_path(user_id, repo_id).write_text(json.dumps(accepted, indent=2), encoding="utf-8")
