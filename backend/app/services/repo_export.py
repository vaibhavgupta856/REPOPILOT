"""Export repository workspace as a zip archive."""

import io
import re
import zipfile
from pathlib import Path

SKIP_DIRS = {
    ".git",
    ".forge",
    ".forge_snapshot",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    ".pytest_cache",
    ".mypy_cache",
    ".idea",
    ".vscode",
}


def _safe_filename(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*]', "_", name.strip())
    return cleaned or "project"


def build_repo_zip(repo_root: Path, repo_name: str) -> tuple[bytes, str]:
    """Zip all project files under *repo_root*, excluding vendor/cache dirs."""
    repo_root = repo_root.resolve()
    if not repo_root.is_dir():
        raise FileNotFoundError(f"Repository path not found: {repo_root}")

    buffer = io.BytesIO()
    file_count = 0

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in repo_root.rglob("*"):
            if not file_path.is_file():
                continue
            if any(part in SKIP_DIRS for part in file_path.parts):
                continue
            arcname = str(file_path.relative_to(repo_root)).replace("\\", "/")
            zf.write(file_path, arcname)
            file_count += 1

    if file_count == 0:
        raise ValueError("No files to export in this repository")

    buffer.seek(0)
    filename = f"{_safe_filename(repo_name)}.zip"
    return buffer.getvalue(), filename
