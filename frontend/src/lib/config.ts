/** Resolve backend API base URL from Vercel / Vite env vars. */
export function resolveApiBase(): string {
  const direct = import.meta.env.VITE_API_URL as string | undefined;
  if (direct?.trim()) {
    return direct.trim().replace(/\/$/, "");
  }

  const backend = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (backend?.trim()) {
    const base = backend.trim().replace(/\/$/, "");
    return base.endsWith("/api") ? base : `${base}/api`;
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
