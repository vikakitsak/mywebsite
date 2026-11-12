"""Агент 6 — Публікатор (за бажанням). Завантажує відео на YouTube як приватне.

Потрібні секрети YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN
(див. README → «Автозавантаження»). Увімкнення: publish.enabled: true у config.yaml.
"""
from __future__ import annotations

import json
from pathlib import Path

import requests

from .common import env, log
from .scriptwriter import Script

AGENT = "Публікатор"


def _access_token() -> str:
    r = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": env("YT_CLIENT_ID"),
        "client_secret": env("YT_CLIENT_SECRET"),
        "refresh_token": env("YT_REFRESH_TOKEN"),
        "grant_type": "refresh_token",
    }, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def run(cfg: dict, script: Script, video: Path) -> str | None:
    pcfg = cfg.get("publish", {})
    if not pcfg.get("enabled"):
        return None
    token = _access_token()
    tags = " ".join(script.hashtags)
    meta = {
        "snippet": {
            "title": script.title[:100],
            "description": f"{script.description}\n\n{tags}"[:4900],
            "tags": script.tags[:30],
            "categoryId": "27",  # Education
            "defaultLanguage": cfg["channel"].get("language", "en"),
            "defaultAudioLanguage": cfg["channel"].get("language", "en"),
        },
        "status": {
            "privacyStatus": pcfg.get("privacy", "private"),
            "selfDeclaredMadeForKids": False,
        },
    }
    size = video.stat().st_size
    init = requests.post(
        "https://www.googleapis.com/upload/youtube/v3/videos",
        params={"uploadType": "resumable", "part": "snippet,status"},
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json",
                 "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": str(size)},
        data=json.dumps(meta), timeout=60,
    )
    init.raise_for_status()
    with open(video, "rb") as f:
        up = requests.put(init.headers["Location"], data=f,
                          headers={"Authorization": f"Bearer {token}", "Content-Type": "video/mp4"}, timeout=600)
    up.raise_for_status()
    vid = up.json()["id"]
    log(AGENT, f"завантажено ({meta['status']['privacyStatus']}): https://youtube.com/shorts/{vid}")
    return vid
