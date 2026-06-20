"""Planner agent — converts tasks into engineering plans (Phase 3)."""

import json
from pathlib import Path

from app.models.repository import RepositorySummary
from app.models.task import ExecutionPlan, PlanStep
from app.services.llm import LLMConfig, llm_complete_json
from app.services.workspace import list_source_files


def _fallback_plan(task: str, file_list: list[str]) -> ExecutionPlan:
    """Simple plan when the LLM fails (common with small local models)."""
    py_files = [f for f in file_list if f.endswith(".py")]
    target = "utils.py" if "utils.py" not in py_files else "utils.py"
    test_file = "test_utils.py"
    return ExecutionPlan(
        task=task,
        files=[target, test_file],
        steps=[
            PlanStep(description=task, files=[target, test_file]),
        ],
        reasoning="Automatic fallback plan because the LLM did not return valid JSON.",
    )


def _build_repo_context(summary: RepositorySummary, workspace: Path, max_files: int = 15) -> str:
    arch = summary.architecture
    dep_entries = summary.dependency_graph.entry_points[:5]
    dep_nodes = summary.dependency_graph.nodes[:10]

    file_list = list_source_files(workspace)[:max_files]

    return json.dumps(
        {
            "repository": {
                "name": summary.name,
                "language": summary.map.language,
                "framework": summary.map.framework,
                "test_runner": summary.map.test_runner,
            },
            "architecture": {
                "backend": arch.backend,
                "tests": arch.tests,
            },
            "entry_points": dep_entries,
            "dependency_sample": [n.model_dump() for n in dep_nodes[:8]],
            "available_files": file_list,
        },
        indent=2,
    )


PLANNER_SYSTEM = """You are a senior software architect. Create an implementation plan for the given task.
You NEVER write code — only plan.

CRITICAL: Respond with ONLY a JSON object. No Python, no markdown, no prose outside JSON.

Return JSON with this exact structure:
{
  "reasoning": "brief analysis of approach",
  "files": ["relative/path/file.py", ...],
  "steps": [
    {"description": "what to do", "files": ["files touched in this step"]}
  ]
}

Rules:
- List only files that exist or must be created (use paths from available_files when modifying)
- Steps must be ordered and actionable
- Include test files in the plan when appropriate
- Be specific to the repository's stack"""


def create_plan(
    task: str,
    summary: RepositorySummary,
    workspace: Path,
    llm: LLMConfig,
) -> ExecutionPlan:
    context = _build_repo_context(summary, workspace)
    user = f"Task: {task}\n\nRepository context:\n{context}"
    file_list = list_source_files(workspace)

    try:
        data = llm_complete_json(llm, PLANNER_SYSTEM, user)

        if isinstance(data, dict) and "error" in data:
            raise ValueError(f"LLM request failed: {data.get('error', data)}")

        steps = [
            PlanStep(description=s.get("description", ""), files=s.get("files", []))
            for s in data.get("steps", [])
            if isinstance(s, dict)
        ]

        plan = ExecutionPlan(
            task=task,
            files=data.get("files", []),
            steps=steps,
            reasoning=data.get("reasoning"),
        )
        if not plan.steps and not plan.files:
            return _fallback_plan(task, file_list)
        return plan
    except ValueError:
        return _fallback_plan(task, file_list)
