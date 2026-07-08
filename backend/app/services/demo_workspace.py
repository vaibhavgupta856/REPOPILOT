"""Copy the bundled demo workspace template into a user repo folder."""

import shutil
from pathlib import Path

_TEMPLATE_ROOT = Path(__file__).resolve().parents[2] / "demo_workspace_template"

DEMO_WORKSPACE_NAME = "RepoPilot-Demo"


def demo_template_path() -> Path:
    return _TEMPLATE_ROOT


def copy_demo_template(dest: Path) -> None:
    if not _TEMPLATE_ROOT.is_dir():
        raise FileNotFoundError(f"Demo template missing at {_TEMPLATE_ROOT}")
    dest.mkdir(parents=True, exist_ok=True)
    for item in _TEMPLATE_ROOT.iterdir():
        target = dest / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        else:
            shutil.copy2(item, target)
