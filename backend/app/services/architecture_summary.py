"""Generate human-readable architecture summary from scan results."""

from pathlib import Path

from app.models.repository import ArchitectureSummary, RepositoryMap
from app.services.framework_detector import detect_authentication


def _infer_frontend(frameworks: list[str]) -> str | None:
    frontend_fws = {"React", "Vue", "Svelte", "Angular", "Next.js", "Nuxt"}
    found = [f for f in frameworks if f in frontend_fws]
    return found[0] if found else None


def _infer_backend(frameworks: list[str], language: str | None) -> str | None:
    backend_fws = {"FastAPI", "Flask", "Django", "Express", "Spring Boot", "Gin", "Actix", "Starlette"}
    found = [f for f in frameworks if f in backend_fws]
    if found:
        return found[0]
    if language:
        return f"{language} application"
    return None


def _collect_highlights(root: Path, repo_map: RepositoryMap) -> list[str]:
    highlights: list[str] = []

    if (root / "docker-compose.yml").exists() or (root / "docker-compose.yaml").exists():
        highlights.append("Docker Compose configuration detected")
    if (root / "Dockerfile").exists():
        highlights.append("Containerized with Dockerfile")
    if (root / ".github" / "workflows").is_dir():
        highlights.append("CI/CD via GitHub Actions")
    if (root / "alembic").is_dir() or (root / "migrations").is_dir():
        highlights.append("Database migrations present")
    if repo_map.test_runner:
        highlights.append(f"Test suite: {repo_map.test_runner}")

    api_dirs = [p for p in root.rglob("*") if p.is_dir() and p.name in ("api", "routes", "controllers")]
    if api_dirs:
        highlights.append(f"API layer in {len(api_dirs)} location(s)")

    return highlights[:8]


def generate_architecture_summary(root: Path, repo_map: RepositoryMap) -> ArchitectureSummary:
    auth = detect_authentication(root)
    frontend = _infer_frontend(repo_map.frameworks)
    backend = _infer_backend(repo_map.frameworks, repo_map.language)

    deployment: str | None = None
    if (root / "Dockerfile").exists():
        deployment = "Docker"
    elif (root / "vercel.json").exists():
        deployment = "Vercel"
    elif (root / "netlify.toml").exists():
        deployment = "Netlify"
    elif (root / "kubernetes").is_dir() or (root / "k8s").is_dir():
        deployment = "Kubernetes"

    return ArchitectureSummary(
        backend=backend,
        frontend=frontend,
        database=repo_map.database,
        authentication=auth,
        tests=repo_map.test_runner,
        deployment=deployment,
        highlights=_collect_highlights(root, repo_map),
    )
