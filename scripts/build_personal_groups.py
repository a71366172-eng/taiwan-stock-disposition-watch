"""Build the public stock-comparison group index from the user's curated list."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "personal-groups-source.txt"
OUTPUT = ROOT / "public" / "data" / "personal-groups.json"
SYMBOL = re.compile(r"^([0-9A-Z*]+)\.(TW|TE)$")
HEADING = re.compile(r"^([^:：]+)[：:]+$")


def build(source: str) -> dict:
    lines = [line.strip() for line in source.splitlines() if line.strip()]
    if not lines or not lines[0].startswith("矽光子") or lines[-1] != "6757.TW":
        raise ValueError("分類來源必須從矽光子開始，並以 6757.TW 台灣虎航結束")

    groups: list[dict] = []
    current: dict | None = None
    for number, line in enumerate(lines, 1):
        heading = HEADING.fullmatch(line)
        if heading:
            name = heading.group(1).strip()
            if name == "⊕" or re.fullmatch(r"．+傳產．+", name):
                current = None
                continue
            if current is not None and not current["codes"]:
                raise ValueError(f"第 {number} 行之前的族群沒有股票：{current['name']}")
            current = {"id": f"personal_{len(groups) + 1:03d}", "name": name, "codes": []}
            groups.append(current)
            continue
        symbol = SYMBOL.fullmatch(line)
        if not symbol:
            raise ValueError(f"第 {number} 行格式不正確：{line}")
        if current is None:
            raise ValueError(f"第 {number} 行的股票沒有族群：{line}")
        if symbol.group(2) == "TW":
            if symbol.group(1) in current["codes"]:
                raise ValueError(f"第 {number} 行重複代號：{line}")
            current["codes"].append(symbol.group(1))

    if not groups or any(not group["codes"] for group in groups):
        raise ValueError("至少一個族群沒有可用的上市／上櫃股票")
    return {"source": "使用者自行整理的概念股觀察名單", "groups": groups}


if __name__ == "__main__":
    data = build(SOURCE.read_text(encoding="utf-8-sig"))
    if "--check" not in sys.argv:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Built {len(data['groups'])} groups / {sum(len(group['codes']) for group in data['groups'])} stocks")
