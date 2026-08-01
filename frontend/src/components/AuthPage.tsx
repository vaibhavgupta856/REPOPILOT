import { useEffect, useState } from "react";
import {
  getCurrentUser,
  guestLogin,
  loginUser,
  registerUser,
  setAuthToken,
  warmupHostedApi,
  type AuthUser,
} from "../lib/api";
import { Logo } from "./Logo";

interface AuthPageProps {
  onAuthenticated: (user: AuthUser, token: string) => void;
}

const FEATURES = [
  "Clone any GitHub repo",
  "Live IDE with diff review",
  "AI agent writes & tests code",
];

type ApiStatus = "checking" | "ready" | "waking" | "offline";

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    let retry: number | undefined;
    setApiStatus("checking");
    const started = Date.now();

    const pollUntilReady = () => {
      retry = window.setInterval(() => {
        warmupHostedApi().then((ready) => {
          if (cancelled) return;
          if (ready) {
            if (retry) clearInterval(retry);
            setApiStatus("ready");
          } else if (Date.now() - started > 90_000) {
            if (retry) clearInterval(retry);
            setApiStatus("offline");
          }
        });
      }, 4000);
    };

    warmupHostedApi().then((ok) => {
      if (cancelled) return;
      if (ok) {
        setApiStatus("ready");
        return;
      }
      setApiStatus("waking");
      pollUntilReady();
    });

    return () => {
      cancelled = true;
      if (retry) clearInterval(retry);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (apiStatus !== "ready") {
        setApiStatus("waking");
        await warmupHostedApi();
      }
      const result =
        mode === "login"
          ? await loginUser({ email, password })
          : await registerUser({ email, password, name });
      setAuthToken(result.access_token);
      const user = await getCurrentUser();
      onAuthenticated(user, result.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setGuestLoading(true);
    setError(null);
    try {
      if (apiStatus !== "ready") {
        setApiStatus("waking");
        await warmupHostedApi();
      }
      const result = await guestLogin();
      setAuthToken(result.access_token);
      const user = result.user ?? (await getCurrentUser());
      onAuthenticated(user, result.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Guest login failed");
    } finally {
      setGuestLoading(false);
    }
  }

  const busy = loading || guestLoading;
  const statusLabel =
    apiStatus === "ready"
      ? "Server ready"
      : apiStatus === "waking"
        ? "Waking server…"
        : apiStatus === "offline"
          ? "Server slow to respond — try again"
          : "Connecting…";

  return (
    <div className="forge-bg relative flex h-full min-h-0 items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-orange-500/10 blur-[100px]" />

      <div className="relative w-full max-w-md sm:max-w-lg">
        <div className="forge-glass-strong mb-6 rounded-2xl p-8 shadow-2xl shadow-black/40">
          <div className="mb-6 flex items-start justify-between gap-3">
            <Logo size="md" />
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                apiStatus === "ready"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : apiStatus === "offline"
                    ? "bg-red-500/15 text-red-300"
                    : "bg-amber-500/15 text-amber-200"
              }`}
            >
              {(apiStatus === "checking" || apiStatus === "waking") && (
                <span className="forge-spinner !h-2.5 !w-2.5 !border-current/30 !border-t-current" />
              )}
              {statusLabel}
            </span>
          </div>

          <div className="mb-6 flex rounded-xl bg-black/30 p-1">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                  mode === m
                    ? "forge-btn-primary shadow-md"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === "register" && (
              <input
                type="text"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="forge-input rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="forge-input rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
            <input
              type="password"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="forge-input rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
            <button
              type="submit"
              disabled={busy}
              className="forge-btn-primary mt-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm"
            >
              {loading && <div className="forge-spinner !h-4 !w-4 !border-black/20 !border-t-black" />}
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleGuest}
              className="forge-btn-ghost flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm text-zinc-200 disabled:opacity-50"
            >
              {guestLoading && <div className="forge-spinner !h-4 !w-4 !border-white/20 !border-t-white" />}
              {guestLoading
                ? apiStatus === "waking" || apiStatus === "checking"
                  ? "Waking up server…"
                  : "Signing in…"
                : "Continue as Guest"}
            </button>
            {(guestLoading || apiStatus === "waking") && (
              <p className="text-center text-[11px] text-zinc-500">
                Free hosting may take up to a minute after idle. The page starts waking the server
                as soon as you open it.
              </p>
            )}
          </form>

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-center text-xs text-red-300">
              {error}
            </p>
          )}
        </div>

        <ul className="flex flex-wrap justify-center gap-2">
          {FEATURES.map((f) => (
            <li
              key={f}
              className="forge-glass rounded-full px-3 py-1 text-[11px] text-zinc-400"
            >
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
