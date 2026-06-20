"""LiteLLM wrapper with BYOK provider support."""

import json
import os
import re
from enum import Enum

import litellm
from pydantic import BaseModel

from app.config import settings

litellm.suppress_debug_info = True


class LLMProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    OPENROUTER = "openrouter"
    OLLAMA = "ollama"


class LLMConfig(BaseModel):
    provider: LLMProvider = LLMProvider.OLLAMA
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    temperature: float = 0.2
    max_tokens: int = 8192


DEFAULT_MODELS: dict[LLMProvider, str] = {
    LLMProvider.OPENAI: "gpt-4o-mini",
    LLMProvider.ANTHROPIC: "anthropic/claude-3-5-haiku-20241022",
    LLMProvider.GEMINI: "gemini/gemini-2.0-flash",
    LLMProvider.OPENROUTER: "openrouter/nex-agi/nex-n2-pro:free",
    LLMProvider.OLLAMA: "ollama/llama3.2",
}


def _resolve_model(config: LLMConfig) -> str:
    model = config.model or DEFAULT_MODELS[config.provider]
    if config.provider == LLMProvider.OLLAMA and not model.startswith("ollama/"):
        return f"ollama/{model}"
    if config.provider == LLMProvider.GEMINI and not model.startswith("gemini/"):
        return f"gemini/{model}"
    if config.provider == LLMProvider.ANTHROPIC and not model.startswith("anthropic/"):
        return f"anthropic/{model.removeprefix('anthropic/')}"
    if config.provider == LLMProvider.OPENROUTER and not model.startswith("openrouter/"):
        return f"openrouter/{model.removeprefix('openrouter/')}"
    if config.provider == LLMProvider.OPENAI and not model.startswith("openai/"):
        # LiteLLM accepts bare gpt-* names; prefix for consistency with other providers
        if not model.startswith("gpt-"):
            return f"openai/{model.removeprefix('openai/')}"
    return model


def _apply_env_keys(config: LLMConfig) -> None:
    if config.api_key:
        if config.provider == LLMProvider.OPENAI:
            os.environ["OPENAI_API_KEY"] = config.api_key
        elif config.provider == LLMProvider.ANTHROPIC:
            os.environ["ANTHROPIC_API_KEY"] = config.api_key
        elif config.provider == LLMProvider.GEMINI:
            os.environ["GEMINI_API_KEY"] = config.api_key
        elif config.provider == LLMProvider.OPENROUTER:
            os.environ["OPENROUTER_API_KEY"] = config.api_key

    if config.provider == LLMProvider.OLLAMA:
        base = config.base_url or settings.ollama_base_url
        os.environ["OLLAMA_API_BASE"] = base


def extract_json(text: str) -> dict | list:
    """Parse JSON from LLM response, tolerating markdown fences."""
    if not text or not text.strip():
        raise ValueError(
            "LLM returned an empty response. Is Ollama running? "
            "Try: ollama pull llama3.2"
        )

    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        obj_match = re.search(r"\{[\s\S]*\}", text)
        if obj_match:
            try:
                return json.loads(obj_match.group(0))
            except json.JSONDecodeError:
                pass
        preview = text[:150].replace("\n", " ")
        raise ValueError(
            f"LLM did not return valid JSON. Response started with: {preview!r}. "
            "Try a simpler task or a larger model."
        ) from None


def llm_complete(
    config: LLMConfig,
    system: str,
    user: str,
    *,
    json_mode: bool = True,
) -> str:
    _apply_env_keys(config)
    model = _resolve_model(config)

    kwargs: dict = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
    }

    if json_mode and config.provider in (
        LLMProvider.OPENAI,
        LLMProvider.GEMINI,
        LLMProvider.OPENROUTER,
    ):
        kwargs["response_format"] = {"type": "json_object"}

    if config.api_key:
        kwargs["api_key"] = config.api_key

    if config.provider == LLMProvider.OPENROUTER:
        kwargs["extra_headers"] = {
            "HTTP-Referer": settings.frontend_url,
            "X-Title": settings.app_name,
        }

    response = litellm.completion(**kwargs)
    return response.choices[0].message.content or ""


def llm_complete_json(config: LLMConfig, system: str, user: str) -> dict | list:
    content = llm_complete(config, system, user, json_mode=True)
    try:
        return extract_json(content)
    except ValueError:
        retry_user = (
            f"{user}\n\nIMPORTANT: Your previous reply was not valid JSON. "
            "Reply with ONLY a single JSON object matching the requested schema."
        )
        content = llm_complete(config, system, retry_user, json_mode=True)
        return extract_json(content)
