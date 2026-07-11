"""Resolve and run LLM requests via LiteLLM."""

import json
import os
import re

import litellm
from pydantic import BaseModel

from app.config import settings
from app.services.api_key_detect import detect_provider_from_key
from app.services.llm_types import DEFAULT_MODELS, LLMProvider

litellm.suppress_debug_info = True


class LLMConfig(BaseModel):
    provider: LLMProvider = LLMProvider.AUTO
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    temperature: float = 0.2
    max_tokens: int = 8192
    workspace_path: str | None = None


def resolve_llm_config(config: LLMConfig) -> LLMConfig:
    """Pick provider/model from key when user chose Auto."""
    provider = config.provider
    if provider in (LLMProvider.AUTO, None):
        detected = detect_provider_from_key(config.api_key)
        if detected:
            provider = detected
        elif config.api_key:
            if config.model and "/" in config.model:
                provider = LLMProvider.CUSTOM
            else:
                raise ValueError(
                    "Could not detect provider from this API key. "
                    "Open Advanced and pick your provider (Groq, OpenAI, etc.), "
                    "or enter a LiteLLM model like groq/llama-3.1-8b-instant."
                )
        else:
            provider = LLMProvider.OLLAMA

    if provider == LLMProvider.CUSTOM and (not config.model or "/" not in config.model):
        raise ValueError(
            "Custom provider requires a model in provider/model format "
            "(e.g. groq/llama-3.1-8b-instant, deepseek/deepseek-chat)."
        )

    model = config.model or DEFAULT_MODELS.get(provider)
    return config.model_copy(update={"provider": provider, "model": model})


def _configured_key_for_provider(config: LLMConfig) -> str | None:
    if config.api_key:
        return config.api_key
    if config.provider == LLMProvider.OPENAI:
        return os.getenv("OPENAI_API_KEY")
    if config.provider == LLMProvider.ANTHROPIC:
        return os.getenv("ANTHROPIC_API_KEY")
    if config.provider == LLMProvider.GEMINI:
        return os.getenv("GEMINI_API_KEY")
    if config.provider == LLMProvider.OPENROUTER:
        return os.getenv("OPENROUTER_API_KEY")
    if config.provider == LLMProvider.GROQ:
        return os.getenv("GROQ_API_KEY")
    if config.provider == LLMProvider.DEEPSEEK:
        return os.getenv("DEEPSEEK_API_KEY")
    if config.provider == LLMProvider.MISTRAL:
        return os.getenv("MISTRAL_API_KEY")
    return None


def _assert_provider_credentials(config: LLMConfig) -> None:
    if config.provider == LLMProvider.OLLAMA:
        return
    if _configured_key_for_provider(config):
        return
    raise ValueError(
        f"{config.provider.value.title()} API key missing. Paste your key above "
        "or configure it in backend environment variables."
    )


def _resolve_model(config: LLMConfig) -> str:
    if config.provider == LLMProvider.CUSTOM:
        return config.model or DEFAULT_MODELS[LLMProvider.CUSTOM]

    model = config.model or DEFAULT_MODELS[config.provider]
    if config.provider == LLMProvider.OLLAMA and not model.startswith("ollama/"):
        return f"ollama/{model}"
    if config.provider == LLMProvider.GEMINI and not model.startswith("gemini/"):
        return f"gemini/{model}"
    if config.provider == LLMProvider.ANTHROPIC and not model.startswith("anthropic/"):
        return f"anthropic/{model.removeprefix('anthropic/')}"
    if config.provider == LLMProvider.OPENROUTER and not model.startswith("openrouter/"):
        return f"openrouter/{model.removeprefix('openrouter/')}"
    if config.provider == LLMProvider.GROQ and not model.startswith("groq/"):
        return f"groq/{model.removeprefix('groq/')}"
    if config.provider == LLMProvider.DEEPSEEK and not model.startswith("deepseek/"):
        return f"deepseek/{model.removeprefix('deepseek/')}"
    if config.provider == LLMProvider.MISTRAL and not model.startswith("mistral/"):
        return f"mistral/{model.removeprefix('mistral/')}"
    if config.provider == LLMProvider.OPENAI and not model.startswith("openai/"):
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
        elif config.provider == LLMProvider.GROQ:
            os.environ["GROQ_API_KEY"] = config.api_key
        elif config.provider == LLMProvider.DEEPSEEK:
            os.environ["DEEPSEEK_API_KEY"] = config.api_key
        elif config.provider == LLMProvider.MISTRAL:
            os.environ["MISTRAL_API_KEY"] = config.api_key

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
    config = resolve_llm_config(config)
    _assert_provider_credentials(config)
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
        "timeout": 120,
    }

    if json_mode and config.provider in (
        LLMProvider.OPENAI,
        LLMProvider.GEMINI,
        LLMProvider.OPENROUTER,
        LLMProvider.GROQ,
        LLMProvider.DEEPSEEK,
    ):
        kwargs["response_format"] = {"type": "json_object"}

    if config.api_key:
        kwargs["api_key"] = config.api_key

    if config.provider == LLMProvider.OPENROUTER:
        kwargs["extra_headers"] = {
            "HTTP-Referer": settings.frontend_url,
            "X-Title": settings.app_name,
        }

    try:
        response = litellm.completion(**kwargs)
    except OSError as exc:
        if getattr(exc, "winerror", None) == 10038 or "10038" in str(exc):
            raise ValueError(
                "Windows socket error while calling the LLM. Restart the backend "
                "(try: uvicorn app.main:app --port 8000 without --reload), then retry."
            ) from exc
        raise
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
