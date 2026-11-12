"""Агент 1 — Аналітик трендів.

Шукає Shorts, які зараз набирають перегляди в кожній ніші (YouTube Data API v3),
і рахує, наскільки кожне відео «вистрілило» відносно розміру каналу.
"""
from __future__ import annotations

import re
from datetime import timedelta

import requests

from .common import DATA, env, log, now_utc, write_json

API = "https://www.googleapis.com/youtube/v3"
AGENT = "Тренди"


def _get(endpoint: str, **params) -> dict:
    params["key"] = env("YOUTUBE_API_KEY")
    r = requests.get(f"{API}/{endpoint}", params=params, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"YouTube API {endpoint}: {r.status_code} {r.text[:300]}")
    return r.json()


def parse_duration(iso: str) -> int:
    m = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return 0
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def _chunks(items: list, n: int = 50):
    for i in range(0, len(items), n):
        yield items[i:i + n]


def fetch_video_details(ids: list[str]) -> dict[str, dict]:
    out = {}
    for chunk in _chunks(ids):
        data = _get("videos", part="snippet,statistics,contentDetails", id=",".join(chunk))
        for it in data.get("items", []):
            out[it["id"]] = it
    return out


def fetch_channel_subs(ids: list[str]) -> dict[str, int]:
    out = {}
    for chunk in _chunks(list(set(ids))):
        data = _get("channels", part="statistics", id=",".join(chunk))
        for it in data.get("items", []):
            st = it.get("statistics", {})
            out[it["id"]] = 0 if st.get("hiddenSubscriberCount") else int(st.get("subscriberCount", 0))
    return out


def run(cfg: dict) -> dict:
    tcfg = cfg.get("trends", {})
    ch = cfg.get("channel", {})
    since = (now_utc() - timedelta(days=tcfg.get("days_back", 7))).strftime("%Y-%m-%dT%H:%M:%SZ")
    max_dur = tcfg.get("max_duration_sec", 180)

    report = {"generated_at": now_utc().isoformat(), "niches": {}}
    for niche_id, niche in cfg["niches"].items():
        ids: dict[str, str] = {}
        for kw in niche["keywords"]:
            log(AGENT, f"{niche['name']}: шукаю «{kw}»")
            data = _get(
                "search", part="snippet", q=kw, type="video", videoDuration="short",
                order="viewCount", publishedAfter=since,
                maxResults=tcfg.get("results_per_keyword", 25),
                relevanceLanguage=ch.get("language", "en"), regionCode=ch.get("region", "US"),
            )
            for it in data.get("items", []):
                ids.setdefault(it["id"]["videoId"], kw)

        details = fetch_video_details(list(ids))
        subs = fetch_channel_subs([v["snippet"]["channelId"] for v in details.values()])

        videos = []
        for vid, v in details.items():
            dur = parse_duration(v["contentDetails"].get("duration", ""))
            if dur == 0 or dur > max_dur:
                continue
            st = v.get("statistics", {})
            views = int(st.get("viewCount", 0))
            published = v["snippet"]["publishedAt"]
            age_h = max((now_utc() - _parse_ts(published)).total_seconds() / 3600, 1)
            ch_subs = subs.get(v["snippet"]["channelId"], 0)
            videos.append({
                "id": vid,
                "url": f"https://youtube.com/shorts/{vid}",
                "title": v["snippet"]["title"],
                "channel": v["snippet"]["channelTitle"],
                "channel_subs": ch_subs,
                "keyword": ids[vid],
                "views": views,
                "likes": int(st.get("likeCount", 0)),
                "comments": int(st.get("commentCount", 0)),
                "duration_sec": dur,
                "age_hours": round(age_h, 1),
                "views_per_hour": round(views / age_h),
                # «Аутлаєр»: у скільки разів перегляди більші за кількість підписників.
                # Високе значення = тема/подача сама по собі цікава людям, а не лише аудиторії каналу.
                "outlier_score": round(views / max(ch_subs, 1000), 2),
                "tags": (v["snippet"].get("tags") or [])[:10],
            })

        # Головний рейтинг: швидкість росту × «аутлаєрність»
        for x in videos:
            x["trend_score"] = round(x["views_per_hour"] * min(x["outlier_score"], 50) ** 0.5)
        videos.sort(key=lambda x: x["trend_score"], reverse=True)

        report["niches"][niche_id] = {
            "name": niche["name"],
            "videos_analyzed": len(videos),
            "avg_duration_sec": round(sum(x["duration_sec"] for x in videos) / len(videos)) if videos else 0,
            "top": videos[:20],
        }
        log(AGENT, f"{niche['name']}: проаналізовано {len(videos)} Shorts")

    write_json(DATA / "latest_trends.json", report)
    return report


def _parse_ts(s: str):
    from datetime import datetime
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def summarize_for_llm(report: dict, per_niche: int = 15) -> str:
    lines = []
    for nid, n in report["niches"].items():
        lines.append(f"\n## Niche `{nid}` — {n['name']} (analyzed {n['videos_analyzed']} Shorts, "
                     f"avg duration {n['avg_duration_sec']}s)")
        for i, v in enumerate(n["top"][:per_niche], 1):
            lines.append(
                f"{i}. \"{v['title']}\" — {v['views']:,} views in {v['age_hours']:.0f}h "
                f"({v['views_per_hour']:,}/h), channel subs {v['channel_subs']:,}, "
                f"outlier x{v['outlier_score']}, {v['duration_sec']}s"
            )
    return "\n".join(lines)
