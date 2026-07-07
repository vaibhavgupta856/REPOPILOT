# RepoPilot

**RepoPilot** is an autonomous software engineering agent. Point it at a GitHub repository, describe what you want built or changed, and it plans the work, writes code, runs tests, fixes failures, and presents the result in a live IDE for review.

**Operating cost to you: $0** — inference runs on your own LLM API key (BYOK) or a local Ollama instance.

---

## The Problem It Solves

Modern AI coding tools are mostly chat or autocomplete. They do not:

- Understand a full repository’s structure, stack, and tests
- Execute a multi-step engineering workflow on their own
- Run tests and retry when things break
- Let you review agent changes line-by-line before accepting them

RepoPilot closes that gap. It behaves like a junior engineer working inside your repo: scan → plan → code → test → self-heal → review — with per-user isolation, a built-in terminal, and zero inference cost on the host.

---

## Core Principles

| Principle | What it means |
|-----------|---------------|
| **BYOK** | You bring your own key (OpenAI, Anthropic, Gemini, OpenRouter) or use Ollama locally. RepoPilot never pays for LLM calls. |
| **Agentic** | Not a chatbot. It actively plans, edits files, runs commands, and iterates until tests pass or limits are hit. |
| **Multi-user ready** | Email/password auth, JWT sessions, and isolated workspaces per user — suitable for demos and small deployments. |
| **Review-first** | Agent edits appear as green diffs in the IDE. Accept line-by-line or all at once before exporting. |

---

## Features

### Repository intelligence

- Clone any **public GitHub repository** by URL
- Detect **languages**, **frameworks**, **databases**, **test runners**, and **package managers**
- Build an **architecture summary** (backend, frontend, auth, deployment hints)
- Generate a **file dependency graph** with entry points

### Autonomous agent pipeline

Given a natural-language task (e.g. *“Add JWT authentication”* or *“Add a utility function with pytest”*):

1. **Plan** — LLM analyzes the repo and produces an execution plan
2. **Code** — LLM generates file creates/edits applied directly in the workspace
3. **Test** — Detects pytest/npm/etc. and runs the test suite
4. **Self-heal** — On failure, re-plans and patches code (up to 3 iterations by default)

### Live IDE workspace

- **File tree** with indicators for agent-changed files
- **Line-by-line diff review** — green highlights for agent edits, accept per line or accept all
- **Manual editing** — edit and save files in the browser
- **Integrated terminal** — run shell commands (PowerShell on Windows, bash on Linux/macOS) inside the cloned repo (`pip install`, `npm install`, `pytest`, etc.)
- **Export ZIP** — download the modified repository

### Authentication & isolation

- Email sign-up and login with **bcrypt** password hashing
- **JWT** bearer tokens (7-day default expiry)
- Each user gets a private workspace: `workspace/users/{user_id}/repos/{repo_id}/`
- All repository and task APIs require auth and ownership checks

### Supported LLM providers

| Provider | Purpose |
|----------|---------|
| **Ollama** | Free local inference (e.g. `llama3.2`) |
| **OpenRouter** | Access many models with one key (good for demos) |
| **OpenAI** | GPT models |
| **Anthropic** | Claude models |
| **Gemini** | Google models |

API keys are entered in the Agent panel per session — they are **not stored in the database**.

---

## Tech Stack

### Backend — Python / FastAPI

| Technology | Purpose |
|------------|---------|
| **[FastAPI](https://fastapi.tiangolo.com/)** | REST API server, routing, request validation, OpenAPI docs |
| **[Uvicorn](https://www.uvicorn.org/)** | ASGI server for local dev and production |
| **[Pydantic](https://docs.pydantic.dev/)** | Data models, settings, API schemas |
| **[SQLAlchemy](https://www.sqlalchemy.org/)** + **[aiosqlite](https://github.com/omnilib/aiosqlite)** | ORM and async SQLite access for users and repository records |
| **[python-jose](https://python-jose.readthedocs.io/)** | JWT creation and verification |
| **[bcrypt](https://github.com/pyca/bcrypt/)** | Secure password hashing |
| **[GitPython](https://gitpython.readthedocs.io/)** | Clone GitHub repositories into user workspaces |
| **[LiteLLM](https://docs.litellm.ai/)** | Unified interface to OpenAI, Anthropic, Gemini, OpenRouter, and Ollama |
| **[Tree-sitter](https://tree-sitter.github.io/)** | Parse Python/JS/TS for code structure and dependency analysis |
| **[Docker SDK](https://docker-py.readthedocs.io/)** | Sandbox execution support (future/isolated runs) |
| **[httpx](https://www.python-httpx.org/)** | HTTP client for external calls |

### Frontend — React / TypeScript

| Technology | Purpose |
|------------|---------|
| **[React 19](https://react.dev/)** | UI components and state |
| **[TypeScript](https://www.typescriptlang.org/)** | Type-safe frontend code |
| **[Vite](https://vitejs.dev/)** | Dev server and production bundler |
| **[Tailwind CSS v4](https://tailwindcss.com/)** | Utility-first styling (glass theme, gradients, responsive layout) |

### Agent layer — `agent/`

| Module | Purpose |
|--------|---------|
| **`agent/planner/`** | Turns a task + repo context into a structured execution plan |
| **`agent/coder/`** | Generates `FileChange` objects (create/update/delete) via LLM |
| **`agent/tester/`** | Detects test runner (pytest, npm test, etc.) and parses output |
| **`agent/healer/`** | Retries coding after test failures with error context |
| **`agent/reviewer/`** | Stub for future PR/review summaries |

### Data & storage

| Location | Purpose |
|----------|---------|
| **`backend/repopilot.db`** | SQLite database (users, repository metadata) |
| **`workspace/users/{user_id}/repos/`** | Cloned Git repositories (live edit target) |
| **`workspace/users/{user_id}/meta/`** | Pending agent changes, accepted lines, task logs, file snapshots |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     React UI (localhost:5173)                    │
│  Auth · GitHub clone · Agent panel · IDE · Terminal · Export   │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST + JWT
┌────────────────────────────▼────────────────────────────────────┐
│                   FastAPI Backend (localhost:8000)               │
│  /api/auth  ·  /api/repositories  ·  /api/tasks                  │
└──────┬─────────────────┬──────────────────┬───────────────────┘
       │                 │                  │
       ▼                 ▼                  ▼
  SQLite DB      User workspaces      Agent pipeline
  (users/repos)  (Git clones)         Plan→Code→Test→Heal
       │                 │                  │
       └─────────────────┴──────────────────┘
                         │
                         ▼
                    LiteLLM → Ollama / OpenAI / Anthropic / Gemini / OpenRouter
```

### Agent workflow

```
User task
   │
   ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Planner │───▶│   Coder  │───▶│  Tester  │───▶│  Healer  │──┐
│  (LLM)   │    │  (LLM)   │    │ (pytest/ │    │  (LLM)   │  │ retry
└──────────┘    └──────────┘    │  npm…)   │    └──────────┘  │ (≤3×)
                                └──────────┘◀───────────────────┘
   │
   ▼
IDE diff review → Accept changes → Export ZIP
```

---

## Project Structure

```
RepoPilot/
├── backend/
│   ├── app/
│   │   ├── api/              # auth, repositories, tasks routes
│   │   ├── db/               # SQLAlchemy models and session
│   │   ├── models/           # Pydantic request/response schemas
│   │   └── services/         # auth, LLM, scanner, workspace, terminal
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── components/       # AuthPage, ForgeIDE, AgentPanel, RepoTerminal
│       └── lib/api.ts        # Typed API client
├── agent/
│   ├── planner/
│   ├── coder/
│   ├── tester/
│   ├── healer/
│   └── reviewer/
├── workspace/                # Runtime data (clones, meta, per user)
└── sandbox/                  # Isolated execution (future use)
```

---

## Quick Start

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- An LLM: [Ollama](https://ollama.com) locally, or an API key for OpenRouter / OpenAI / Anthropic / Gemini

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate          # Windows
# source .venv/bin/activate       # macOS / Linux
pip install -r requirements.txt
copy .env.example .env            # edit JWT_SECRET for production
uvicorn app.main:app --reload --port 8000
```

Health check: [http://localhost:8000/health](http://localhost:8000/health)

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 3. Use the app

1. **Sign up** with email and password
2. Paste a **public GitHub URL** and click scan
3. Enter a **task** in the Agent panel and choose an LLM provider + API key
4. Watch the pipeline run, then **review diffs** in the IDE
5. Use the **Terminal** tab for `pip install`, `npm install`, or manual commands
6. **Export ZIP** when done

### Ollama (free local LLM)

```powershell
ollama pull llama3.2
ollama serve
```

In the Agent panel, select **Ollama** as the provider. Ollama must be reachable from the **backend machine** (not the browser).

### OpenRouter (free cloud LLM — recommended on Windows)

1. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys) (`sk-or-v1-…`)
2. Paste it in the Agent panel — provider is auto-detected
3. Default model: **`cohere/north-mini-code:free`** (no model name needed)

Optional: set `OPENROUTER_API_KEY` in `backend/.env` for server-side use.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env`:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Secret for signing JWTs — **change in production** |
| `FRONTEND_URL` | Allowed CORS origin (default `http://localhost:5173`) |
| `DATABASE_URL` | SQLite path (default `sqlite:///./repopilot.db`) |
| `DEFAULT_LLM_PROVIDER` | Default provider name (default `ollama`) |
| `OLLAMA_BASE_URL` | Ollama API URL (default `http://localhost:11434`) |
| `OPENROUTER_API_KEY` | Optional server-side OpenRouter key (users can also pass keys in the UI) |

Frontend optional:

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend API base (default `http://localhost:8000/api`) |

---

## API Overview

All routes except `/health` and `/api/auth/register|login` require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Sign in |
| `GET` | `/api/auth/me` | Current user |
| `POST` | `/api/repositories/scan` | Clone & analyze a GitHub repo |
| `GET` | `/api/repositories` | List your repositories |
| `GET` | `/api/repositories/{id}/files` | List workspace files |
| `GET` | `/api/repositories/{id}/file?path=…` | Read file with diff metadata |
| `PUT` | `/api/repositories/{id}/file?path=…` | Save manual edits |
| `POST` | `/api/repositories/{id}/terminal` | Run a shell command in the repo |
| `GET` | `/api/repositories/{id}/download` | Download repo as ZIP |
| `POST` | `/api/tasks/run` | Run the agent pipeline |
| `GET` | `/api/tasks/{id}` | Task status and results |

Interactive docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Deployment Notes

RepoPilot is split across two hosts: **Vercel** (React frontend) and **Render** (FastAPI backend with git clone, terminal, and workspaces).

### 1. Push to GitHub

```bash
git push origin main
```

Repo: [github.com/vaibhavgupta856/REPOPILOT](https://github.com/vaibhavgupta856/REPOPILOT)

### 2. Deploy backend (Render)

1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect the GitHub repo — Render reads `render.yaml` automatically
3. After deploy, copy your API URL (e.g. `https://repopilot-api.onrender.com`)
4. In Render → **Environment**, set `FRONTEND_URL` to your Vercel URL once frontend is live

### 3. Deploy frontend (Vercel) — project name **RepoPilot**

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import `vaibhavgupta856/REPOPILOT`
2. Vercel auto-detects `vercel.json` (builds `frontend/`)
3. **Project name:** set to `RepoPilot` → live URL: **`https://repopilot.vercel.app`**
4. **Environment variable:** `VITE_API_URL` = `https://YOUR-RENDER-URL.onrender.com/api`
5. Deploy

CLI alternative:

```bash
npx vercel --prod --name repopilot
```

Set `VITE_API_URL` in the Vercel dashboard under **Settings → Environment Variables**.

### 4. Production checklist

1. Set a strong `JWT_SECRET` on Render
2. Set `FRONTEND_URL` on Render to `https://repopilot.vercel.app`
3. Use HTTPS on both services (automatic on Vercel/Render)
4. **Ollama on hosted demos:** Ollama does **not** work for visitors on a typical cloud deploy unless you run Ollama on the same server with enough RAM. The UI shows a notice when Ollama is selected on a hosted site and directs users to **clone the repo locally** and install [Ollama](https://ollama.com) to use that feature.
5. For hosted demos, prefer **OpenRouter** (or other cloud keys) in the Agent panel — visitors paste their own key
6. Create a demo account ahead of time for instant login, or use **Guest mode**
7. Terminal commands run on the **server** with that machine’s PATH — system tools (`gcc`, `python`) must already be installed there

> **Custom domain:** In Vercel → **Settings → Domains**, add e.g. `repopilot.dev` if you own one. The free `repopilot.vercel.app` subdomain is available when the project is named `RepoPilot`.

---

## Limitations & Roadmap

| Area | Status |
|------|--------|
| Repository intelligence | ✅ Done |
| Planner / Coder / Tester / Healer | ✅ Done |
| Multi-user auth & isolation | ✅ Done |
| IDE + terminal + ZIP export | ✅ Done |
| Semantic code indexing | Planned |
| Review agent (PR summaries) | Stub |
| GitHub PR creation | Planned |
| Private GitHub repos | Not yet supported |
| Docker sandbox for all test runs | Partial |

---

## Development

```powershell
# Backend tests
cd backend
.\.venv\Scripts\activate
python -m pytest tests/ -q

# Frontend build
cd frontend
npm run build
```

---

