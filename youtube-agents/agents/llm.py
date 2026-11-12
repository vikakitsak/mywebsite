"""Мовні моделі для агентів. За замовчуванням — безкоштовно:
Google Gemini (основна) → Groq (запасна). Claude — платна опція.

Порядок задається в config.yaml → llm.providers. Провайдер без ключа пропускається.
"""
from __future__ import annotations

import json
import os
import re
import time
from typing import TypeVar

import requests
from pydantic import BaseModel, ValidationError

from .common import _strict_schema, log

T = TypeVar("T", bound=BaseModel)
AGENT = "ШІ"

KEYS = {"gemini": "GEMINI_API_KEY", "groq": "GROQ_API_KEY", "claude": "ANTHROPIC_API_KEY"}
_model_cache: dict[str, str] = {}


def _json_instructions(schema: type[BaseModel]) -> str:
    return ("\n\nRespond with ONLY a valid JSON object (no markdown, no comments) that matches "
            "this JSON Schema exactly, filling every field:\n"
            + json.dumps(_strict_schema(schema), ensure_ascii=False))


def _extract_json(text: str) -> str:
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    return text[start:end + 1] if start != -1 and end != -1 else text


def _post(url: str, **kw) -> dict:
    for attempt in range(3):
        r = requests.post(url, timeout=180, **kw)
        if r.status_code in (429, 500, 502, 503, 504) and attempt < 2:
            wait = 20 * (attempt + 1)
            log(AGENT, f"{r.status_code}, чекаю {wait}с і пробую ще раз…")
            time.sleep(wait)
            continue
        if r.status_code != 200:
            raise RuntimeError(f"{r.status_code}: {r.text[:400]}")
        return r.json()
    raise RuntimeError("не вдалося після повторів")


# ---------- Google Gemini (безкоштовний рівень) ----------

def _gemini_model(key: str, wanted: str) -> str:
    """'auto' → найновіша доступна Flash-модель (вони мають безкоштовний ліміт)."""
    if wanted != "auto":
        return wanted
    if "gemini" in _model_cache:
        return _model_cache["gemini"]
    r = requests.get("https://generativelanguage.googleapis.com/v1beta/models",
                     params={"pageSize": 200}, headers={"x-goog-api-key": key}, timeout=30)
    r.raise_for_status()
    names = []
    for m in r.json().get("models", []):
        name = m["name"].split("/")[-1]
        if ("generateContent" in m.get("supportedGenerationMethods", [])
                and re.fullmatch(r"gemini-(\d+(?:\.\d+)?)-flash", name)):
            names.append((float(re.search(r"\d+(?:\.\d+)?", name).group()), name))
    model = max(names)[1] if names else "gemini-2.5-flash"
    _model_cache["gemini"] = model
    return model


def _ask_gemini(system: str, prompt: str, schema, cfg: dict) -> str:
    key = os.environ["GEMINI_API_KEY"]
    model = _gemini_model(key, cfg.get("gemini_model", "auto"))
    log(AGENT, f"Gemini ({model})")
    data = _post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        headers={"x-goog-api-key": key, "Content-Type": "application/json"},
        json={
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": prompt + _json_instructions(schema)}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.9},
        },
    )
    cands = data.get("candidates") or []
    if not cands or "content" not in cands[0]:
        raise RuntimeError(f"порожня відповідь: {json.dumps(data)[:300]}")
    return "".join(p.get("text", "") for p in cands[0]["content"]["parts"] if not p.get("thought"))


# ---------- Groq (безкоштовний рівень, OpenAI-сумісний) ----------

GROQ_PREFERRED = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "moonshotai/kimi-k2-instruct"]


def _groq_model(key: str, wanted: str) -> str:
    if wanted != "auto":
        return wanted
    if "groq" in _model_cache:
        return _model_cache["groq"]
    r = requests.get("https://api.groq.com/openai/v1/models",
                     headers={"Authorization": f"Bearer {key}"}, timeout=30)
    r.raise_for_status()
    available = [m["id"] for m in r.json().get("data", [])]
    model = next((m for m in GROQ_PREFERRED if m in available), None) or next(
        m for m in available if not re.search(r"whisper|guard|tts|embed|compound", m))
    _model_cache["groq"] = model
    return model


def _ask_groq(system: str, prompt: str, schema, cfg: dict) -> str:
    key = os.environ["GROQ_API_KEY"]
    model = _groq_model(key, cfg.get("groq_model", "auto"))
    log(AGENT, f"Groq ({model})")
    data = _post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}"},
        json={
            "model": model,
            "messages": [{"role": "system", "content": system},
                         {"role": "user", "content": prompt + _json_instructions(schema)}],
            "response_format": {"type": "json_object"},
            "temperature": 0.9,
        },
    )
    return data["choices"][0]["message"]["content"]


# ---------- Claude (платно, найвища якість) ----------

def _ask_claude(system: str, prompt: str, schema, cfg: dict) -> str:
    import anthropic

    client = anthropic.Anthropic()
    log(AGENT, f"Claude ({cfg.get('claude_model', 'claude-opus-5-5')})")
    with client.beta.messages.stream(
        model=cfg.get("claude_model", "claude-opus-5-5"),
        max_tokens=32000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        system=system,
        messages=[{"role": "user", "content": prompt}],
        output_config={
            "effort": cfg.get("claude_effort", "high"),
            "format": {"type": "json_schema", "schema": _strict_schema(schema)},
        },
    ) as stream:
        msg = stream.get_final_message()
    if msg.stop_reason in ("refusal", "max_tokens"):
        raise RuntimeError(f"Claude: stop_reason={msg.stop_reason}")
    return "".join(b.text for b in msg.content if b.type == "text")


PROVIDERS = {"gemini": _ask_gemini, "groq": _ask_groq, "claude": _ask_claude}


def ask(system: str, prompt: str, schema: type[T], cfg: dict) -> T:
    """Пробує провайдерів по черзі; повертає валідований об'єкт pydantic."""
    llm = cfg.get("llm", {})
    order = [p for p in llm.get("providers", ["gemini", "groq"]) if os.environ.get(KEYS.get(p, ""), "").strip()]
    if not order:
        raise SystemExit("Немає жодного ключа ШІ. Додайте секрет GEMINI_API_KEY (безкоштовно: aistudio.google.com).")
    errors = []
    for provider in order:
        for attempt in range(2):  # друга спроба — якщо модель повернула кривий JSON
            try:
                text = PROVIDERS[provider](system, prompt, schema, llm)
                return schema.model_validate_json(_extract_json(text))
            except (ValidationError, ValueError) as ex:
                errors.append(f"{provider}: невалідний JSON ({str(ex)[:150]})")
                log(AGENT, f"{provider}: невалідна відповідь, спроба {attempt + 2}…")
            except Exception as ex:  # noqa: BLE001
                errors.append(f"{provider}: {str(ex)[:300]}")
                log(AGENT, f"{provider} недоступний: {str(ex)[:200]} → пробую наступного")
                break
    raise RuntimeError("Усі моделі не впоралися:\n" + "\n".join(errors))
