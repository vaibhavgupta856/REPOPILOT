"""Self-healing retry loop (Phase 7)."""

from pathlib import Path

from agent.coder.engine import generate_changes, generate_fix
from agent.tester.runner import format_failures_for_llm, run_tests
from app.models.repository import RepositorySummary
from app.models.task import ExecutionPlan, FileChange, HealingIteration, TestResult
from app.services.llm import LLMConfig
from app.services.workspace import apply_changes


def run_healing_loop(
    task: str,
    plan: ExecutionPlan,
    summary: RepositorySummary,
    workspace: Path,
    llm: LLMConfig,
    initial_changes: list[FileChange],
    *,
    max_iterations: int = 3,
) -> tuple[list[FileChange], list[TestResult], list[HealingIteration]]:
    """
    Write code → run tests → read failures → generate fix → re-run tests.
    Maximum *max_iterations* healing attempts after initial test failure.
    """
    all_changes = list(initial_changes)
    test_results: list[TestResult] = []
    healing_log: list[HealingIteration] = []

    apply_changes(workspace, initial_changes)
    result = run_tests(workspace, summary)
    test_results.append(result)

    if result.success:
        return all_changes, test_results, healing_log

    for i in range(1, max_iterations + 1):
        failures_text = format_failures_for_llm(result)
        fix_changes, fix_summary = generate_fix(
            task,
            plan,
            summary,
            workspace,
            llm,
            failures_text,
            [c.path for c in all_changes],
        )

        if not fix_changes:
            healing_log.append(
                HealingIteration(iteration=i, test_result=result, fix_summary="No fix generated")
            )
            break

        apply_changes(workspace, fix_changes)
        all_changes.extend(fix_changes)

        result = run_tests(workspace, summary)
        test_results.append(result)

        healing_log.append(
            HealingIteration(
                iteration=i,
                test_result=result,
                changes=fix_changes,
                fix_summary=fix_summary,
            )
        )

        if result.success:
            break

    return all_changes, test_results, healing_log
