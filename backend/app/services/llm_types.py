from enum import Enum


class LLMProvider(str, Enum):
    AUTO = "auto"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    OPENROUTER = "openrouter"
    GROQ = "groq"
    DEEPSEEK = "deepseek"
    MISTRAL = "mistral"
    OLLAMA = "ollama"
    CUSTOM = "custom"


DEFAULT_MODELS: dict[LLMProvider, str] = {
    LLMProvider.OPENAI: "gpt-4o-mini",
    LLMProvider.ANTHROPIC: "claude-3-5-haiku-20241022",
    LLMProvider.GEMINI: "gemini-2.0-flash",
    LLMProvider.OPENROUTER: "cohere/north-mini-code:free",
    LLMProvider.GROQ: "llama-3.1-8b-instant",
    LLMProvider.DEEPSEEK: "deepseek-chat",
    LLMProvider.MISTRAL: "mistral-small-latest",
    LLMProvider.OLLAMA: "llama3.2",
    LLMProvider.CUSTOM: "groq/llama-3.1-8b-instant",
}
