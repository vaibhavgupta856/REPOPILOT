"""Infer LLM provider from API key format."""

from app.services.llm_types import LLMProvider


def detect_provider_from_key(api_key: str | None) -> LLMProvider | None:
    key = (api_key or "").strip()
    if not key:
        return None
    lower = key.lower()
    if lower.startswith("sk-or-v1-") or lower.startswith("sk-or-"):
        return LLMProvider.OPENROUTER
    if lower.startswith("sk-ant-"):
        return LLMProvider.ANTHROPIC
    if lower.startswith("gsk_"):
        return LLMProvider.GROQ
    if key.startswith("AIza"):
        return LLMProvider.GEMINI
    if lower.startswith("sk-proj-") or lower.startswith("sk-"):
        return LLMProvider.OPENAI
    return None


def provider_label(provider: LLMProvider) -> str:
    labels = {
        LLMProvider.OPENAI: "OpenAI",
        LLMProvider.ANTHROPIC: "Anthropic",
        LLMProvider.GEMINI: "Gemini",
        LLMProvider.OPENROUTER: "OpenRouter",
        LLMProvider.GROQ: "Groq",
        LLMProvider.DEEPSEEK: "DeepSeek",
        LLMProvider.MISTRAL: "Mistral",
        LLMProvider.OLLAMA: "Ollama",
        LLMProvider.CUSTOM: "Custom",
        LLMProvider.AUTO: "Auto",
    }
    return labels.get(provider, provider.value)
