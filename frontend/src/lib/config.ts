/** Permanent production API — Render backend for public Vercel deployments. */
export const PRODUCTION_API_BASE = "https://repopilot-api.onrender.com/api";

function isTemporaryTunnel(url: string): boolean {
  return url.includes("trycloudflare.com") || url.includes("loca.lt");
}

/** Vercel preview/static hosts are not the API — never use them as backend. */
function isUnusableBackend(url: string): boolean {
  return (
    isTemporaryTunnel(url) ||
    url.includes("vercel.app") ||
    url.includes("localhost") ||
    url.includes("127.0.0.1")
  );
}

function normalizeApiBase(url: string): string {
  const base = url.trim().replace(/\/$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}

/** Resolve backend API base URL from Vercel / Vite env vars. */
export function resolveApiBase(): string {
  if (typeof window !== "undefined" && isHostedFrontend()) {
    const direct = import.meta.env.VITE_API_URL as string | undefined;
    if (direct?.trim()) {
      const resolved = normalizeApiBase(direct);
      if (!isUnusableBackend(resolved)) {
        return resolved;
      }
    }
    return PRODUCTION_API_BASE;
  }

  const direct = import.meta.env.VITE_API_URL as string | undefined;
  if (direct?.trim()) {
    return normalizeApiBase(direct);
  }

  const backend = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (backend?.trim()) {
    return normalizeApiBase(backend);
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
