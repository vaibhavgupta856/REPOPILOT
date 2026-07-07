"""Run Cursor SDK in an isolated subprocess (Linux/macOS only)."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

_WORKER = Path(__file__).with_name("cursor_worker.py")
_DEFAULT_TIMEOUT = 300

_CURSOR_WINDOWS_MSG = (
    "Cursor API keys are not supported on Windows in RepoPilot — the Cursor SDK "
    "local bridge fails with a socket error on this platform. "
    "Use OpenRouter instead (paste an sk-or-v1-… key), or run RepoPilot on Linux/macOS for Cursor."
)


def run_cursor_prompt(
    *,
    api_key: str,
    model: str,
    workspace_path: str,
    system: str,
    user: str,
    timeout: int = _DEFAULT_TIMEOUT,
) -> str:
    if sys.platform == "win32":
        raise ValueError(_CURSOR_WINDOWS_MSG)

    payload = {
        "api_key": api_key,
        "model": model,
        "workspace_path": workspace_path,
        "system": system,
        "user": user,
    }
    backend_root = Path(__file__).resolve().parents[2]
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"

    try:
        proc = subprocess.run(
            [sys.executable, str(_WORKER)],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(backend_root),
            env=env,
        )
    except subprocess.TimeoutExpired as exc:
        raise ValueError(f"Cursor agent timed out after {timeout}s") from exc

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "Cursor subprocess failed").strip()
        if "Authentication" in err or "401" in err or "403" in err:
            raise ValueError(
                "Invalid Cursor API key. Create one at https://cursor.com/dashboard/integrations"
            )
        raise ValueError(err[:500])

    try:
        data = json.loads(proc.stdout.strip())
    except json.JSONDecodeError as exc:
        preview = (proc.stdout or proc.stderr or "")[:200]
        raise ValueError(f"Cursor returned invalid output: {preview!r}") from exc

    if data.get("status") == "error":
        raise ValueError(data.get("error") or "Cursor agent run failed.")

    text = (data.get("text") or "").strip()
    if not text:
        raise ValueError("Cursor returned an empty response.")
    return text
