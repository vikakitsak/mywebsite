"""Спільні утиліти: конфіг, шляхи, логування, виклик Claude зі структурованою відповіддю."""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import TypeVar

import yaml
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUTPUT = ROOT / "output"
ASSETS = ROOT / "assets"

T = TypeVar("T", bound=BaseModel)


def load_config() -> dict:
    with open(ROOT / "config.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def log(agent: str, msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] [{agent}] {msg}", flush=True)


def env(name: str, required: bool = True) -> str | None:
    val = os.environ.get(name, "").strip()
    if required and not val:
        sys.exit(f"Не задано змінну середовища {name}. Додайте її в GitHub → Settings → Secrets.")
    return val or None


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def slugify(text: str, max_len: int = 50) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return s[:max_len].strip("-") or "video"


def read_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return default


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------- JSON-схеми для відповідей ШІ ----------

def _strict_schema(model: type[BaseModel]) -> dict:
    """JSON-схема з pydantic, з розгорнутими $ref і additionalProperties=false."""
    schema = model.model_json_schema()
    defs = schema.pop("$defs", {})

    def resolve(node):
        if isinstance(node, dict):
            if "$ref" in node:
                return resolve(defs[node["$ref"].split("/")[-1]])
            out = {k: resolve(v) for k, v in node.items() if k != "title"}
            if out.get("type") == "object":
                out["additionalProperties"] = False
                out["required"] = list(out.get("properties", {}).keys())
            return out
        if isinstance(node, list):
            return [resolve(x) for x in node]
        return node

    return resolve(schema)
