"""Build the public stock-comparison indexes from the user's group lists."""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "personal-groups-source.txt"
FINE_SOURCE = ROOT / "data" / "fine-industries.csv"
OUTPUT = ROOT / "public" / "data" / "personal-groups.json"
SYMBOL = re.compile(r"^([0-9A-Z*]+)\.(TW|TE)$")
HEADING = re.compile(r"^([^:：]+)[：:]+$")


def build_personal_groups(source: str) -> list[dict]:
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
    return groups


def build_fine_industries(source: str) -> list[dict]:
    rows = csv.DictReader(source.splitlines())
    required = {"代碼", "所有細產業"}
    if not rows.fieldnames or not required.issubset(rows.fieldnames):
        raise ValueError("產業細類別 CSV 缺少代碼或所有細產業欄位")

    codes_by_name: dict[str, list[str]] = {}
    seen_by_name: dict[str, set[str]] = {}
    seen_rows: set[str] = set()
    for number, row in enumerate(rows, 2):
        code = (row.get("代碼") or "").strip()
        if not re.fullmatch(r"\d{4}", code):
            raise ValueError(f"產業細類別 CSV 第 {number} 列股票代碼格式錯誤：{code}")
        if code in seen_rows:
            raise ValueError(f"產業細類別 CSV 股票代碼重複：{code}")
        seen_rows.add(code)
        names = [name.strip() for name in (row.get("所有細產業") or "").split(",") if name.strip()]
        if not names:
            continue
        for name in names:
            bucket = codes_by_name.setdefault(name, [])
            seen = seen_by_name.setdefault(name, set())
            if code not in seen:
                bucket.append(code)
                seen.add(code)

    groups = [
        {"id": f"industry_{index:03d}", "name": name, "codes": codes}
        for index, (name, codes) in enumerate(codes_by_name.items(), 1)
        if codes
    ]
    if not groups:
        raise ValueError("產業細類別 CSV 沒有可用的股票分類")
    return groups


def build_industries(source: str) -> list[dict]:
    rows = csv.DictReader(source.splitlines())
    required = {"代碼", "產業"}
    if not rows.fieldnames or not required.issubset(rows.fieldnames):
        raise ValueError("產業細類別 CSV 缺少代碼或產業欄位")

    codes_by_name: dict[str, list[str]] = {}
    seen_by_name: dict[str, set[str]] = {}
    seen_rows: set[str] = set()
    for number, row in enumerate(rows, 2):
        code = (row.get("代碼") or "").strip()
        if not re.fullmatch(r"\d{4}", code):
            raise ValueError(f"產業細類別 CSV 第 {number} 列股票代碼格式錯誤：{code}")
        if code in seen_rows:
            raise ValueError(f"產業細類別 CSV 股票代碼重複：{code}")
        seen_rows.add(code)
        name = (row.get("產業") or "").strip()
        if not name:
            continue
        bucket = codes_by_name.setdefault(name, [])
        seen = seen_by_name.setdefault(name, set())
        if code not in seen:
            bucket.append(code)
            seen.add(code)

    groups = [
        {"id": f"sector_{index:03d}", "name": name, "codes": codes}
        for index, (name, codes) in enumerate(codes_by_name.items(), 1)
        if codes
    ]
    if not groups:
        raise ValueError("產業欄位沒有可用的股票分類")
    return groups


def build(source: str, fine_source: str) -> dict:
    return {
        "sources": [
            {
                "id": "original",
                "label": "原本概念分類",
                "source": "使用者自行整理的概念股觀察名單",
                "groups": build_personal_groups(source),
            },
            {
                "id": "fine_industry",
                "label": "產業細類別",
                "source": "使用者匯出的產業細類別 CSV",
                "groups": build_fine_industries(fine_source),
            },
            {
                "id": "industry",
                "label": "產業別分類",
                "source": "依使用者匯出的產業細類別 CSV「產業」欄位分組",
                "groups": build_industries(fine_source),
            },
        ]
    }


if __name__ == "__main__":
    source_text = SOURCE.read_text(encoding="utf-8-sig")
    fine_text = FINE_SOURCE.read_text(encoding="utf-8-sig")
    data = build(source_text, fine_text)
    if "--check" not in sys.argv:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for source in data["sources"]:
        print(f"Built {source['label']}: {len(source['groups'])} groups / {sum(len(group['codes']) for group in source['groups'])} stock memberships")
