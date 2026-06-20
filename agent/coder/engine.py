"""Code agent — generates and applies code modifications (Phase 4)."""

import json
from pathlib import Path

from app.models.task import ExecutionPlan, FileChange
from app.models.repository import RepositorySummary
from app.services.llm import LLMConfig, llm_complete_json
from app.services.workspace import read_files


CODER_SYSTEM = """You are an expert software engineer. Implement the task by producing file changes.

Return JSON with this exact structure:
{
  "summary": "brief description of changes",
  "changes": [
    {
      "path": "relative/path/from/repo/root.py",
      "action": "create|modify|delete",
      "content": "full file content (required for create/modify, omit for delete)"
    }
  ]
}

Rules:
- Return COMPLETE file contents for create/modify (not diffs)
- Use only relative paths with forward slashes
- Match existing code style and conventions
- Include necessary imports
- Add or update tests when the plan requires it
- Do not include markdown fences in content fields"""


def _gather_coding_context(
    workspace: Path,
    plan: ExecutionPlan,
    summary: RepositorySummary,
    extra_files: list[str] | None = None,
) -> str:
    files_to_read = list(dict.fromkeys(plan.files + (extra_files or [])))
    # Always include entry points for context
    files_to_read.extend(summary.dependency_graph.entry_points[:5])
    files_to_read = list(dict.fromkeys(files_to_read))[:20]

    contents = read_files(workspace, files_to_read)
    return json.dumps(
        {
            "stack": {
                "language": summary.map.language,
                "framework": summary.map.framework,
                "tests": summary.map.test_runner,
            },
            "plan": plan.model_dump(),
            "existing_files": contents,
        },
        indent=2,
    )


def generate_changes(
    task: str,
    plan: ExecutionPlan,
    summary: RepositorySummary,
    workspace: Path,
    llm: LLMConfig,
    *,
    failure_context: str | None = None,
) -> tuple[list[FileChange], str | None]:
    context = _gather_coding_context(workspace, plan, summary)
    user = f"Task: {task}\n\nContext:\n{context}"
    if failure_context:
        user += f"\n\nPrevious test failures — fix these:\n{failure_context}"

    data = llm_complete_json(llm, CODER_SYSTEM, user)

    changes: list[FileChange] = []
    for item in data.get("changes", []):
        if not isinstance(item, dict) or not item.get("path"):
            continue
        changes.append(
            FileChange(
                path=item["path"].replace("\\", "/"),
                action=item.get("action", "modify"),
                content=item.get("content"),
            )
        )

    return changes, data.get("summary")


def generate_fix(
    task: str,
    plan: ExecutionPlan,
    summary: RepositorySummary,
    workspace: Path,
    llm: LLMConfig,
    failures_text: str,
    changed_files: list[str],
) -> tuple[list[FileChange], str | None]:
    return generate_changes(
        task,
        plan,
        summary,
        workspace,
        llm,
        failure_context=failures_text,
    )
