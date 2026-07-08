from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.repositories import router as repositories_router
from app.api.tasks import router as tasks_router
from app.config import settings
from app.db.session import init_db


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    description="RepoPilot — autonomous software engineering agent",
    version="0.3.1",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://repopilot.vercel.app",
        "https://frontend-chi-three-58.vercel.app",
        "https://repopilot-vaibhavgupta856s-projects.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.(vercel\.app|onrender\.com|trycloudflare\.com|loca\.lt)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(repositories_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name, "version": app.version}
