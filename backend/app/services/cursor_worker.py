"""Subprocess worker — reads JSON from stdin, prints JSON result to stdout."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from cursor_sdk import Agent, AgentOptions, LocalAgentOptions


def main() -> None:
    data = json.loads(sys.stdin.read())
    prompt = (
        f"{data['system']}\n\n---\n\n{data['user']}\n\n"
        "Reply with valid JSON only (no markdown fences)."
    )
    try:
        result = Agent.prompt(
            prompt,
            AgentOptions(
                api_key=data["api_key"],
                model=data["model"],
                local=LocalAgentOptions(
                    cwd=str(Path(data["workspace_path"]).resolve()),
                ),
            ),
        )
        text = getattr(result, "result", None) or ""
        status = getattr(result, "status", None) or "completed"
        print(json.dumps({"status": status, "text": text}))
    except Exception as exc:
        print(json.dumps({"status": "error", "error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
