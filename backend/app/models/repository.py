from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class RepositorySource(str, Enum):
    GITHUB = "github"


class RepositoryMap(BaseModel):
    language: str | None = None
    languages: dict[str, int] = Field(default_factory=dict)
    framework: str | None = None
    frameworks: list[str] = Field(default_factory=list)
    database: str | None = None
    test_runner: str | None = None
    package_manager: str | None = None
    build_tool: str | None = None


class ArchitectureSummary(BaseModel):
    backend: str | None = None
    frontend: str | None = None
    database: str | None = None
    authentication: str | None = None
    tests: str | None = None
    deployment: str | None = None
    highlights: list[str] = Field(default_factory=list)


class DependencyNode(BaseModel):
    path: str
    imports: list[str] = Field(default_factory=list)
    imported_by: list[str] = Field(default_factory=list)


class DependencyGraph(BaseModel):
    nodes: list[DependencyNode] = Field(default_factory=list)
    entry_points: list[str] = Field(default_factory=list)


class RepositorySummary(BaseModel):
    id: str
    name: str
    source: RepositorySource
    path: str
    scanned_at: datetime = Field(default_factory=datetime.utcnow)
    map: RepositoryMap
    architecture: ArchitectureSummary
    dependency_graph: DependencyGraph
    file_count: int = 0
    total_lines: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)


class ScanRequest(BaseModel):
    github_url: str


class ScanResponse(BaseModel):
    summary: RepositorySummary
    summary_path: str
