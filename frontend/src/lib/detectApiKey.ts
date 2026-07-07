import type { LLMProvider } from "./api";

export function detectProviderFromKey(apiKey: string): LLMProvider | null {
  const key = apiKey.trim();
  if (!key) return null;
  const lower = key.toLowerCase();
  if (lower.startsWith("sk-or-v1-") || lower.startsWith("sk-or-")) return "openrouter";
  if (lower.startsWith("sk-ant-")) return "anthropic";
  if (lower.startsWith("crsr_")) return "cursor";
  if (key.startsWith("AIza")) return "gemini";
  if (lower.startsWith("sk-proj-") || lower.startsWith("sk-")) return "openai";
  return null;
}

export function providerLabel(provider: LLMProvider | "auto"): string {
  const labels: Record<string, string> = {
    auto: "Auto",
    openai: "OpenAI",
    anthropic: "Anthropic",
    gemini: "Gemini",
    openrouter: "OpenRouter",
    cursor: "Cursor",
    ollama: "Ollama",
  };
  return labels[provider] ?? provider;
}
