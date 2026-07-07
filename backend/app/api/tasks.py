from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.session import get_db
from app.deps import get_current_user
from app.models.task import TaskRequest, TaskResponse, TaskRun
from app.services.llm_errors import format_llm_error
from app.services.repository_scanner import load_summary
from app.services.task_orchestrator import list_tasks, list_tasks_for_repo, load_task, run_task

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("/run", response_model=TaskResponse)
def execute_task(
    request: TaskRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskResponse:
    """Sync route — FastAPI runs blocking LLM work in a thread pool (fixes WinError 10038 on Windows)."""
    if load_summary(db, user.id, request.repo_id) is None:
        raise HTTPException(status_code=404, detail="Repository not found")
    try:
        task = run_task(db, user.id, request)
        return TaskResponse(task=task)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=format_llm_error(exc)) from exc


@router.get("", response_model=list[TaskRun])
async def get_tasks(
    repo_id: str | None = None,
    user: User = Depends(get_current_user),
) -> list[TaskRun]:
    if repo_id:
        return list_tasks_for_repo(user.id, repo_id)
    return list_tasks(user.id)


@router.get("/{task_id}", response_model=TaskRun)
async def get_task(
    task_id: str,
    user: User = Depends(get_current_user),
) -> TaskRun:
    task = load_task(user.id, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
