"""Sample FastAPI backend for the RepoPilot demo workspace."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(
    title="RepoPilot Demo API",
    description="Illustrative REST service bundled with the demo workspace.",
    version="1.0.0",
)


class HealthResponse(BaseModel):
    status: str = "ok"
    timestamp: datetime
    service: str = "repopilot-demo"


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    priority: int = Field(1, ge=1, le=5)


class Task(TaskCreate):
    id: int
    created_at: datetime
    completed: bool = False


_TASKS: dict[int, Task] = {}
_NEXT_ID = 1


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(timestamp=datetime.now(timezone.utc))


@app.get("/tasks", response_model=list[Task])
def list_tasks(completed: bool | None = None) -> list[Task]:
    tasks = list(_TASKS.values())
    if completed is not None:
        tasks = [t for t in tasks if t.completed == completed]
    return sorted(tasks, key=lambda t: t.id)


@app.post("/tasks", response_model=Task, status_code=201)
def create_task(payload: TaskCreate) -> Task:
    global _NEXT_ID
    task = Task(
        id=_NEXT_ID,
        created_at=datetime.now(timezone.utc),
        **payload.model_dump(),
    )
    _TASKS[_NEXT_ID] = task
    _NEXT_ID += 1
    return task


@app.get("/tasks/{task_id}", response_model=Task)
def get_task(task_id: int) -> Task:
    task = _TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.patch("/tasks/{task_id}/complete", response_model=Task)
def complete_task(task_id: int) -> Task:
    task = _TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    updated = task.model_copy(update={"completed": True})
    _TASKS[task_id] = updated
    return updated


@app.get("/stats")
def stats() -> dict[str, Any]:
    total = len(_TASKS)
    done = sum(1 for t in _TASKS.values() if t.completed)
    return {
        "total": total,
        "completed": done,
        "pending": total - done,
        "completion_rate": (done / total) if total else 0.0,
    }
