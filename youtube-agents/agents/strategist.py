"""Агент 3 — Стратег. Вибирає, яке відео робити наступним і чому."""
from __future__ import annotations

from pydantic import BaseModel, Field

from .common import ask_claude, log
from . import channel as channel_agent
from . import trends as trends_agent

AGENT = "Стратег"


class VideoIdea(BaseModel):
    niche: str = Field(description="niche id from the list, e.g. 'facts'")
    topic: str = Field(description="specific video topic in English")
    angle: str = Field(description="the unique angle / twist that makes it better than existing videos")
    hook_idea: str = Field(description="first 1-2 seconds: what is said/shown to stop the scroll")
    target_length_sec: int
    inspired_by: list[str] = Field(description="titles of trending videos that prove demand")
    why_uk: str = Field(description="пояснення українською: чому ця тема зараз (дані, логіка)")


class Strategy(BaseModel):
    market_summary_uk: str = Field(description="коротко українською: що зараз працює в кожній ніші")
    channel_insights_uk: str = Field(description="українською: висновки з аналітики каналу і що змінити")
    ideas: list[VideoIdea]


SYSTEM = """You are the head of strategy for a new faceless English-language YouTube Shorts channel.
Goal: grow subscribers and reach YouTube Partner Program as fast as possible WITHOUT producing
generic low-effort content (YouTube demonetizes mass-produced, repetitive "inauthentic" content).

Principles:
- Prefer topics with proven demand (trending outliers on small channels) but find a fresh angle;
  never copy a video.
- Each video must deliver one clear, surprising, specific payoff. Specific > generic.
- The channel covers several niches for now. Early on, test niches fairly; once our own channel
  data shows a niche/format clearly outperforms, lean into it (recommend focusing).
- Avoid topics needing real footage of specific people/events we cannot show with stock video.
- Avoid medical/financial claims that could be harmful; no clickbait lies, no fabricated facts.
- Do not repeat topics we already made.
Write the *_uk fields in Ukrainian (the channel owner reads Ukrainian); everything else in English."""


def run(cfg: dict, trends: dict, channel: dict, history: list[dict]) -> Strategy:
    n = cfg.get("videos_per_run", 1)
    recent = "\n".join(f"- [{h['niche']}] {h['title']}" for h in history[-40:]) or "none yet"
    prompt = f"""Niches (id — name): {', '.join(f'{k} — {v["name"]}' for k, v in cfg['niches'].items())}

# Trending Shorts right now (last {cfg['trends']['days_back']} days, region {cfg['channel']['region']})
{trends_agent.summarize_for_llm(trends)}

# Our channel analytics
{channel_agent.summarize_for_llm(channel)}

# Topics we already made (do not repeat)
{recent}

Pick the {n} best next video idea(s). Aim for 35-55 second Shorts."""
    log(AGENT, "аналізую дані та вибираю тему…")
    strategy = ask_claude(SYSTEM, prompt, Strategy, cfg)
    strategy.ideas = strategy.ideas[:n]
    for i in strategy.ideas:
        log(AGENT, f"тема: [{i.niche}] {i.topic}")
    return strategy
