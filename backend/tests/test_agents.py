"""Tests for workspace engine and test result parser (no LLM)."""

from pathlib import Path

from agent.tester.runner import _parse_pytest_output, detect_runner
from app.models.repository import (
    ArchitectureSummary,
    DependencyGraph,
    RepositoryMap,
    RepositorySummary,
    RepositorySource,
)
from app.models.task import FileChange
from app.services.workspace import apply_changes, create_task_workspace, read_files


def test_create_and_apply_changes(tmp_path: Path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("x = 1\n", encoding="utf-8")

    task_id, workspace = create_task_workspace(tmp_path)
    assert workspace.exists()
    assert (workspace / "src" / "main.py").read_text(encoding="utf-8") == "x = 1\n"

    apply_changes(
        workspace,
        [FileChange(path="src/utils.py", action="create", content="def add(a, b):\n    return a + b\n")],
    )
    assert (workspace / "src" / "utils.py").exists()
    contents = read_files(workspace, ["src/utils.py"])
    assert "def add" in contents["src/utils.py"]


def test_parse_pytest_failures():
    output = """
tests/test_auth.py::test_login FAILED - AssertionError: 401 != 200
=================== 1 failed, 3 passed in 0.12s ===================
"""
    passed, failed, skipped, failures = _parse_pytest_output(output, "")
    assert passed == 3
    assert failed == 1
    assert len(failures) == 1
    assert failures[0].test_name == "test_login"


def test_detect_pytest_runner(tmp_path: Path):
    (tmp_path / "tests").mkdir()
    (tmp_path / "tests" / "test_app.py").write_text("def test_ok(): pass\n", encoding="utf-8")
    summary = RepositorySummary(
        id="x",
        name="t",
        source=RepositorySource.GITHUB,
        path=str(tmp_path),
        map=RepositoryMap(),
        architecture=ArchitectureSummary(),
        dependency_graph=DependencyGraph(),
    )
    runner, cmd = detect_runner(summary, tmp_path)
    assert runner == "pytest"
    assert "pytest" in cmd[0]
