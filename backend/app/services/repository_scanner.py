"""Orchestrates repository cloning, scanning, and summary persistence."""

import json
import re
import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.db.models import RepositoryRecord
from app.models.repository import (
    RepositoryMap,
    RepositorySource,
    RepositorySummary,
    ScanRequest,
    ScanResponse,
)
from app.services.architecture_summary import generate_architecture_summary
from app.services.dependency_graph import build_dependency_graph
from app.services.framework_detector import detect_frameworks
from app.services.language_detector import detect_languages, primary_language, should_skip
from app.services.repo_workspace import repo_root_dir
from app.services.demo_workspace import DEMO_WORKSPACE_NAME, copy_demo_template


def _count_files_and_lines(root: Path) -> tuple[int, int]:
    root = root.resolve()
    file_count = 0
    total_lines = 0
    for file_path in root.rglob("*"):
        if not file_path.is_file() or should_skip(file_path, root):
            continue
        file_count += 1
        try:
            total_lines += sum(1 for _ in file_path.open(encoding="utf-8", errors="ignore"))
        except OSError:
            pass
    return file_count, total_lines


def _resolve_repo_path(
    request: ScanRequest, user_id: str, repo_id: str
) -> tuple[Path, str, RepositorySource]:
    from app.services.repo_workspace import resolve_scan_path

    return resolve_scan_path(request, user_id, repo_id)


def _build_repository_map(root: Path) -> RepositoryMap:
    languages = detect_languages(root)
    fw, all_fw, database, test_runner, package_manager, build_tool = detect_frameworks(root)

    return RepositoryMap(
        language=primary_language(languages),
        languages=languages,
        framework=fw,
        frameworks=all_fw,
        database=database,
        test_runner=test_runner,
        package_manager=package_manager,
        build_tool=build_tool,
    )


def record_to_summary(record: RepositoryRecord) -> RepositorySummary:
    data = json.loads(record.summary_json)
    return RepositorySummary.model_validate(data)


def _sanitize_workspace_name(name: str) -> str:
    text = name.strip()
    if not text:
        raise ValueError("Workspace name is required")
    safe = re.sub(r"[^\w\- ]", "", text, flags=re.UNICODE).strip().replace(" ", "-")
    if not safe:
        raise ValueError("Workspace name must contain letters or numbers")
    return safe[:64]


def _persist_repository(
    db: Session,
    user_id: str,
    repo_id: str,
    root: Path,
    name: str,
    source: RepositorySource,
) -> ScanResponse:
    repo_map = _build_repository_map(root)
    architecture = generate_architecture_summary(root, repo_map)
    dependency_graph = build_dependency_graph(root)
    file_count, total_lines = _count_files_and_lines(root)

    summary = RepositorySummary(
        id=repo_id,
        name=name,
        source=source,
        path=str(root),
        scanned_at=datetime.utcnow(),
        map=repo_map,
        architecture=architecture,
        dependency_graph=dependency_graph,
        file_count=file_count,
        total_lines=total_lines,
    )

    record = RepositoryRecord(
        id=repo_id,
        user_id=user_id,
        name=name,
        source=source.value if hasattr(source, "value") else str(source),
        path=str(root),
        summary_json=json.dumps(summary.model_dump(mode="json")),
        scanned_at=summary.scanned_at,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return ScanResponse(summary=summary, summary_path=f"db://repositories/{repo_id}")


def create_workspace(db: Session, user_id: str, name: str) -> ScanResponse:
    repo_id = uuid.uuid4().hex[:12]
    clean_name = _sanitize_workspace_name(name)
    dest = repo_root_dir(user_id, repo_id)
    dest.mkdir(parents=True, exist_ok=True)
    readme = dest / "README.md"
    if not readme.exists():
        readme.write_text(
            f"# {clean_name}\n\nBlank workspace created with RepoPilot.\n",
            encoding="utf-8",
        )
    return _persist_repository(db, user_id, repo_id, dest, clean_name, RepositorySource.WORKSPACE)


def create_demo_workspace(db: Session, user_id: str) -> ScanResponse:
    repo_id = uuid.uuid4().hex[:12]
    dest = repo_root_dir(user_id, repo_id)
    copy_demo_template(dest)
    return _persist_repository(
        db, user_id, repo_id, dest, DEMO_WORKSPACE_NAME, RepositorySource.WORKSPACE
    )


def scan_repository(db: Session, user_id: str, request: ScanRequest) -> ScanResponse:
    repo_id = uuid.uuid4().hex[:12]
    root, name, source = _resolve_repo_path(request, user_id, repo_id)
    return _persist_repository(db, user_id, repo_id, root, name, source)


def load_summary(db: Session, user_id: str, repo_id: str) -> RepositorySummary | None:
    record = (
        db.query(RepositoryRecord)
        .filter(RepositoryRecord.id == repo_id, RepositoryRecord.user_id == user_id)
        .first()
    )
    if not record:
        return None
    return record_to_summary(record)


def list_summaries(db: Session, user_id: str) -> list[RepositorySummary]:
    records = (
        db.query(RepositoryRecord)
        .filter(RepositoryRecord.user_id == user_id)
        .order_by(RepositoryRecord.scanned_at.desc())
        .all()
    )
    return [record_to_summary(r) for r in records]
