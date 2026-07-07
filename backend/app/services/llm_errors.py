"""User-friendly LLM error messages."""

import re


def format_llm_error(exc: Exception) -> str:
    msg = str(exc)

    if "RateLimitError" in type(exc).__name__ or "429" in msg or "RESOURCE_EXHAUSTED" in msg:
        if "gemini" in msg.lower():
            return (
                "Gemini API quota exceeded. Wait ~30s and retry, enable billing at "
                "https://ai.google.dev, or switch to Ollama (local, free)."
            )
        return "LLM rate limit hit. Wait a moment and retry, or switch provider."

    if "AuthenticationError" in type(exc).__name__ or "401" in msg or "invalid api key" in msg.lower():
        if "openrouter" in msg.lower():
            return "Invalid OpenRouter API key. Create one at https://openrouter.ai/keys"
        if "groq" in msg.lower():
            return "Invalid Groq API key. Create one at https://console.groq.com/keys"
        if "cursor" in msg.lower() or "crsr_" in msg.lower():
            return "Invalid Cursor API key. Create one at https://cursor.com/dashboard/integrations"
        return "Invalid API key. Check your key in the provider dashboard."

    if "credit balance is too low" in msg.lower() or "purchase credits" in msg.lower():
        return (
            "Anthropic account has no credits. Add billing at https://console.anthropic.com/settings/billing, "
            "or switch the Agent panel to Ollama (free, local) or another provider."
        )

    if "insufficient" in msg.lower() and "quota" in msg.lower():
        return "Provider quota or credits exhausted. Add billing or switch to Ollama."

    if "Connection" in type(exc).__name__ or "ollama" in msg.lower():
        return (
            "Cannot reach Ollama. Run `ollama serve` and `ollama pull llama3.2`, "
            "or pick a cloud provider."
        )

    if "10038" in msg or "not a socket" in msg.lower():
        return (
            "Windows socket error while calling the LLM. Restart the backend "
            "(try without --reload), then retry. If it keeps happening, switch provider "
            "or update: pip install -U litellm httpx"
        )

    if "valid JSON" in msg or "empty response" in msg:
        return msg

    # Trim huge JSON blobs from provider errors
    if len(msg) > 300:
        short = re.sub(r"\{[\s\S]*\}", "", msg).strip()
        return short[:300] if short else msg[:300]

    return msg
