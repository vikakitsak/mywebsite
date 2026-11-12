"""Агент 2 — Аналітик вашого каналу.

Бере публічну статистику ваших відео (перегляди, лайки, коментарі) і зіставляє
з історією агентів: яка ніша/тема/хук спрацювали, а які — ні.
Працює, коли задано YOUTUBE_CHANNEL_ID і на каналі вже є відео.
"""
from __future__ import annotations

from .common import DATA, env, log, read_json, write_json, now_utc
from .trends import _get, _parse_ts, fetch_video_details, parse_duration

AGENT = "Канал"


def run(cfg: dict) -> dict:
    channel_id = env("YOUTUBE_CHANNEL_ID", required=False)
    if not channel_id:
        log(AGENT, "YOUTUBE_CHANNEL_ID не задано — пропускаю аналіз каналу")
        return {"available": False, "reason": "channel id not set"}

    ch = _get("channels", part="statistics,contentDetails,snippet", id=channel_id)
    if not ch.get("items"):
        return {"available": False, "reason": "channel not found"}
    info = ch["items"][0]
    stats = info["statistics"]
    uploads = info["contentDetails"]["relatedPlaylists"]["uploads"]

    ids, token = [], None
    while len(ids) < 100:
        params = {"part": "contentDetails", "playlistId": uploads, "maxResults": 50}
        if token:
            params["pageToken"] = token
        page = _get("playlistItems", **params)
        ids += [it["contentDetails"]["videoId"] for it in page.get("items", [])]
        token = page.get("nextPageToken")
        if not token:
            break

    details = fetch_video_details(ids)
    history = read_json(DATA / "history.json", [])
    by_title = {h["title"].strip().lower(): h for h in history}
    by_id = {h["youtube_id"]: h for h in history if h.get("youtube_id")}

    videos = []
    for vid, v in details.items():
        st = v.get("statistics", {})
        views = int(st.get("viewCount", 0))
        age_h = max((now_utc() - _parse_ts(v["snippet"]["publishedAt"])).total_seconds() / 3600, 1)
        title = v["snippet"]["title"]
        h = by_id.get(vid) or by_title.get(title.strip().lower())
        likes = int(st.get("likeCount", 0))
        videos.append({
            "id": vid,
            "title": title,
            "published": v["snippet"]["publishedAt"][:10],
            "age_days": round(age_h / 24, 1),
            "views": views,
            "likes": likes,
            "comments": int(st.get("commentCount", 0)),
            "like_rate_pct": round(100 * likes / views, 2) if views else 0,
            "duration_sec": parse_duration(v["contentDetails"].get("duration", "")),
            "niche": h["niche"] if h else None,
            "hook": h.get("hook") if h else None,
        })
    videos.sort(key=lambda x: x["views"], reverse=True)

    # Середні перегляди по нішах (тільки відео, зроблені агентами)
    niche_perf: dict[str, list[int]] = {}
    for v in videos:
        if v["niche"] and v["age_days"] >= 2:
            niche_perf.setdefault(v["niche"], []).append(v["views"])

    report = {
        "available": True,
        "generated_at": now_utc().isoformat(),
        "title": info["snippet"]["title"],
        "subscribers": int(stats.get("subscriberCount", 0)),
        "total_views": int(stats.get("viewCount", 0)),
        "video_count": int(stats.get("videoCount", 0)),
        "avg_views": round(sum(v["views"] for v in videos) / len(videos)) if videos else 0,
        "niche_avg_views": {k: round(sum(x) / len(x)) for k, x in niche_perf.items()},
        "best": videos[:5],
        "worst": [v for v in videos if v["age_days"] >= 2][-5:],
        "recent": sorted(videos, key=lambda x: x["published"], reverse=True)[:10],
    }
    write_json(DATA / "channel_report.json", report)
    log(AGENT, f"{report['title']}: {report['subscribers']} підписників, {len(videos)} відео")
    return report


def summarize_for_llm(rep: dict) -> str:
    if not rep.get("available"):
        return "Channel analytics not available yet (new channel or no channel id). Optimize purely for trends."
    def fmt(v):
        return (f"- \"{v['title']}\" — {v['views']:,} views, {v['like_rate_pct']}% likes, "
                f"{v['age_days']}d old, niche={v['niche']}, hook={v['hook']!r}")
    parts = [
        f"Channel: {rep['title']} — {rep['subscribers']:,} subs, {rep['video_count']} videos, "
        f"avg {rep['avg_views']:,} views/video.",
        f"Average views by niche (our videos, >=2 days old): {rep['niche_avg_views'] or 'not enough data'}",
        "Best videos:", *map(fmt, rep["best"]),
        "Weakest videos:", *map(fmt, rep["worst"]),
    ]
    return "\n".join(parts)
