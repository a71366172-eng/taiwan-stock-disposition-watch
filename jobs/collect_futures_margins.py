"""Publish official single-stock futures availability and initial-margin rates."""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
MARGIN_URL = 'https://www.taifex.com.tw/cht/5/stockMargining'
LIST_URL = 'https://openapi.taifex.com.tw/v1/SSFLists'


def parse_margin_rates(page: bytes) -> dict[str, float]:
    rates: dict[str, float] = {}
    for row in re.findall(rb'<tr\b[^>]*>(.*?)</tr>', page, re.I | re.S):
        code = re.search(rb'headers="commodity_stock_id_a"[^>]*>\s*(\d{4})', row, re.I)
        rate = re.search(rb'headers="bond_rate3"[^>]*>\s*([\d.]+)%', row, re.I)
        if code and rate:
            rates[code.group(1).decode('ascii')] = float(rate.group(1))
    return rates


def build_snapshot(page: bytes, contracts: list[dict]) -> dict:
    rates = parse_margin_rates(page)
    by_code: dict[str, set[str]] = {}
    for contract in contracts:
        code = str(contract.get('StockCode', '')).strip()
        symbol = str(contract.get('Contract', '')).strip()
        if re.fullmatch(r'[1-9]\d{3}', code) and symbol:
            by_code.setdefault(code, set()).add(symbol)
    if len(rates) < 100 or len(by_code) < 100:
        raise ValueError('Official stock-futures margin or contract roster is incomplete')
    stocks = {code: {'initialMarginPercent': rate, 'standard': True, 'mini': len(by_code[code]) > 1}
              for code, rate in sorted(rates.items()) if code in by_code}
    if len(stocks) < 100:
        raise ValueError('Official futures sources do not overlap sufficiently')
    return {'asOf': dt.datetime.now(dt.timezone.utc).isoformat(), 'stocks': stocks}


def main() -> None:
    try:
        with urllib.request.urlopen(MARGIN_URL, timeout=30) as response:
            page = response.read()
        with urllib.request.urlopen(LIST_URL, timeout=30) as response:
            contracts = json.load(response)
        snapshot = build_snapshot(page, contracts)
    except (OSError, ValueError) as exc:
        previous = ROOT / 'data' / 'futures-margins.json'
        if not previous.exists() or len(json.loads(previous.read_text(encoding='utf-8')).get('stocks', {})) < 100:
            raise
        print(f'Official futures margin refresh unavailable ({exc}); retaining prior verified data')
        return
    serialized = json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')) + '\n'
    for path in (ROOT / 'data' / 'futures-margins.json', ROOT / 'public' / 'data' / 'futures-margins.json'):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(serialized, encoding='utf-8')
    print(f"Published margin rates for {len(snapshot['stocks'])} stock-futures underlyings")


if __name__ == '__main__':
    main()
