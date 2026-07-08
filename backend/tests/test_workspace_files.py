"""Tests for workspace file diff baselines."""

from pathlib import Path

import pytest

from app.config import settings
from app.models.task import FileChange
from app.services.workspace_files import build_file_detail, build_file_list_for_repo


@pytest.fixture
def workspace_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(settings, "workspace_dir", tmp_path / "workspace")
    settings.workspace_dir.mkdir(parents=True, exist_ok=True)
    return settings.workspace_dir


def test_untouched_file_has_no_agent_changes(workspace_root: Path) -> None:
    workspace = workspace_root / "users" / "u1" / "repos" / "r1"
    workspace.mkdir(parents=True)
    (workspace / "main.py").write_text("print('hello')\n", encoding="utf-8")

    files = build_file_list_for_repo("u1", "r1", workspace, [])
    main = next(f for f in files if f.path == "main.py")
    assert main.has_agent_change is False

    detail = build_file_detail("u1", "r1", workspace, "main.py", [])
    assert detail.changed_lines == []
    assert detail.original == detail.current


def test_agent_modified_file_shows_changes(workspace_root: Path) -> None:
    workspace = workspace_root / "users" / "u1" / "repos" / "r1"
    originals = workspace_root / "users" / "u1" / "meta" / "r1" / "originals"
    originals.mkdir(parents=True)
    workspace.mkdir(parents=True)
    (workspace / "main.py").write_text("print('agent')\n", encoding="utf-8")
    (originals / "main.py").write_text("print('hello')\n", encoding="utf-8")

    pending = [FileChange(path="main.py", action="modify", content="print('agent')\n")]

    files = build_file_list_for_repo("u1", "r1", workspace, pending)
    main = next(f for f in files if f.path == "main.py")
    assert main.has_agent_change is True

    detail = build_file_detail("u1", "r1", workspace, "main.py", pending)
    assert detail.changed_lines == [0]
