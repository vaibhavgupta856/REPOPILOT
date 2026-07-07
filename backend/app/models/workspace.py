from pydantic import BaseModel, Field


class SaveFileRequest(BaseModel):
    content: str


class AcceptLinesRequest(BaseModel):
    path: str
    line_indices: list[int] = Field(default_factory=list)


class AcceptAllRequest(BaseModel):
    path: str


class WorkspaceFileInfo(BaseModel):
    path: str
    is_dir: bool = False
    action: str | None = None
    has_agent_change: bool = False


class WorkspaceFileDetail(BaseModel):
    path: str
    original: str
    current: str
    action: str | None = None
    changed_lines: list[int] = Field(default_factory=list)
    lines: list[str] = Field(default_factory=list)


class RepoFileListResponse(BaseModel):
    repo_id: str
    workspace_path: str
    files: list[WorkspaceFileInfo] = Field(default_factory=list)


class TerminalRequest(BaseModel):
    command: str
    cwd: str = "."


class TerminalResponse(BaseModel):
    stdout: str = ""
    stderr: str = ""
    exit_code: int = 0
    cwd: str = "."
    shell: str = "bash"
