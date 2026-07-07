import type { LLMProvider } from "./api";

export function detectProviderFromKey(apiKey: string): LLMProvider | null {
  const key = apiKey.trim();
  if (!key) return null;
  const lower = key.toLowerCase();
  if (lower.startsWith("sk-or-v1-") || lower.startsWith("sk-or-")) return "openrouter";
  if (lower.startsWith("sk-ant-")) return "anthropic";
  if (lower.startsWith("crsr_")) return "cursor";
  if (lower.startsWith("gsk_")) return "groq";
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
    groq: "Groq",
    deepseek: "DeepSeek",
    mistral: "Mistral",
    cursor: "Cursor",
    ollama: "Ollama",
    custom: "Custom",
  };
  return labels[provider] ?? provider;
}

export function defaultModelHint(provider: LLMProvider): string | null {
  const hints: Partial<Record<LLMProvider, string>> = {
    openrouter: "cohere/north-mini-code:free",
    groq: "llama-3.1-8b-instant",
    deepseek: "deepseek-chat",
    mistral: "mistral-small-latest",
    cursor: "composer-2.5",
    openai: "gpt-4o-mini",
    anthropic: "claude-3-5-haiku-20241022",
    gemini: "gemini-2.0-flash",
    ollama: "llama3.2",
  };
  return hints[provider] ?? null;
}
