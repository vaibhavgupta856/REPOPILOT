/** Permanent production API — Render backend for public Vercel deployments. */
export const PRODUCTION_API_BASE = "https://repopilot-api.onrender.com/api";

function isTemporaryTunnel(url: string): boolean {
  return url.includes("trycloudflare.com") || url.includes("loca.lt");
}

/** Resolve backend API base URL from Vercel / Vite env vars. */
export function resolveApiBase(): string {
  const direct = import.meta.env.VITE_API_URL as string | undefined;
  if (direct?.trim()) {
    const trimmed = direct.trim().replace(/\/$/, "");
    if (!isHostedFrontend() || !isTemporaryTunnel(trimmed)) {
      return trimmed;
    }
  }

  const backend = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (backend?.trim()) {
    const base = backend.trim().replace(/\/$/, "");
    const resolved = base.endsWith("/api") ? base : `${base}/api`;
    if (!isHostedFrontend() || !isTemporaryTunnel(resolved)) {
      return resolved;
    }
  }

  if (isHostedFrontend()) {
    return PRODUCTION_API_BASE;
  }

  return "http://localhost:8000/api";
}

export function resolveHealthBase(): string {
  return resolveApiBase().replace(/\/api$/, "");
}

export function isHostedFrontend(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host !== "localhost" && host !== "127.0.0.1";
}
