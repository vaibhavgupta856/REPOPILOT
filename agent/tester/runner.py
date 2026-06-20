"""Test execution framework (Phase 6)."""

import re
import subprocess
import time
from pathlib import Path

from app.models.repository import RepositorySummary
from app.models.task import TestFailure, TestResult


RUNNERS: list[tuple[str, list[str], str]] = [
    ("pytest", ["pytest", "-v", "--tb=short"], "pytest"),
    ("unittest", ["python", "-m", "pytest", "-v", "--tb=short"], "pytest"),
    ("vitest", ["npx", "vitest", "run"], "vitest"),
    ("jest", ["npx", "jest", "--no-cache"], "jest"),
    ("npm test", ["npm", "test", "--", "--passWithNoTests"], "npm"),
    ("go test", ["go", "test", "./..."], "go"),
    ("cargo test", ["cargo", "test"], "cargo"),
]


def detect_runner(summary: RepositorySummary, workspace: Path) -> tuple[str, list[str]]:
    """Pick test command based on repository map and manifest files."""
    test_runner = (summary.map.test_runner or "").lower()

    if "pytest" in test_runner or (workspace / "pytest.ini").exists() or list(workspace.rglob("test_*.py")):
        return "pytest", ["pytest", "-v", "--tb=short", "-q"]

    if "vitest" in test_runner:
        return "vitest", ["npx", "vitest", "run"]

    if "jest" in test_runner:
        return "jest", ["npx", "jest", "--no-cache"]

    if (workspace / "package.json").exists():
        return "npm", ["npm", "test", "--", "--passWithNoTests"]

    if (workspace / "go.mod").exists():
        return "go test", ["go", "test", "./..."]

    if (workspace / "Cargo.toml").exists():
        return "cargo test", ["cargo", "test"]

    if list(workspace.rglob("test_*.py")) or list(workspace.rglob("*_test.py")):
        return "pytest", ["pytest", "-v", "--tb=short", "-q"]

    return "none", []


def _parse_pytest_output(stdout: str, stderr: str) -> tuple[int, int, int, list[TestFailure]]:
    combined = stdout + "\n" + stderr
    failures: list[TestFailure] = []

    # tests/test_auth.py::test_login FAILED - message
    for m in re.finditer(
        r"(\S+::\S+)\s+FAILED\s*-?\s*(.*?)(?=\n\S+::\S+\s+FAILED|\n=+|\Z)",
        combined,
        re.DOTALL,
    ):
        full, msg = m.group(1), m.group(2).strip()[:500]
        parts = full.rsplit("::", 1)
        path = parts[0] if len(parts) == 2 else None
        name = parts[1] if len(parts) == 2 else full
        failures.append(TestFailure(test_name=name, file=path, message=msg, raw=m.group(0)[:800]))

    # FAILED path::name (alternate pytest format)
    for m in re.finditer(
        r"FAILED\s+(\S+::\S+)\s*-?\s*(.*?)(?=\nFAILED|\n=+|\Z)",
        combined,
        re.DOTALL,
    ):
        full, msg = m.group(1), m.group(2).strip()[:500]
        parts = full.rsplit("::", 1)
        path = parts[0] if len(parts) == 2 else None
        name = parts[1] if len(parts) == 2 else full
        if not any(f.test_name == name for f in failures):
            failures.append(TestFailure(test_name=name, file=path, message=msg, raw=m.group(0)[:800]))

    # ERROR collecting
    for m in re.finditer(r"ERROR collecting (\S+)\s*(.*?)(?=\n=+|\Z)", combined, re.DOTALL):
        failures.append(
            TestFailure(
                test_name="collection_error",
                file=m.group(1),
                message=m.group(2).strip()[:500],
                raw=m.group(0)[:800],
            )
        )

    passed = failed = skipped = 0
    summary_match = re.search(r"(\d+)\s+passed", combined)
    if summary_match:
        passed = int(summary_match.group(1))
    fail_match = re.search(r"(\d+)\s+failed", combined)
    if fail_match:
        failed = int(fail_match.group(1))
    skip_match = re.search(r"(\d+)\s+skipped", combined)
    if skip_match:
        skipped = int(skip_match.group(1))

    if not failures and failed > 0:
        failures.append(TestFailure(test_name="unknown", message=combined[-1500:]))

    return passed, failed, skipped, failures


def _parse_generic_output(stdout: str, stderr: str) -> tuple[int, int, int, list[TestFailure]]:
    combined = stdout + "\n" + stderr
    failures: list[TestFailure] = []

    if re.search(r"\bFAIL\b|✕|failed|AssertionError|Error:", combined, re.IGNORECASE):
        failures.append(TestFailure(test_name="test_failure", message=combined[-2000:]))

    passed = 1 if re.search(r"\bPASS\b|passed|✓|ok\b", combined, re.IGNORECASE) and not failures else 0
    failed = len(failures) if failures else (0 if passed else (1 if combined.strip() else 0))
    return passed, failed, 0, failures


def run_tests(workspace: Path, summary: RepositorySummary, timeout: int = 120) -> TestResult:
    runner_name, command = detect_runner(summary, workspace)

    if not command:
        return TestResult(
            runner="none",
            command="",
            success=True,
            stdout="No test runner detected — skipped",
        )

    start = time.time()
    try:
        proc = subprocess.run(
            command,
            cwd=workspace,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=False,
        )
        stdout, stderr = proc.stdout or "", proc.stderr or ""
        exit_code = proc.returncode
    except subprocess.TimeoutExpired as exc:
        stdout = (exc.stdout or "") if isinstance(exc.stdout, str) else ""
        stderr = (exc.stderr or "") if isinstance(exc.stderr, str) else ""
        return TestResult(
            runner=runner_name,
            command=" ".join(command),
            success=False,
            duration_seconds=timeout,
            failures=[TestFailure(test_name="timeout", message=f"Tests timed out after {timeout}s")],
            stdout=stdout,
            stderr=stderr,
        )
    except FileNotFoundError:
        return TestResult(
            runner=runner_name,
            command=" ".join(command),
            success=False,
            failures=[
                TestFailure(
                    test_name="runner_not_found",
                    message=f"Test runner not installed: {command[0]}",
                )
            ],
        )

    duration = time.time() - start

    if "pytest" in runner_name:
        passed, failed, skipped, failures = _parse_pytest_output(stdout, stderr)
    else:
        passed, failed, skipped, failures = _parse_generic_output(stdout, stderr)
        if exit_code != 0 and not failures:
            failures = [TestFailure(test_name="exit_code", message=f"Exit code {exit_code}\n{stderr[-1000:]}")]
            failed = max(failed, 1)

    success = exit_code == 0 and failed == 0 and not failures

    return TestResult(
        runner=runner_name,
        command=" ".join(command),
        passed=passed,
        failed=failed,
        skipped=skipped,
        success=success,
        duration_seconds=round(duration, 2),
        failures=failures,
        stdout=stdout[-8000:],
        stderr=stderr[-4000:],
    )


def format_failures_for_llm(result: TestResult) -> str:
  lines = [f"Command: {result.command}", f"Runner: {result.runner}", ""]
  for f in result.failures:
      lines.append(f"--- {f.test_name} ---")
      if f.file:
          lines.append(f"File: {f.file}")
      lines.append(f.message)
      lines.append("")
  if result.stderr:
      lines.append("STDERR (tail):")
      lines.append(result.stderr[-2000:])
  return "\n".join(lines)
