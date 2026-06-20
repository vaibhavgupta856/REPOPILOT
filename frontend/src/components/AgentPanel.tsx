import { useState } from "react";
import {
  runTask,
  type LLMProvider,
  type RepositorySummary,
  type TaskRun,
} from "../lib/api";

interface AgentPanelProps {
  repo: RepositorySummary;
  onTaskComplete: (task: TaskRun) => void;
}

const PROVIDERS: { id: LLMProvider; label: string }[] = [
  { id: "openrouter", label: "OpenRouter" },
  { id: "ollama", label: "Ollama" },
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "gemini", label: "Gemini" },
];

export function AgentPanel({ repo, onTaskComplete }: AgentPanelProps) {
  const [task, setTask] = useState("");
  const [provider, setProvider] = useState<LLMProvider>("openrouter");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [runTests, setRunTests] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<TaskRun | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const taskRun = await runTask({
        repo_id: repo.id,
        task,
        llm: { provider, model: model || null, api_key: apiKey || null },
        run_tests: runTests,
        max_healing_iterations: 3,
      });
      setLastResult(taskRun);
      onTaskComplete(taskRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Task failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="forge-glass-strong flex h-full flex-col overflow-hidden rounded-2xl shadow-xl shadow-black/30">
      <div className="border-b border-white/5 bg-gradient-to-r from-orange-500/10 to-transparent px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${loading ? "animate-ping" : ""}`}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <h2 className="text-sm font-semibold text-white">Agent</h2>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">
          Edits the same files in your editor
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <textarea
          placeholder='e.g. "Add a hello world endpoint to the API"'
          value={task}
          onChange={(e) => setTask(e.target.value)}
          rows={4}
          required
          className="forge-input w-full flex-1 resize-none rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600"
        />

        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Provider
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                  provider === p.id
                    ? "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40"
                    : "bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <input
          type="text"
          placeholder={
            provider === "openrouter"
              ? "Model (default: nex-agi/nex-n2-pro:free)"
              : provider === "anthropic"
                ? "Model (default: claude-3-5-haiku)"
                : provider === "openai"
                  ? "Model (default: gpt-4o-mini)"
                  : "Model (optional)"
          }
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="forge-input rounded-xl px-3 py-2 text-xs text-zinc-200"
        />

        {provider !== "ollama" && (
          <input
            type="password"
            placeholder={
              provider === "openrouter" ? "OpenRouter key (sk-or-v1-…)" : "API key"
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="forge-input rounded-xl px-3 py-2 text-xs text-zinc-200"
          />
        )}

        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
          <input
            type="checkbox"
            checked={runTests}
            onChange={(e) => setRunTests(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-900 text-orange-500 focus:ring-orange-500/30"
          />
          Run tests after changes
        </label>

        <button
          type="submit"
          disabled={loading || !task.trim()}
          className={`forge-btn-primary flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm ${loading ? "forge-agent-working" : ""}`}
        >
          {loading && <div className="forge-spinner !h-4 !w-4 !border-black/20 !border-t-black" />}
          {loading ? "Agent working…" : "Run Agent"}
        </button>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        {lastResult && (
          <div className="forge-glass rounded-xl p-3 text-xs">
            <span
              className={`inline-flex rounded-md px-2 py-0.5 font-semibold uppercase tracking-wide ${
                lastResult.status === "completed"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-red-500/15 text-red-400"
              }`}
            >
              {lastResult.status}
            </span>
            {lastResult.changes.length > 0 && (
              <ul className="mt-2 space-y-1 text-zinc-500">
                {lastResult.changes.map((c, i) => (
                  <li key={i} className="font-mono-forge truncate">
                    <span className="text-emerald-400">{c.action}</span> {c.path}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
