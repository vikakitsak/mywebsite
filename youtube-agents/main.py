"""Диригент: запускає агентів по черзі і складає все в одну папку.

  python main.py              # повний цикл: тренди → канал → стратегія → сценарій → відео
  python main.py --trends     # тільки звіт про тренди
  python main.py --topic "..."  # пропустити вибір теми і зробити відео на свою тему
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime

from agents import channel, producer, publisher, scriptwriter, strategist, trends
from agents.common import DATA, OUTPUT, load_config, log, read_json, slugify, write_json
from agents.strategist import Strategy, VideoIdea


def write_package(out_dir, idea: VideoIdea, script, strategy: Strategy, result: dict, yt_id) -> None:
    write_json(out_dir / "script.json", script.model_dump())
    upload = f"""TITLE:
{script.title}

DESCRIPTION:
{script.description}

{' '.join(script.hashtags)}

TAGS (через кому):
{', '.join(script.tags)}

PINNED COMMENT:
{script.pinned_comment}
"""
    (out_dir / "upload.txt").write_text(upload, encoding="utf-8")

    scenes = "\n".join(f"{i}. {s.text}" for i, s in enumerate(script.scenes, 1))
    report = f"""# {script.title}

**Ніша:** {idea.niche}  ·  **Тривалість:** {result['duration']} с  ·  **Дата:** {datetime.now():%Y-%m-%d}
{f"**YouTube (приватне):** https://youtube.com/shorts/{yt_id}" if yt_id else ""}

## Чому ця тема
{idea.why_uk}

**Кут подачі:** {idea.angle}
**Натхнення (доведений попит):** {'; '.join(idea.inspired_by)}

## Що зараз працює на ринку
{strategy.market_summary_uk}

## Висновки по вашому каналу
{strategy.channel_insights_uk}

## Варіанти назви
{chr(10).join('- ' + t for t in script.title_options)}

## Сценарій
{scenes}

## Перевірити перед публікацією
{script.fact_check_notes_uk or '—'}

## Чекліст публікації
- [ ] Переглянути відео до кінця
- [ ] Скопіювати назву, опис і теги з `upload.txt`
- [ ] Закріпити коментар із `upload.txt`
- [ ] Через 48 годин агенти самі врахують результат цього відео
"""
    (out_dir / "report.md").write_text(report, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--trends", action="store_true", help="тільки зібрати тренди")
    ap.add_argument("--topic", help="своя тема (пропускає стратега)")
    ap.add_argument("--niche", default="facts", help="ніша для --topic")
    args = ap.parse_args()

    cfg = load_config()
    history = read_json(DATA / "history.json", [])

    if args.topic:
        idea = VideoIdea(niche=args.niche, topic=args.topic, angle="most surprising angle",
                         hook_idea="bold specific claim", target_length_sec=45, inspired_by=[],
                         why_uk="Тему задано вручну.")
        strategy = Strategy(market_summary_uk="—", channel_insights_uk="—", ideas=[idea])
    else:
        tr = trends.run(cfg)
        if args.trends:
            print(trends.summarize_for_llm(tr))
            return
        ch = channel.run(cfg)
        strategy = strategist.run(cfg, tr, ch, history)

    for idea in strategy.ideas:
        script = scriptwriter.run(cfg, idea)
        out_dir = OUTPUT / f"{datetime.now():%Y-%m-%d}_{slugify(script.title)}"
        result = producer.run(cfg, script, out_dir)
        yt_id = publisher.run(cfg, script, out_dir / "video.mp4")
        write_package(out_dir, idea, script, strategy, result, yt_id)

        history.append({
            "date": datetime.now().strftime("%Y-%m-%d"),
            "niche": idea.niche,
            "topic": idea.topic,
            "title": script.title,
            "hook": script.scenes[0].text,
            "youtube_id": yt_id,
        })
        write_json(DATA / "history.json", history)
        log("Готово", f"📁 {out_dir}")

    print(json.dumps({"made": len(strategy.ideas)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
