"""Агент 5 — Продюсер. Озвучка → підбір кадрів → субтитри → монтаж → обкладинка."""
from __future__ import annotations

import asyncio
import json
import random
import re
import subprocess
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFont

from .common import ASSETS, env, log
from .scriptwriter import Script

AGENT = "Продюсер"
FONT_NAME = "DejaVu Sans"
FONT_FILES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
]


def sh(*args: str) -> str:
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"Команда впала: {' '.join(args[:6])}…\n{r.stderr[-1500:]}")
    return r.stdout


def media_duration(path: Path) -> float:
    out = sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path))
    return float(json.loads(out)["format"]["duration"])


# ---------- 1. Озвучка ----------

def tts(text: str, voice: str, rate: str, out_mp3: Path) -> list[dict]:
    """Озвучує текст безкоштовними голосами Microsoft Edge.
    Повертає таймінги слів: [{word, start, end}] у секундах."""
    import edge_tts

    async def go():
        comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
        words = []
        with open(out_mp3, "wb") as f:
            async for ch in comm.stream():
                if ch["type"] == "audio":
                    f.write(ch["data"])
                elif ch["type"] == "WordBoundary":
                    s = ch["offset"] / 1e7
                    words.append({"word": ch["text"], "start": s, "end": s + ch["duration"] / 1e7})
        return words

    words = asyncio.run(go())
    if not words:  # запасний варіант: рівномірно розподіляємо слова
        dur = media_duration(out_mp3)
        toks = text.split()
        step = dur / max(len(toks), 1)
        words = [{"word": w, "start": i * step, "end": (i + 1) * step} for i, w in enumerate(toks)]
    return words


# ---------- 2. Субтитри ----------

def _ass_time(t: float) -> str:
    h, rem = divmod(max(t, 0), 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def write_ass(words: list[dict], path: Path, cfg: dict) -> None:
    v = cfg["video"]
    n = v.get("subtitle_words", 3)
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {v['width']}
PlayResY: {v['height']}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,{FONT_NAME},92,&H00FFFFFF,&H0000FFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,7,3,2,80,80,620,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    for i in range(0, len(words), n):
        group = words[i:i + n]
        start = group[0]["start"]
        nxt = words[i + n]["start"] if i + n < len(words) else group[-1]["end"] + 0.4
        # ключове (найдовше) слово підсвічуємо жовтим
        key = max(range(len(group)), key=lambda k: len(group[k]["word"]))
        parts = []
        for k, w in enumerate(group):
            t = re.sub(r"[{}\\]", "", w["word"]).upper()
            parts.append(r"{\c&H00E6FF&}" + t + r"{\c&HFFFFFF&}" if k == key and len(group) > 1 else t)
        pop = r"{\fscx85\fscy85\t(0,90,\fscx100\fscy100)}"
        lines.append(f"Dialogue: 0,{_ass_time(start)},{_ass_time(nxt)},Main,,0,0,0,,{pop}{' '.join(parts)}")
    path.write_text(header + "\n".join(lines) + "\n", encoding="utf-8")


# ---------- 3. Кадри (Pexels) ----------

def pexels_search(query: str, used: set[int]) -> list[dict]:
    key = env("PEXELS_API_KEY", required=False)
    if not key:
        return []
    r = requests.get(
        "https://api.pexels.com/videos/search",
        headers={"Authorization": key},
        params={"query": query, "orientation": "portrait", "per_page": 15, "size": "medium"},
        timeout=30,
    )
    if r.status_code != 200:
        log(AGENT, f"Pexels «{query}»: {r.status_code}")
        return []
    out = []
    for v in r.json().get("videos", []):
        if v["id"] in used:
            continue
        files = [f for f in v.get("video_files", [])
                 if f.get("height") and f.get("width") and f["height"] > f["width"] and f["height"] >= 1280]
        if not files:
            continue
        best = min(files, key=lambda f: abs(f["height"] - 1920))
        out.append({"id": v["id"], "url": best["link"], "duration": v.get("duration", 0)})
    return out


def download(url: str, path: Path) -> None:
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(path, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)


def render_segment(src: Path | None, start: float, dur: float, out: Path, cfg: dict) -> None:
    v = cfg["video"]
    W, H, fps = v["width"], v["height"], v["fps"]
    common = ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-r", str(fps)]
    if src is None:  # запасний фон, якщо кадрів не знайшлося
        color = random.choice(["0x1d2b53", "0x3a0ca3", "0x0b3d2e", "0x2b2d42"])
        sh("ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c={color}:s={W}x{H}:r={fps}", "-t", f"{dur:.3f}", *common, str(out))
        return
    # повільний «кен бернс» зум додає динаміки статичним кадрам
    vf = (f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
          f"scale={int(W*1.08)}:{int(H*1.08)},"
          f"crop={W}:{H}:x='(in_w-out_w)/2*(1-t/{dur:.3f})':y='(in_h-out_h)/2',setsar=1,fps={fps}")
    sh("ffmpeg", "-y", "-ss", f"{start:.3f}", "-i", str(src), "-t", f"{dur:.3f}", "-vf", vf, *common, str(out))


def scene_timings(script: Script, words: list[dict], total: float) -> list[tuple[float, float]]:
    """Початок/кінець кожної сцени за таймінгами слів озвучки."""
    counts = [len(s.text.split()) for s in script.scenes]
    starts, idx = [], 0
    for c in counts:
        starts.append(words[min(idx, len(words) - 1)]["start"] if words else 0)
        idx += c
    starts[0] = 0.0
    ends = starts[1:] + [total]
    return list(zip(starts, ends))


# ---------- 4. Монтаж ----------

def build_video(script: Script, words: list[dict], voice: Path, out_dir: Path, cfg: dict) -> Path:
    tmp = out_dir / "_work"
    tmp.mkdir(exist_ok=True)
    total = media_duration(voice) + 0.35
    max_clip = cfg["video"].get("max_clip_seconds", 3.2)
    used: set[int] = set()
    segments: list[Path] = []
    credits: list[str] = []

    for si, (scene, (s, e)) in enumerate(zip(script.scenes, scene_timings(script, words, total))):
        need = e - s
        candidates: list[dict] = []
        for q in scene.search_terms:
            candidates += pexels_search(q, used)
            if len(candidates) >= 4:
                break
        n_cuts = max(1, round(need / max_clip + 0.3))
        part = need / n_cuts
        for ci in range(n_cuts):
            seg = tmp / f"seg_{si:02d}_{ci}.mp4"
            clip = candidates[ci % len(candidates)] if candidates else None
            src = None
            if clip:
                src = tmp / f"pexels_{clip['id']}.mp4"
                if not src.exists():
                    try:
                        download(clip["url"], src)
                    except Exception as ex:  # noqa: BLE001
                        log(AGENT, f"не вдалось завантажити кліп: {ex}")
                        src = None
                used.add(clip["id"])
                credits.append(f"https://www.pexels.com/video/{clip['id']}/")
            start = 0.0
            if src and clip["duration"] > part + 1:
                start = random.uniform(0, min(clip["duration"] - part - 0.5, 6))
            render_segment(src, start, part, seg, cfg)
            segments.append(seg)
        log(AGENT, f"сцена {si + 1}/{len(script.scenes)}: {n_cuts} кадр(ів), {need:.1f}с")

    concat = tmp / "concat.txt"
    concat.write_text("".join(f"file '{p.resolve()}'\n" for p in segments))
    joined = tmp / "joined.mp4"
    sh("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", str(joined))

    ass = tmp / "subs.ass"
    write_ass(words, ass, cfg)

    music = sorted((ASSETS / "music").glob("*.mp3"))
    final = out_dir / "video.mp4"
    inputs = ["-i", str(joined), "-i", str(voice)]
    if music:
        track = random.choice(music)
        vol = cfg["video"].get("music_volume", 0.12)
        inputs += ["-stream_loop", "-1", "-i", str(track)]
        afilter = f"[2:a]volume={vol}[m];[1:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]"
        log(AGENT, f"музика: {track.name}")
    else:
        afilter = "[1:a]anull[a]"
    sub_path = str(ass).replace("\\", "/").replace(":", r"\:")
    sh("ffmpeg", "-y", *inputs,
       "-filter_complex", f"[0:v]ass='{sub_path}'[v];{afilter}",
       "-map", "[v]", "-map", "[a]", "-t", f"{total:.3f}",
       "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(final))

    (out_dir / "credits.txt").write_text(
        "Stock footage (Pexels, free license):\n" + "\n".join(dict.fromkeys(credits)) + "\n", encoding="utf-8")
    return final


# ---------- 5. Обкладинка ----------

def make_cover(video: Path, text: str, out: Path) -> None:
    frame = out.with_suffix(".frame.jpg")
    sh("ffmpeg", "-y", "-ss", "1.0", "-i", str(video), "-frames:v", "1", "-q:v", "2", str(frame))
    img = Image.open(frame).convert("RGB")
    W, H = img.size
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(overlay).rectangle([0, int(H * 0.30), W, int(H * 0.62)], fill=(0, 0, 0, 120))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)
    font_path = next((p for p in FONT_FILES if Path(p).exists()), None)

    words, lines = text.upper().split(), []
    size = 150
    while size > 60:
        font = ImageFont.truetype(font_path, size) if font_path else ImageFont.load_default()
        lines, cur = [], ""
        for w in words:
            test = (cur + " " + w).strip()
            if draw.textlength(test, font=font) <= W * 0.86:
                cur = test
            else:
                lines.append(cur)
                cur = w
        lines.append(cur)
        if len(lines) <= 3:
            break
        size -= 10
    y = int(H * 0.46) - len(lines) * size * 0.6
    for ln in lines:
        x = (W - draw.textlength(ln, font=font)) / 2
        draw.text((x, y), ln, font=font, fill=(255, 230, 0), stroke_width=8, stroke_fill=(0, 0, 0))
        y += size * 1.15
    img.save(out, quality=92)
    frame.unlink(missing_ok=True)


def run(cfg: dict, script: Script, out_dir: Path, voice_fn=tts) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    narration = " ".join(s.text.strip() for s in script.scenes)
    voice = out_dir / "_voice.mp3"
    log(AGENT, "озвучую…")
    words = voice_fn(narration, cfg["voice"]["name"], cfg["voice"].get("rate", "+0%"), voice)
    log(AGENT, f"озвучка: {media_duration(voice):.1f}с, {len(words)} слів")
    video = build_video(script, words, voice, out_dir, cfg)
    make_cover(out_dir / "_work" / "joined.mp4", script.cover_text, out_dir / "cover.jpg")  # кадр без субтитрів
    # прибираємо тимчасові файли
    for p in (out_dir / "_work").glob("*"):
        p.unlink()
    (out_dir / "_work").rmdir()
    voice.unlink(missing_ok=True)
    dur = media_duration(video)
    log(AGENT, f"відео готове: {video.name}, {dur:.1f}с")
    return {"video": str(video), "duration": round(dur, 1)}
