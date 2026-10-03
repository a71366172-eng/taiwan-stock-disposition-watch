"""Build a compact, public 30-session comparison dataset from official daily quotes."""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import shutil
import subprocess
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parents[1]
MARKET = ROOT / 'data' / 'market.json'
OUTPUTS = [ROOT / 'data' / 'comparison.json', ROOT / 'public' / 'data' / 'comparison.json']
CODE = re.compile(r'[1-9][0-9]{3}')


def number(value):
    try:
        result = float(str(value).replace(',', '').strip())
        return result if result > 0 else None
    except (ValueError, TypeError):
        return None


def fetch_json(url):
    for attempt in range(2):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'TaiwanStockWatch/0.1 (public-data research)', 'Accept': 'application/json'})
            with urllib.request.urlopen(request, timeout=16) as response:
                return json.loads(response.read().decode('utf-8-sig'))
        except Exception:
            if 'tpex.org.tw' in url and shutil.which('curl'):
                try:
                    result = subprocess.run(['curl', '--compressed', '-L', '--fail', '--silent', '--show-error', '--max-time', '16', url], check=True, capture_output=True, timeout=18)
                    return json.loads(result.stdout.decode('utf-8-sig'))
                except Exception:
                    pass
            if attempt == 0:
                time.sleep(1)
    return None


def table_rows(payload):
    if not isinstance(payload, dict):
        return []
    tables = payload.get('tables') or [payload]
    for table in tables:
        fields = table.get('fields') or []
        code_field = next((field for field in fields if field in ('證券代號', '代號')), None)
        close_field = next((field for field in fields if field in ('收盤價', '收盤')), None)
        name_field = next((field for field in fields if field in ('證券名稱', '名稱')), None)
        if not code_field or not close_field or not table.get('data'):
            continue
        code_index, close_index = fields.index(code_field), fields.index(close_field)
        name_index = fields.index(name_field) if name_field else None
        return [(str(row[code_index]).strip(), str(row[name_index]).strip() if name_index is not None else '', number(row[close_index])) for row in table['data'] if len(row) > max(code_index, close_index, name_index or 0)]
    return []


def parse_quotes(payload):
    rows = table_rows(payload)
    if not rows and isinstance(payload, list):
        rows = [(str(row.get('SecuritiesCompanyCode') or row.get('Code') or '').strip(), str(row.get('CompanyName') or row.get('Name') or '').strip(), number(row.get('Close') or row.get('ClosingPrice'))) for row in payload if isinstance(row, dict)]
    return {code: (name, close) for code, name, close in rows if CODE.fullmatch(code) and close is not None}


def quote_url(date, market):
    if market == 'TWSE':
        return f'https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date={date.replace("-", "")}&type=ALLBUT0999'
    query = urllib.parse.urlencode({'date': date.replace('-', '/'), 'id': '', 'response': 'json'})
    return f'https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?{query}'


def collect_day(task):
    date, market = task
    quotes = parse_quotes(fetch_json(quote_url(date, market)))
    return date, market, quotes


def main():
    market = json.loads(MARKET.read_text(encoding='utf-8'))
    as_of = market['asOf']
    dates = [date for date in market['calendar'] if date <= as_of][-42:]
    if len(dates) < 31:
        raise ValueError('At least 31 market sessions are needed for a 30-session comparison')
    previous = json.loads(OUTPUTS[0].read_text(encoding='utf-8')) if OUTPUTS[0].exists() else {}
    stocks = {}
    for stock in previous.get('stocks', []):
        if stock.get('market') not in ('TWSE', 'TPEX') or not CODE.fullmatch(stock.get('code', '')):
            continue
        bars = {bar['date']: bar['close'] for bar in stock.get('bars', []) if bar.get('date') in dates and number(bar.get('close')) is not None}
        stocks[(stock['market'], stock['code'])] = {'code': stock['code'], 'name': stock.get('name', stock['code']), 'market': stock['market'], 'bars': bars}
    # The focused market snapshot is an additional fallback for stocks whose
    # full-market report is temporarily unavailable on a trading date.
    for stock in market['stocks']:
        key = (stock['market'], stock['code'])
        entry = stocks.setdefault(key, {'code': stock['code'], 'name': stock['name'], 'market': stock['market'], 'bars': {}})
        entry['name'] = stock['name']
        for bar in stock['bars']:
            if bar['date'] in dates and number(bar.get('close')) is not None:
                entry['bars'][bar['date']] = bar['close']
    previous_dates = {name: set(previous.get('collectedDates', {}).get(name, [])) for name in ('TWSE', 'TPEX')}
    tasks = [(date, name) for name in ('TWSE', 'TPEX') for date in dates if date not in previous_dates[name]]
    collected = {name: previous_dates[name] & set(dates) for name in ('TWSE', 'TPEX')}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for date, name, quotes in pool.map(collect_day, tasks):
            if len(quotes) < 300:
                print(f'Comparison quotes unavailable: {name} {date} ({len(quotes)} rows)')
                continue
            collected[name].add(date)
            for code, (stock_name, close) in quotes.items():
                key = (name, code)
                entry = stocks.setdefault(key, {'code': code, 'name': stock_name, 'market': name, 'bars': {}})
                if stock_name:
                    entry['name'] = stock_name
                entry['bars'][date] = close
    rows = []
    for entry in stocks.values():
        bars = [{'date': date, 'close': close} for date, close in sorted(entry['bars'].items()) if date in dates]
        if len(bars) >= 2:
            rows.append({**{key: entry[key] for key in ('code', 'name', 'market')}, 'bars': bars})
    rows.sort(key=lambda row: (row['market'], row['code']))
    coverage = {name: sum(row['market'] == name and len(row['bars']) >= 31 for row in rows) for name in ('TWSE', 'TPEX')}
    if any(coverage[name] < 500 or len(collected[name]) < 31 for name in coverage):
        raise ValueError(f'Comparison market coverage insufficient: {coverage}; collected dates: '+str({name: len(collected[name]) for name in coverage}))
    payload = {'schemaVersion': 1, 'asOf': as_of, 'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'windowSessions': 30, 'collectedDates': {name: sorted(collected[name]) for name in collected}, 'stocks': rows}
    if not rows:
        raise ValueError('No valid comparison stocks were collected')
    serialized = json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n'
    for path in OUTPUTS:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(serialized, encoding='utf-8')
    print(f'Comparison dataset: {len(rows)} stocks; TWSE {len(collected["TWSE"])} days, TPEx {len(collected["TPEX"])} days')


if __name__ == '__main__':
    main()
