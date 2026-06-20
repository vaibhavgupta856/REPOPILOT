"""Persistent repository workspace — one folder per user/repo, edits in place."""

import json
import shutil
from pathlib import Path
from urllib.parse import urlparse

import git

from app.config import settings
from app.models.repository import RepositorySource, ScanRequest
from app.models.task import FileChange
from app.services.path_utils import normalize_path


def user_workspace_root(user_id: str) -> Path:
    path = settings.workspace_dir / "users" / user_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def repo_meta_dir(user_id: str, repo_id: str) -> Path:
    path = user_workspace_root(user_id) / "meta" / repo_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def repo_root_dir(user_id: str, repo_id: str) -> Path:
    return user_workspace_root(user_id) / "repos" / repo_id


def originals_dir(user_id: str, repo_id: str) -> Path:
    path = repo_meta_dir(user_id, repo_id) / "originals"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_repo_root(summary_path: str) -> Path:
    return Path(summary_path).resolve()


def resolve_scan_path(
    request: ScanRequest, user_id: str, repo_id: str
) -> tuple[Path, str, RepositorySource]:
    if not request.github_url.strip():
        raise ValueError("github_url is required")

    parsed = urlparse(request.github_url.rstrip("/"))
    repo_name = parsed.path.strip("/").split("/")[-1].replace(".git", "")
    if not repo_name:
        raise ValueError("Invalid GitHub URL — use https://github.com/owner/repo")

    dest = repo_root_dir(user_id, repo_id)

    if dest.exists() and any(dest.iterdir()):
        return dest, repo_name, RepositorySource.GITHUB

    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True, exist_ok=True)
    git.Repo.clone_from(request.github_url, dest, depth=1)
    return dest, repo_name, RepositorySource.GITHUB


def _pending_path(user_id: str, repo_id: str) -> Path:
    return repo_meta_dir(user_id, repo_id) / "pending_changes.json"


def load_pending_changes(user_id: str, repo_id: str) -> list[FileChange]:
    path = _pending_path(user_id, repo_id)
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return [FileChange.model_validate(c) for c in data]
    except (json.JSONDecodeError, OSError):
        return []


def save_pending_changes(user_id: str, repo_id: str, changes: list[FileChange]) -> None:
    existing = {normalize_path(c.path): c for c in load_pending_changes(user_id, repo_id)}
    for change in changes:
        existing[normalize_path(change.path)] = change
    merged = list(existing.values())
    _pending_path(user_id, repo_id).write_text(
        json.dumps([c.model_dump() for c in merged], indent=2),
        encoding="utf-8",
    )


def clear_pending_file(user_id: str, repo_id: str, rel_path: str) -> None:
    rel = normalize_path(rel_path)
    remaining = [
        c for c in load_pending_changes(user_id, repo_id) if normalize_path(c.path) != rel
    ]
    _pending_path(user_id, repo_id).write_text(
        json.dumps([c.model_dump() for c in remaining], indent=2),
        encoding="utf-8",
    )


def snapshot_before_agent_change(
    user_id: str, repo_id: str, repo_root: Path, change: FileChange
) -> None:
    rel = normalize_path(change.path)
    snap = originals_dir(user_id, repo_id) / rel
    if snap.exists():
        return
    snap.parent.mkdir(parents=True, exist_ok=True)
    target = repo_root / rel
    if change.action == "modify" and target.is_file():
        snap.write_text(target.read_text(encoding="utf-8"), encoding="utf-8")
    elif change.action == "create":
        snap.write_text("", encoding="utf-8")
    elif change.action == "delete" and target.is_file():
        snap.write_text(target.read_text(encoding="utf-8"), encoding="utf-8")


def snapshot_all_agent_changes(
    user_id: str, repo_id: str, repo_root: Path, changes: list[FileChange]
) -> None:
    for change in changes:
        snapshot_before_agent_change(user_id, repo_id, repo_root, change)


def accept_file_baseline(user_id: str, repo_id: str, rel_path: str, repo_root: Path) -> None:
    """User accepted all changes — current content becomes new baseline."""
    rel = normalize_path(rel_path)
    target = repo_root / rel
    snap = originals_dir(user_id, repo_id) / rel
    if target.is_file():
        snap.parent.mkdir(parents=True, exist_ok=True)
        snap.write_text(target.read_text(encoding="utf-8"), encoding="utf-8")
    elif snap.exists():
        snap.unlink()
    clear_pending_file(user_id, repo_id, rel)
