import { resolveApiBase, isHostedFrontend } from "./config";

const API_BASE = resolveApiBase();
const TOKEN_KEY = "repopilot_auth_token";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = authHeaders(
    init.body && !(init.headers as Record<string, string>)?.["Content-Type"]
      ? { "Content-Type": "application/json" }
      : {},
  );
  if (init.headers) {
    Object.assign(headers, init.headers);
  }
  if (API_BASE.includes("loca.lt")) {
    headers["Bypass-Tunnel-Reminder"] = "true";
  }
  try {
    return await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    if (isHostedFrontend() && API_BASE.includes("localhost")) {
      throw new Error(
        "Backend API is not configured for this deployment. Set VITE_API_URL in Vercel and deploy the API on Render.",
      );
    }
    throw new Error(
      `Cannot reach the API at ${API_BASE}. The backend may be starting up (Render free tier cold starts take ~30s) or offline. ` +
        "Try again in a moment.",
    );
  }
}

async function parseError(res: Response, fallback: string): Promise<string> {
  if (res.status === 511) {
    return "Tunnel access blocked (511). Restart the backend tunnel or deploy the API on Render.";
  }
  const err = await res.json().catch(() => ({ detail: res.statusText }));
  if (typeof err.detail === "string") return err.detail;
  if (Array.isArray(err.detail)) {
    return err.detail
      .map((item: { loc?: (string | number)[]; msg?: string }) => {
        const field = item.loc?.slice(1).join(".") || "request";
        return `${field}: ${item.msg ?? "invalid"}`;
      })
      .join("; ");
  }
  return fallback;
}

export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
  avatar_url?: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export async function registerUser(payload: {
  email: string;
  password: string;
  name?: string;
}): Promise<TokenResponse> {
  const res = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Registration failed"));
  return res.json();
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<TokenResponse> {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Login failed"));
  return res.json();
}

export async function guestLogin(): Promise<TokenResponse> {
  const res = await apiFetch("/auth/guest", { method: "POST" });
  if (!res.ok) throw new Error(await parseError(res, "Guest login failed"));
  return res.json();
}

export async function getCurrentUser(): Promise<AuthUser> {
  const res = await apiFetch("/auth/me");
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

export type RepositorySource = "github" | "workspace";
export type LLMProvider =
  | "auto"
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "groq"
  | "deepseek"
  | "mistral"
  | "cursor"
  | "ollama"
  | "custom";
export type TaskStatus =
  | "pending"
  | "planning"
  | "coding"
  | "testing"
  | "healing"
  | "completed"
  | "failed";

export interface RepositoryMap {
  language: string | null;
  languages: Record<string, number>;
  framework: string | null;
  frameworks: string[];
  database: string | null;
  test_runner: string | null;
  package_manager: string | null;
  build_tool: string | null;
}

export interface ArchitectureSummary {
  backend: string | null;
  frontend: string | null;
  database: string | null;
  authentication: string | null;
  tests: string | null;
  deployment: string | null;
  highlights: string[];
}

export interface DependencyNode {
  path: string;
  imports: string[];
  imported_by: string[];
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  entry_points: string[];
}

export interface RepositorySummary {
  id: string;
  name: string;
  source: RepositorySource;
  path: string;
  scanned_at: string;
  map: RepositoryMap;
  architecture: ArchitectureSummary;
  dependency_graph: DependencyGraph;
  file_count: number;
  total_lines: number;
}

export interface ScanResponse {
  summary: RepositorySummary;
  summary_path: string;
}

export interface LLMConfig {
  provider: LLMProvider;
  model?: string | null;
  api_key?: string | null;
  base_url?: string | null;
  temperature?: number;
  max_tokens?: number;
}

export interface PlanStep {
  description: string;
  files: string[];
}

export interface ExecutionPlan {
  task: string;
  files: string[];
  steps: PlanStep[];
  reasoning?: string | null;
}

export interface FileChange {
  path: string;
  action: string;
  content?: string | null;
}

export interface TestFailure {
  test_name: string;
  file?: string | null;
  line?: number | null;
  message: string;
}

export interface TestResult {
  runner: string;
  command: string;
  passed: number;
  failed: number;
  skipped: number;
  success: boolean;
  duration_seconds?: number | null;
  failures: TestFailure[];
  stdout: string;
  stderr: string;
}

export interface HealingIteration {
  iteration: number;
  test_result: TestResult;
  changes: FileChange[];
  fix_summary?: string | null;
}

export interface TaskRun {
  id: string;
  repo_id: string;
  task: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  workspace_path?: string | null;
  plan?: ExecutionPlan | null;
  changes: FileChange[];
  test_results: TestResult[];
  healing_iterations: HealingIteration[];
  error?: string | null;
  metadata: Record<string, unknown>;
}

export async function scanRepository(github_url: string): Promise<ScanResponse> {
  const res = await apiFetch("/repositories/scan", {
    method: "POST",
    body: JSON.stringify({ github_url }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Scan failed"));
  return res.json();
}

export async function createWorkspace(name: string): Promise<ScanResponse> {
  const res = await apiFetch("/repositories/workspace", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Workspace creation failed"));
  return res.json();
}

export async function createDemoWorkspace(): Promise<ScanResponse> {
  const res = await apiFetch("/repositories/demo", { method: "POST" });
  if (!res.ok) throw new Error(await parseError(res, "Demo workspace failed"));
  return res.json();
}

export async function listRepositories(): Promise<RepositorySummary[]> {
  const res = await apiFetch("/repositories");
  if (!res.ok) throw new Error("Failed to load repositories");
  return res.json();
}

export async function runTask(payload: {
  repo_id: string;
  task: string;
  llm?: LLMConfig;
  max_healing_iterations?: number;
  run_tests?: boolean;
}): Promise<TaskRun> {
  const res = await apiFetch("/tasks/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Task failed"));
  const data = await res.json();
  return data.task;
}

export async function listTasks(): Promise<TaskRun[]> {
  const res = await apiFetch("/tasks");
  if (!res.ok) throw new Error("Failed to load tasks");
  return res.json();
}

export async function getTask(taskId: string): Promise<TaskRun> {
  const res = await apiFetch(`/tasks/${taskId}`);
  if (!res.ok) throw new Error("Task not found");
  return res.json();
}

export interface WorkspaceFileInfo {
  path: string;
  is_dir: boolean;
  action: string | null;
  has_agent_change: boolean;
}

export interface WorkspaceFileDetail {
  path: string;
  original: string;
  current: string;
  action: string | null;
  changed_lines: number[];
  lines: string[];
}

export interface WorkspaceFileListResponse {
  repo_id: string;
  workspace_path: string;
  files: WorkspaceFileInfo[];
}

export async function listRepoFiles(repoId: string): Promise<WorkspaceFileListResponse> {
  const res = await apiFetch(`/repositories/${repoId}/files`);
  if (!res.ok) throw new Error("Failed to load files");
  return res.json();
}

export async function getRepoFile(repoId: string, path: string): Promise<WorkspaceFileDetail> {
  const res = await apiFetch(
    `/repositories/${repoId}/file?path=${encodeURIComponent(path)}`,
  );
  if (!res.ok) throw new Error("Failed to load file");
  return res.json();
}

export async function saveRepoFile(
  repoId: string,
  path: string,
  content: string,
): Promise<void> {
  const res = await apiFetch(
    `/repositories/${repoId}/file?path=${encodeURIComponent(path)}`,
    {
      method: "PUT",
      body: JSON.stringify({ content }),
    },
  );
  if (!res.ok) throw new Error("Failed to save file");
}

export async function getAcceptedLines(repoId: string): Promise<Record<string, number[]>> {
  const res = await apiFetch(`/repositories/${repoId}/accepted`);
  if (!res.ok) return {};
  return res.json();
}

export async function acceptLines(
  repoId: string,
  path: string,
  lineIndices: number[],
): Promise<Record<string, number[]>> {
  const res = await apiFetch(`/repositories/${repoId}/accept-lines`, {
    method: "POST",
    body: JSON.stringify({ path, line_indices: lineIndices }),
  });
  if (!res.ok) throw new Error("Failed to accept lines");
  return res.json();
}

export async function acceptAllLines(
  repoId: string,
  path: string,
): Promise<Record<string, number[]>> {
  const res = await apiFetch(`/repositories/${repoId}/accept-all`, {
    method: "POST",
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error("Failed to accept all");
  return res.json();
}

export interface TerminalResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  cwd: string;
  shell?: string;
}

export async function runTerminalCommand(
  repoId: string,
  command: string,
  cwd: string = ".",
): Promise<TerminalResult> {
  const res = await apiFetch(`/repositories/${repoId}/terminal`, {
    method: "POST",
    body: JSON.stringify({ command, cwd }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Command failed"));
  return res.json();
}

export async function downloadRepoZip(repoId: string, repoName: string): Promise<void> {
  const res = await apiFetch(`/repositories/${repoId}/download`);
  if (!res.ok) throw new Error(await parseError(res, "Download failed"));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${repoName.replace(/[<>:"/\\|?*]/g, "_")}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
