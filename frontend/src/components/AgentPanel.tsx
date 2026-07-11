import { useEffect, useMemo, useState } from "react";
import {
  runTask,
  type LLMProvider,
  type RepositorySummary,
  type TaskRun,
} from "../lib/api";
import { detectProviderFromKey, defaultModelHint, providerLabel } from "../lib/detectApiKey";

interface AgentPanelProps {
  repo: RepositorySummary;
  onTaskComplete: (task: TaskRun) => void;
}

const REPO_GITHUB_URL = "https://github.com/vaibhavgupta856/REPOPILOT";

const ADVANCED_PROVIDERS: { id: LLMProvider; label: string }[] = [
  { id: "auto", label: "Auto-detect" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "groq", label: "Groq" },
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "gemini", label: "Gemini" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "mistral", label: "Mistral" },
  { id: "custom", label: "Other (LiteLLM)" },
  { id: "ollama", label: "Ollama" },
];

function isLocalDeployment(): boolean {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function AgentPanel({ repo, onTaskComplete }: AgentPanelProps) {
  const [task, setTask] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [useOllama, setUseOllama] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [providerOverride, setProviderOverride] = useState<LLMProvider>("auto");
  const [model, setModel] = useState("");
  const [runTests, setRunTests] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<TaskRun | null>(null);

  const detectedProvider = useMemo(() => detectProviderFromKey(apiKey), [apiKey]);

  useEffect(() => {
    if (!useOllama && apiKey.trim().length >= 8 && !detectedProvider) {
      setShowAdvanced(true);
    }
  }, [apiKey, detectedProvider, useOllama]);
  const effectiveProvider: LLMProvider = useOllama
    ? "ollama"
    : showAdvanced && providerOverride !== "auto"
      ? providerOverride
      : detectedProvider ?? "auto";
  const hasLiteLLMModel = model.trim().includes("/");
  const needsProviderPick =
    !useOllama &&
    Boolean(apiKey.trim()) &&
    !detectedProvider &&
    effectiveProvider === "auto" &&
    !hasLiteLLMModel;
  const needsCustomModel = effectiveProvider === "custom" && !model.trim();
  const modelHint = defaultModelHint(
    effectiveProvider === "auto" ? (detectedProvider ?? "openrouter") : effectiveProvider,
  );

  const ollamaUnavailableOnHost = useOllama && !isLocalDeployment();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (ollamaUnavailableOnHost) {
      setError(
        "Ollama is not available on this hosted demo. Clone RepoPilot and run it locally with Ollama installed.",
      );
      return;
    }
    if (!useOllama && !apiKey.trim()) {
      setError("Paste an API key, or switch to local Ollama.");
      return;
    }
    if (needsProviderPick) {
      setError(
        "Could not auto-detect this key. Open Advanced and pick your provider (e.g. Groq), or enter a model like groq/llama-3.1-8b-instant.",
      );
      setShowAdvanced(true);
      return;
    }
    if (needsCustomModel) {
      setError("Custom provider needs a model like groq/llama-3.1-8b-instant.");
      setShowAdvanced(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const taskRun = await runTask({
        repo_id: repo.id,
        task,
        llm: {
          provider: effectiveProvider,
          model: model || null,
          api_key: useOllama ? null : apiKey.trim(),
        },
        run_tests: runTests,
        max_healing_iterations: 3,
      });
      setLastResult(taskRun);
      onTaskComplete(taskRun);
      if (taskRun.status === "failed" && taskRun.error) {
        setError(taskRun.error);
      }
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
          Paste any cloud API key — Groq, OpenRouter, OpenAI, and more
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

        {!useOllama && (
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              API key
            </label>
            <input
              type="password"
              placeholder="Paste key — Groq (gsk_…), OpenRouter (sk-or-v1-…), OpenAI, etc."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="forge-input w-full rounded-xl px-3 py-2.5 text-xs text-zinc-200"
            />
            {apiKey.trim() && detectedProvider && (
              <p className="mt-2 text-[11px] text-emerald-400/90">
                Detected: <span className="font-medium">{providerLabel(detectedProvider)}</span>
                {modelHint && (
                  <>
                    {" "}
                    · <span className="text-zinc-500">{modelHint}</span>
                  </>
                )}
              </p>
            )}
            {needsProviderPick && (
              <p className="mt-2 text-[11px] text-amber-300/90">
                Unknown key format — open Advanced and pick your provider, or enter a model like{" "}
                <code className="text-amber-100">groq/llama-3.1-8b-instant</code> below.
              </p>
            )}
            {apiKey.trim() && !detectedProvider && hasLiteLLMModel && (
              <p className="mt-2 text-[11px] text-emerald-400/90">
                Using custom route: <span className="font-medium">{model.trim()}</span>
              </p>
            )}
            <p className="mt-1.5 text-[11px] text-zinc-600">
              Key is never stored — only sent with this run.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setUseOllama(false);
              setError(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
              !useOllama
                ? "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40"
                : "bg-white/5 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Cloud API key
          </button>
          <button
            type="button"
            onClick={() => {
              setUseOllama(true);
              setError(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
              useOllama
                ? "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40"
                : "bg-white/5 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Local Ollama
          </button>
        </div>

        {ollamaUnavailableOnHost && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/90">
            <p className="font-medium text-amber-300">Ollama is local-only on this hosted site</p>
            <p className="mt-1">
              Download RepoPilot, install{" "}
              <a href="https://ollama.com" target="_blank" rel="noreferrer" className="underline">
                Ollama
              </a>
              , and run the backend on your machine. Or use a cloud API key above.
            </p>
            <a
              href={REPO_GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block font-medium text-amber-300 underline"
            >
              Clone from GitHub →
            </a>
          </div>
        )}

        {useOllama && isLocalDeployment() && (
          <p className="text-[11px] text-zinc-500">
            Requires: <code className="text-zinc-400">ollama serve</code> and{" "}
            <code className="text-zinc-400">ollama pull llama3.2</code>
          </p>
        )}

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-left text-[11px] text-zinc-500 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300"
        >
          {showAdvanced ? "Hide advanced" : "Advanced: pick provider or model"}
        </button>

        {showAdvanced && (
          <div className="forge-glass space-y-2 rounded-xl p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              Provider override
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ADVANCED_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProviderOverride(p.id)}
                  className={`rounded-lg px-2 py-1 text-[10px] font-medium ${
                    providerOverride === p.id
                      ? "bg-orange-500/20 text-orange-300"
                      : "bg-white/5 text-zinc-500"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder={
                effectiveProvider === "custom"
                  ? "provider/model — e.g. groq/llama-3.1-8b-instant"
                  : modelHint
                    ? `Model override (default: ${modelHint})`
                    : "Model override (optional)"
              }
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="forge-input w-full rounded-lg px-3 py-2 text-xs text-zinc-200"
            />
            {effectiveProvider === "custom" && (
              <p className="text-[10px] text-zinc-500">
                Works with any LiteLLM-supported provider. Use{" "}
                <code className="text-zinc-400">provider/model</code> format.
              </p>
            )}
          </div>
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
          disabled={
            loading ||
            !task.trim() ||
            ollamaUnavailableOnHost ||
            needsCustomModel
          }
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
