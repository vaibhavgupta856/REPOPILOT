from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.session import get_db
from app.deps import get_current_user, get_repo_for_user
from app.models.repository import RepositorySummary, ScanRequest, ScanResponse
from app.models.workspace import (
    AcceptAllRequest,
    AcceptLinesRequest,
    RepoFileListResponse,
    SaveFileRequest,
    TerminalRequest,
    TerminalResponse,
    WorkspaceFileDetail,
)
from app.services.repo_export import build_repo_zip
from app.services.repo_workspace import (
    accept_file_baseline,
    get_repo_root,
    load_pending_changes,
)
from app.services.repository_scanner import (
    list_summaries,
    load_summary,
    record_to_summary,
    scan_repository,
)
from app.services.terminal_runner import run_command
from app.services.workspace_files import (
    build_file_detail,
    build_file_list_for_repo,
    load_accepted_lines,
    save_accepted_lines,
    write_workspace_file,
)

router = APIRouter(prefix="/repositories", tags=["repositories"])


@router.post("/scan", response_model=ScanResponse)
async def scan_repo(
    request: ScanRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScanResponse:
    try:
        return scan_repository(db, user.id, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scan failed: {exc}") from exc


@router.get("", response_model=list[RepositorySummary])
async def get_repositories(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RepositorySummary]:
    return list_summaries(db, user.id)


@router.get("/{repo_id}", response_model=RepositorySummary)
async def get_repository(
    record=Depends(get_repo_for_user),
) -> RepositorySummary:
    return record_to_summary(record)


@router.get("/{repo_id}/files", response_model=RepoFileListResponse)
async def list_repo_files(
    record=Depends(get_repo_for_user),
    user: User = Depends(get_current_user),
) -> RepoFileListResponse:
    summary = record_to_summary(record)
    workspace = get_repo_root(summary.path)
    pending = load_pending_changes(user.id, record.id)
    return RepoFileListResponse(
        repo_id=record.id,
        workspace_path=str(workspace),
        files=build_file_list_for_repo(user.id, record.id, workspace, pending),
    )


@router.get("/{repo_id}/file", response_model=WorkspaceFileDetail)
async def get_repo_file(
    path: str = Query(...),
    record=Depends(get_repo_for_user),
    user: User = Depends(get_current_user),
) -> WorkspaceFileDetail:
    summary = record_to_summary(record)
    workspace = get_repo_root(summary.path)
    pending = load_pending_changes(user.id, record.id)
    try:
        return build_file_detail(user.id, record.id, workspace, path, pending)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/{repo_id}/file")
async def save_repo_file(
    path: str = Query(...),
    body: SaveFileRequest = Body(...),
    record=Depends(get_repo_for_user),
) -> dict:
    summary = record_to_summary(record)
    workspace = get_repo_root(summary.path)
    try:
        write_workspace_file(workspace, path, body.content)
        return {"ok": True, "path": path}
    except (FileNotFoundError, PermissionError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{repo_id}/accepted")
async def get_accepted_lines(
    record=Depends(get_repo_for_user),
    user: User = Depends(get_current_user),
) -> dict[str, list[int]]:
    return load_accepted_lines(user.id, record.id)


@router.post("/{repo_id}/accept-lines")
async def accept_lines(
    body: AcceptLinesRequest,
    record=Depends(get_repo_for_user),
    user: User = Depends(get_current_user),
) -> dict[str, list[int]]:
    accepted = load_accepted_lines(user.id, record.id)
    existing = set(accepted.get(body.path, []))
    existing.update(body.line_indices)
    accepted[body.path] = sorted(existing)
    save_accepted_lines(user.id, record.id, accepted)
    return accepted


@router.post("/{repo_id}/accept-all")
async def accept_all_lines(
    body: AcceptAllRequest,
    record=Depends(get_repo_for_user),
    user: User = Depends(get_current_user),
) -> dict[str, list[int]]:
    summary = record_to_summary(record)
    workspace = get_repo_root(summary.path)
    pending = load_pending_changes(user.id, record.id)
    detail = build_file_detail(user.id, record.id, workspace, body.path, pending)
    accepted = load_accepted_lines(user.id, record.id)
    accepted[body.path] = detail.changed_lines
    save_accepted_lines(user.id, record.id, accepted)
    accept_file_baseline(user.id, record.id, body.path, workspace)
    return accepted


@router.post("/{repo_id}/terminal", response_model=TerminalResponse)
async def run_repo_terminal(
    body: TerminalRequest,
    record=Depends(get_repo_for_user),
) -> TerminalResponse:
    summary = record_to_summary(record)
    workspace = get_repo_root(summary.path)
    try:
        result = run_command(workspace, body.command, body.cwd)
        return TerminalResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Terminal error: {exc}") from exc


@router.get("/{repo_id}/download")
async def download_repo_zip(
    record=Depends(get_repo_for_user),
) -> Response:
    summary = record_to_summary(record)
    workspace = get_repo_root(summary.path)
    try:
        data, filename = build_repo_zip(workspace, summary.name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
