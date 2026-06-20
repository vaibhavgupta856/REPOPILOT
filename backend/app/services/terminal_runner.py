"""Run shell commands inside a user's repository workspace."""

import os
import subprocess
import sys
from pathlib import Path


def shell_name() -> str:
    return "powershell" if sys.platform == "win32" else "bash"


def _is_within_root(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def _normalize_cwd(repo_root: Path, cwd_rel: str) -> Path:
    rel = (cwd_rel or ".").replace("\\", "/").strip() or "."
    candidate = (repo_root / rel).resolve()
    if not _is_within_root(candidate, repo_root):
        raise ValueError("Working directory must stay inside the repository")
    if not candidate.is_dir():
        raise ValueError(f"Directory not found: {cwd_rel}")
    return candidate


def _relative_cwd(repo_root: Path, cwd: Path) -> str:
    rel = cwd.resolve().relative_to(repo_root.resolve())
    text = str(rel).replace("\\", "/")
    return text if text else "."


def _handle_cd(repo_root: Path, cwd: Path, command: str) -> tuple[str, str, int, Path]:
    parts = command.strip().split(maxsplit=1)
    target = parts[1] if len(parts) > 1 else "."
    if target == "-":
        raise ValueError("cd - is not supported in this terminal")
    new_cwd = (cwd / target).resolve()
    if not _is_within_root(new_cwd, repo_root):
        return "", "cd: permission denied (outside repository)\n", 1, cwd
    if not new_cwd.is_dir():
        return "", f"cd: no such directory: {target}\n", 1, cwd
    return "", "", 0, new_cwd


def _exec_command(command: str, cwd: Path, timeout: int, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    if sys.platform == "win32":
        return subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                command,
            ],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
            encoding="utf-8",
            errors="replace",
        )
    return subprocess.run(
        command,
        shell=True,
        executable="/bin/bash",
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
    )


def run_command(
    repo_root: Path,
    command: str,
    cwd_rel: str = ".",
    *,
    timeout: int = 120,
) -> dict[str, str | int]:
    repo_root = repo_root.resolve()
    if not repo_root.is_dir():
        raise ValueError("Repository workspace not found")

    command = command.strip()
    cwd = _normalize_cwd(repo_root, cwd_rel)

    if not command:
        return {
            "stdout": "",
            "stderr": "",
            "exit_code": 0,
            "cwd": _relative_cwd(repo_root, cwd),
            "shell": shell_name(),
        }

    lower = command.lower()
    if lower == "cd" or lower.startswith("cd "):
        stdout, stderr, code, new_cwd = _handle_cd(repo_root, cwd, command)
        return {
            "stdout": stdout,
            "stderr": stderr,
            "exit_code": code,
            "cwd": _relative_cwd(repo_root, new_cwd),
            "shell": shell_name(),
        }

    if len(command) > 4000:
        raise ValueError("Command too long")

    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}

    try:
        result = _exec_command(command, cwd, timeout, env)
    except subprocess.TimeoutExpired:
        return {
            "stdout": "",
            "stderr": f"Command timed out after {timeout}s\n",
            "exit_code": 124,
            "cwd": _relative_cwd(repo_root, cwd),
            "shell": shell_name(),
        }
    except FileNotFoundError:
        return {
            "stdout": "",
            "stderr": f"Shell not found ({shell_name()}). Restart the backend on this machine.\n",
            "exit_code": 127,
            "cwd": _relative_cwd(repo_root, cwd),
            "shell": shell_name(),
        }

    stdout = result.stdout or ""
    stderr = result.stderr or ""
    max_chars = 100_000
    if len(stdout) > max_chars:
        stdout = stdout[:max_chars] + "\n… (output truncated)\n"
    if len(stderr) > max_chars:
        stderr = stderr[:max_chars] + "\n… (output truncated)\n"

    return {
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": result.returncode,
        "cwd": _relative_cwd(repo_root, cwd),
        "shell": shell_name(),
    }
