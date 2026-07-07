from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from app.services.llm import LLMConfig
from app.services.llm_types import LLMProvider


class TaskStatus(str, Enum):
    PENDING = "pending"
    PLANNING = "planning"
    CODING = "coding"
    TESTING = "testing"
    HEALING = "healing"
    COMPLETED = "completed"
    FAILED = "failed"


class PlanStep(BaseModel):
    description: str
    files: list[str] = Field(default_factory=list)


class ExecutionPlan(BaseModel):
    task: str
    files: list[str] = Field(default_factory=list)
    steps: list[PlanStep] = Field(default_factory=list)
    reasoning: str | None = None


class FileChange(BaseModel):
    path: str
    action: str  # create | modify | delete
    content: str | None = None


class TestFailure(BaseModel):
    test_name: str
    file: str | None = None
    line: int | None = None
    message: str
    raw: str | None = None


class TestResult(BaseModel):
    runner: str
    command: str
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    success: bool = False
    duration_seconds: float | None = None
    failures: list[TestFailure] = Field(default_factory=list)
    stdout: str = ""
    stderr: str = ""


class HealingIteration(BaseModel):
    iteration: int
    test_result: TestResult
    changes: list[FileChange] = Field(default_factory=list)
    fix_summary: str | None = None


class TaskRun(BaseModel):
    id: str
    repo_id: str
    task: str
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    workspace_path: str | None = None
    plan: ExecutionPlan | None = None
    changes: list[FileChange] = Field(default_factory=list)
    test_results: list[TestResult] = Field(default_factory=list)
    healing_iterations: list[HealingIteration] = Field(default_factory=list)
    error: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class TaskRequest(BaseModel):
    repo_id: str
    task: str
    llm: LLMConfig = Field(
        default_factory=lambda: LLMConfig(provider=LLMProvider.AUTO)
    )
    max_healing_iterations: int = 3
    run_tests: bool = True


class TaskResponse(BaseModel):
    task: TaskRun
