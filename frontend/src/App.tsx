import { useEffect, useState } from "react";
import { AgentPanel } from "./components/AgentPanel";
import { AuthPage } from "./components/AuthPage";
import { ForgeIDE } from "./components/ForgeIDE";
import { LoadingScreen } from "./components/LoadingScreen";
import { Logo } from "./components/Logo";
import {
  clearAuthToken,
  downloadRepoZip,
  getAuthToken,
  getCurrentUser,
  listRepositories,
  scanRepository,
  type AuthUser,
  type RepositorySummary,
  type TaskRun,
} from "./lib/api";
import "./index.css";

const API_HEALTH = import.meta.env.VITE_API_URL?.replace("/api", "") ?? "http://localhost:8000";

async function checkBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${API_HEALTH}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [githubUrl, setGithubUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repo, setRepo] = useState<RepositorySummary | null>(null);
  const [history, setHistory] = useState<RepositorySummary[]>([]);
  const [editorRefresh, setEditorRefresh] = useState(0);
  const [showOpenBar, setShowOpenBar] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    getCurrentUser()
      .then((u) => {
        setUser(u);
        return listRepositories();
      })
      .then(setHistory)
      .catch(() => {
        clearAuthToken();
        setUser(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  function handleAuthenticated(u: AuthUser) {
    setUser(u);
    setAuthLoading(false);
    listRepositories()
      .then(setHistory)
      .catch(() => {});
  }

  function handleLogout() {
    clearAuthToken();
    setUser(null);
    setRepo(null);
    setHistory([]);
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    setScanning(true);
    setError(null);
    try {
      const ok = await checkBackend();
      if (!ok) {
        throw new Error(
          "Backend is not running. Start it: cd backend && uvicorn app.main:app --reload --port 8000",
        );
      }
      const result = await scanRepository(githubUrl);
      setRepo(result.summary);
      setHistory((prev) => [result.summary, ...prev.filter((s) => s.id !== result.summary.id)]);
      setShowOpenBar(false);
      setEditorRefresh((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  function openRepo(summary: RepositorySummary) {
    setRepo(summary);
    setShowOpenBar(false);
    setEditorRefresh((k) => k + 1);
  }

  async function openRepoFromHistory(summary: RepositorySummary) {
    setScanning(true);
    setError(null);
    try {
      const ok = await checkBackend();
      if (!ok) {
        throw new Error("Backend is not running. Restart uvicorn on port 8000.");
      }
      openRepo(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open repo");
    } finally {
      setScanning(false);
    }
  }

  function onTaskComplete(_task: TaskRun) {
    setEditorRefresh((k) => k + 1);
  }

  async function handleDownloadZip() {
    if (!repo) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadRepoZip(repo.id, repo.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
      setShowOpenBar(true);
    } finally {
      setDownloading(false);
    }
  }

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthPage onAuthenticated={(u) => handleAuthenticated(u)} />;
  }

  return (
    <div className="forge-bg relative flex h-screen flex-col text-zinc-200">
      <header className="forge-glass-strong relative z-10 flex shrink-0 items-center justify-between border-b border-white/5 px-5 py-3">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
          {repo && (
            <div className="flex items-center gap-2 border-l border-white/10 pl-4">
              <span className="rounded-md bg-orange-500/15 px-2 py-0.5 text-[11px] font-medium text-orange-300">
                {repo.name}
              </span>
              {repo.map.language && (
                <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-zinc-500">
                  {repo.map.language}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-2 hidden text-xs text-zinc-500 sm:inline">
            {user.name || user.email}
          </span>
          {repo && (
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={downloading}
              className="forge-btn-ghost rounded-lg px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50"
            >
              {downloading ? "Zipping…" : "↓ ZIP"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowOpenBar(!showOpenBar)}
            className="forge-btn-primary rounded-lg px-3 py-1.5 text-xs"
          >
            {repo ? "Open repo" : "+ Add repo"}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="forge-btn-ghost rounded-lg px-3 py-1.5 text-xs text-zinc-400"
          >
            Sign out
          </button>
        </div>
      </header>

      {showOpenBar && (
        <div className="forge-glass relative z-10 shrink-0 border-b border-white/5 px-5 py-5">
          <form onSubmit={handleScan} className="mx-auto flex max-w-2xl flex-col gap-3">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              GitHub repository URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://github.com/owner/repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className="forge-input min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm"
                required
              />
              <button
                type="submit"
                disabled={scanning}
                className="forge-btn-primary flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm"
              >
                {scanning && <div className="forge-spinner !h-4 !w-4 !border-black/20 !border-t-black" />}
                {scanning ? "Cloning…" : "Open"}
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </form>
          {history.length > 0 && (
            <div className="mx-auto mt-4 max-w-2xl">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-zinc-600">Recent</p>
              <ul className="flex flex-wrap gap-2">
                {history.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openRepoFromHistory(item)}
                    className="forge-btn-ghost rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    {item.name}
                  </button>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {repo ? (
        <div className="relative z-0 flex min-h-0 flex-1 gap-3 p-3">
          <div className="min-w-0 flex-[3]">
            <ForgeIDE repoId={repo.id} refreshKey={editorRefresh} />
          </div>
          <div className="w-80 shrink-0">
            <AgentPanel repo={repo} onTaskComplete={onTaskComplete} />
          </div>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
          <div className="pointer-events-none absolute h-64 w-64 rounded-full bg-orange-500/8 blur-[80px]" />
          <Logo size="lg" />
          <div className="relative max-w-lg">
            <h2 className="mb-3 text-2xl font-semibold text-white">
              Ship code with an AI engineer
            </h2>
            <p className="text-sm leading-relaxed text-zinc-500">
              Clone a repo, edit in the IDE, and let the agent modify the same files.
              Agent changes glow{" "}
              <span className="font-medium text-emerald-400">green</span> — accept what you
              want to keep.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {["Plan → Code → Test", "Green diff review", "Terminal", "Export ZIP"].map((tag) => (
              <span
                key={tag}
                className="forge-glass rounded-full px-4 py-1.5 text-xs text-zinc-400"
              >
                {tag}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowOpenBar(true)}
            className="forge-btn-primary rounded-xl px-8 py-3 text-sm"
          >
            Open a repository
          </button>
        </div>
      )}
    </div>
  );
}
