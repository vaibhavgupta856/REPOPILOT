"""Orchestrates Phases 3–7 on the live repo workspace (no task copies)."""

import json
import sys
import uuid
from datetime import datetime
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from agent.coder.engine import generate_changes  # noqa: E402
from agent.healer.engine import run_healing_loop  # noqa: E402
from agent.planner.engine import create_plan  # noqa: E402

from app.models.task import TaskRequest, TaskRun, TaskStatus
from app.services.path_utils import normalize_path
from app.services.repo_workspace import (
    get_repo_root,
    load_pending_changes,
    originals_dir,
    repo_meta_dir,
    save_pending_changes,
    snapshot_all_agent_changes,
    snapshot_before_agent_change,
    user_workspace_root,
)
from app.services.repository_scanner import load_summary
from app.services.workspace import apply_changes, get_diff_summary
from sqlalchemy.orm import Session


def _task_log_path(user_id: str, repo_id: str, task_id: str) -> Path:
    path = repo_meta_dir(user_id, repo_id) / "tasks"
    path.mkdir(parents=True, exist_ok=True)
    return path / f"{task_id}.json"


def save_task(user_id: str, task: TaskRun) -> None:
    task.updated_at = datetime.utcnow()
    _task_log_path(user_id, task.repo_id, task.id).write_text(
        json.dumps(task.model_dump(mode="json"), indent=2),
        encoding="utf-8",
    )


def load_task(user_id: str, task_id: str) -> TaskRun | None:
    meta_root = user_workspace_root(user_id) / "meta"
    if not meta_root.exists():
        return None
    for state_file in meta_root.glob("*/tasks/*.json"):
        if state_file.stem == task_id:
            data = json.loads(state_file.read_text(encoding="utf-8"))
            return TaskRun.model_validate(data)
    return None


def list_tasks(user_id: str) -> list[TaskRun]:
    meta_root = user_workspace_root(user_id) / "meta"
    if not meta_root.exists():
        return []
    results: list[TaskRun] = []
    for state_file in meta_root.glob("*/tasks/*.json"):
        try:
            data = json.loads(state_file.read_text(encoding="utf-8"))
            results.append(TaskRun.model_validate(data))
        except (json.JSONDecodeError, OSError):
            continue
    return sorted(results, key=lambda t: t.created_at, reverse=True)


def list_tasks_for_repo(user_id: str, repo_id: str) -> list[TaskRun]:
    task_dir = repo_meta_dir(user_id, repo_id) / "tasks"
    if not task_dir.exists():
        return []
    results: list[TaskRun] = []
    for state_file in task_dir.glob("*.json"):
        try:
            data = json.loads(state_file.read_text(encoding="utf-8"))
            results.append(TaskRun.model_validate(data))
        except (json.JSONDecodeError, OSError):
            continue
    return sorted(results, key=lambda t: t.created_at, reverse=True)


def run_task(db: Session, user_id: str, request: TaskRequest) -> TaskRun:
    summary = load_summary(db, user_id, request.repo_id)
    if summary is None:
        raise ValueError(f"Repository not found: {request.repo_id}")

    workspace = get_repo_root(summary.path)
    task_id = uuid.uuid4().hex[:12]
    task = TaskRun(
        id=task_id,
        repo_id=request.repo_id,
        task=request.task,
        status=TaskStatus.PLANNING,
        workspace_path=str(workspace),
    )
    save_task(user_id, task)

    try:
        plan = create_plan(request.task, summary, workspace, request.llm)
        task.plan = plan
        task.status = TaskStatus.CODING
        save_task(user_id, task)

        changes, code_summary = generate_changes(
            request.task, plan, summary, workspace, request.llm
        )
        task.changes = changes
        task.metadata["code_summary"] = code_summary

        snapshot_all_agent_changes(user_id, request.repo_id, workspace, changes)
        apply_changes(workspace, changes)
        save_pending_changes(user_id, request.repo_id, changes)
        task.metadata["diff"] = get_diff_summary(workspace, changes)
        save_task(user_id, task)

        if request.run_tests:
            task.status = TaskStatus.TESTING
            save_task(user_id, task)

            all_changes, test_results, healing = run_healing_loop(
                request.task,
                plan,
                summary,
                workspace,
                request.llm,
                changes,
                max_iterations=request.max_healing_iterations,
            )
            task.changes = all_changes
            task.test_results = test_results
            task.healing_iterations = healing

            for change in all_changes:
                snap = originals_dir(user_id, request.repo_id) / normalize_path(change.path)
                if not snap.exists():
                    snapshot_before_agent_change(
                        user_id, request.repo_id, workspace, change
                    )
            save_pending_changes(user_id, request.repo_id, all_changes)
            task.metadata["diff"] = get_diff_summary(workspace, all_changes)
            task.status = (
                TaskStatus.COMPLETED
                if test_results and test_results[-1].success
                else TaskStatus.FAILED
            )
        else:
            task.status = TaskStatus.COMPLETED

        save_task(user_id, task)
        return task

    except Exception as exc:
        task.status = TaskStatus.FAILED
        task.error = str(exc)
        save_task(user_id, task)
        raise
