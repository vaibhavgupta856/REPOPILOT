"""Framework and tooling detection from manifest files and dependencies."""

from pathlib import Path

MANIFEST_SIGNALS: list[tuple[str, str, str]] = [
    # (filename, signal_type, label)
    ("requirements.txt", "python", "pip"),
    ("pyproject.toml", "python", "poetry/uv"),
    ("Pipfile", "python", "pipenv"),
    ("setup.py", "python", "setuptools"),
    ("package.json", "node", "npm"),
    ("pnpm-lock.yaml", "node", "pnpm"),
    ("yarn.lock", "node", "yarn"),
    ("bun.lockb", "node", "bun"),
    ("go.mod", "go", "go modules"),
    ("Cargo.toml", "rust", "cargo"),
    ("pom.xml", "java", "maven"),
    ("build.gradle", "java", "gradle"),
    ("build.gradle.kts", "java", "gradle"),
    ("Gemfile", "ruby", "bundler"),
    ("composer.json", "php", "composer"),
    ("mix.exs", "elixir", "mix"),
]

FRAMEWORK_PATTERNS: list[tuple[str, str]] = [
    # (search_in_file_content, framework_name)
    ("fastapi", "FastAPI"),
    ("from flask", "Flask"),
    ("django", "Django"),
    ("starlette", "Starlette"),
    ("from express", "Express"),
    ("next", "Next.js"),
    ("nuxt", "Nuxt"),
    ("@angular/core", "Angular"),
    ("react", "React"),
    ("vue", "Vue"),
    ("svelte", "Svelte"),
    ("spring-boot", "Spring Boot"),
    ("gin-gonic", "Gin"),
    ("echo", "Echo"),
    ("actix-web", "Actix"),
    ("rails", "Ruby on Rails"),
    ("laravel", "Laravel"),
    ("symfony", "Symfony"),
]

DATABASE_PATTERNS: list[tuple[str, str]] = [
    ("postgresql", "PostgreSQL"),
    ("psycopg", "PostgreSQL"),
    ("asyncpg", "PostgreSQL"),
    ("mysql", "MySQL"),
    ("pymysql", "MySQL"),
    ("sqlite", "SQLite"),
    ("sqlalchemy", "SQLAlchemy"),
    ("mongodb", "MongoDB"),
    ("pymongo", "MongoDB"),
    ("redis", "Redis"),
    ("prisma", "Prisma"),
    ("typeorm", "TypeORM"),
    ("sequelize", "Sequelize"),
    ("drizzle", "Drizzle"),
]

TEST_PATTERNS: list[tuple[str, str]] = [
    ("pytest", "pytest"),
    ("unittest", "unittest"),
    ("vitest", "vitest"),
    ("jest", "jest"),
    ("mocha", "mocha"),
    ("@testing-library", "Testing Library"),
    ("go test", "go test"),
    ("cargo test", "cargo test"),
    ("rspec", "RSpec"),
    ("phpunit", "PHPUnit"),
]

BUILD_PATTERNS: list[tuple[str, str]] = [
    ("vite", "Vite"),
    ("webpack", "Webpack"),
    ("esbuild", "esbuild"),
    ("rollup", "Rollup"),
    ("turbopack", "Turbopack"),
    ("docker", "Docker"),
    ("docker-compose", "Docker Compose"),
    ("kubernetes", "Kubernetes"),
    ("helm", "Helm"),
]


def _read_text_safe(path: Path, max_bytes: int = 64_000) -> str:
    try:
        data = path.read_bytes()[:max_bytes]
        return data.decode("utf-8", errors="ignore").lower()
    except OSError:
        return ""


def _scan_manifests(root: Path) -> tuple[str | None, list[str]]:
    package_manager: str | None = None
    frameworks: list[str] = []

    for file_name, _kind, pm_label in MANIFEST_SIGNALS:
        manifest = root / file_name
        if manifest.is_file():
            if package_manager is None:
                package_manager = pm_label
            content = _read_text_safe(manifest)
            for pattern, fw in FRAMEWORK_PATTERNS:
                if pattern in content and fw not in frameworks:
                    frameworks.append(fw)

    return package_manager, frameworks


def _scan_tree_for_patterns(root: Path, patterns: list[tuple[str, str]], limit: int = 200) -> str | None:
    checked = 0
    for file_path in root.rglob("*"):
        if checked >= limit:
            break
        if not file_path.is_file() or file_path.suffix.lower() not in {
            ".py", ".js", ".ts", ".tsx", ".go", ".rs", ".java", ".rb", ".php", ".toml", ".json", ".yaml", ".yml"
        }:
            continue
        checked += 1
        content = _read_text_safe(file_path)
        for pattern, label in patterns:
            if pattern in content:
                return label
    return None


def detect_frameworks(root: Path) -> tuple[str | None, list[str], str | None, str | None, str | None, str | None]:
    """
    Returns (primary_framework, all_frameworks, database, test_runner, package_manager, build_tool).
    """
    package_manager, frameworks = _scan_manifests(root)
    primary = frameworks[0] if frameworks else None

    database = _scan_tree_for_patterns(root, DATABASE_PATTERNS)
    test_runner = _scan_tree_for_patterns(root, TEST_PATTERNS)
    build_tool = _scan_tree_for_patterns(root, BUILD_PATTERNS)

    # Auth heuristics from common filenames
    auth_files = list(root.rglob("auth*.py")) + list(root.rglob("*auth*.ts")) + list(root.rglob("*auth*.js"))
    if auth_files and "JWT" not in (primary or ""):
        pass  # used by architecture summary

    return primary, frameworks, database, test_runner, package_manager, build_tool


def detect_authentication(root: Path) -> str | None:
    auth_signals = [
        ("jwt", "JWT"),
        ("pyjwt", "JWT"),
        ("passlib", "Password Hashing"),
        ("bcrypt", "bcrypt"),
        ("oauth", "OAuth"),
        ("openid", "OpenID"),
        ("session", "Session-based"),
        ("next-auth", "NextAuth"),
        ("auth0", "Auth0"),
        ("firebase.auth", "Firebase Auth"),
        ("supabase", "Supabase Auth"),
    ]
    return _scan_tree_for_patterns(root, auth_signals, limit=300)
