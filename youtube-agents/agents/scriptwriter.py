"""Агент 4 — Сценарист. Пише сценарій, назву, опис, теги, текст для обкладинки."""
from __future__ import annotations

from pydantic import BaseModel, Field

from .common import log
from .llm import ask
from .strategist import VideoIdea

AGENT = "Сценарист"


class Scene(BaseModel):
    text: str = Field(description="exact voiceover words for this scene (1-2 short sentences)")
    search_terms: list[str] = Field(
        description="2-3 concrete English stock-footage queries that visually match (e.g. 'astronaut floating', 'night sky timelapse')")


class Script(BaseModel):
    title_options: list[str] = Field(description="3 title options, <= 60 chars, curiosity-driven but honest")
    title: str = Field(description="best title from the options")
    scenes: list[Scene]
    description: str = Field(description="2-3 sentence YouTube description + call to subscribe")
    hashtags: list[str] = Field(description="3-5 hashtags incl. #shorts")
    tags: list[str] = Field(description="10-15 search tags")
    cover_text: str = Field(description="2-5 word punchy text for the cover image, uppercase")
    pinned_comment: str = Field(description="a question to spark comments")
    fact_check_notes_uk: str = Field(
        description="українською: які твердження варто перевірити перед публікацією (якщо є)")


SYSTEM = """You are an elite YouTube Shorts scriptwriter. You write voiceover scripts that hold attention
to the last second.

Rules:
- Total voiceover: 95-140 words (~35-55 s). Short punchy sentences. Spoken, conversational English.
- Scene 1 is the HOOK: a bold, specific claim or question in under 12 words. No "Did you know",
  no "In this video", no greetings.
- Every 2-3 sentences add a new surprise or escalation (open loops). Deliver the payoff near the end.
- End with a quick line that loops back to the start or invites a comment — not a long outro.
- Only state facts you are confident are true. No fabricated numbers or quotes.
- 6-10 scenes. Each scene's search_terms must be visually concrete and likely to exist on Pexels
  stock footage (no specific celebrities, brands, or logos).
- Write naturally for text-to-speech: spell out symbols, avoid emojis and abbreviations in the voiceover."""


def run(cfg: dict, idea: VideoIdea) -> Script:
    prompt = f"""Write the Short.
Niche: {idea.niche}
Topic: {idea.topic}
Angle: {idea.angle}
Hook idea: {idea.hook_idea}
Target length: {idea.target_length_sec} seconds
Proven-demand references (do NOT copy): {'; '.join(idea.inspired_by)}"""
    log(AGENT, f"пишу сценарій: {idea.topic}")
    script = ask(SYSTEM, prompt, Script, cfg)
    words = sum(len(s.text.split()) for s in script.scenes)
    log(AGENT, f"готово: «{script.title}», {len(script.scenes)} сцен, {words} слів")
    return script
