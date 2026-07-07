from enum import Enum


class LLMProvider(str, Enum):
    AUTO = "auto"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    OPENROUTER = "openrouter"
    CURSOR = "cursor"
    OLLAMA = "ollama"


DEFAULT_MODELS: dict[LLMProvider, str] = {
    LLMProvider.OPENAI: "gpt-4o-mini",
    LLMProvider.ANTHROPIC: "claude-3-5-haiku-20241022",
    LLMProvider.GEMINI: "gemini-2.0-flash",
    LLMProvider.OPENROUTER: "cohere/north-mini-code:free",
    LLMProvider.CURSOR: "composer-2.5",
    LLMProvider.OLLAMA: "llama3.2",
}
