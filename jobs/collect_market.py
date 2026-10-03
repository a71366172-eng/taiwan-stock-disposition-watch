"""Collect public TWSE and TPEx data into a reproducible local snapshot.

Standard library only. No credentials, no adjusted-price substitution.
Run: python jobs/collect_market.py [--as-of YYYY-MM-DD]
"""
from __future__ import annotations
import argparse, csv, datetime as dt, hashlib, io, json, pathlib, re, shutil, subprocess, time, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / 'work' / 'raw'
RAW.mkdir(parents=True, exist_ok=True)
errors: list[str] = []
sources: list[dict] = []
PUBLIC_SOURCE_HOSTS = {'www.twse.com.tw', 'openapi.twse.com.tw', 'www.tpex.org.tw', 'mopsfin.twse.com.tw'}
PUBLIC_QUERY_KEYS = {'cate', 'code', 'd', 'date', 'endDate', 'id', 'l', 'o', 'order', 'response', 's', 'se', 'selectType', 'startDate', 'stockNo', 't', 'type'}

def public_source_url(url: str):
    try:
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != 'https' or parsed.hostname not in PUBLIC_SOURCE_HOSTS or parsed.username or parsed.password or parsed.port:
            return '來源端點未公開'
        public_query = urllib.parse.urlencode([(key, value) for key, value in urllib.parse.parse_qsl(parsed.query, keep_blank_values=True) if key in PUBLIC_QUERY_KEYS])
        return urllib.parse.urlunsplit(('https', parsed.hostname, parsed.path, public_query, ''))
    except ValueError:
        return '來源端點未公開'

def record_source(url: str, observed_at: str):
    sources.append({'url': public_source_url(url), 'observedAt': observed_at})

def get(url: str, required=True, retries=3, timeout=25):
    cache = RAW / (hashlib.sha256(url.encode()).hexdigest() + '.json')
    if cache.exists() and time.time() - cache.stat().st_mtime < 3600:
        record_source(url, dt.datetime.fromtimestamp(cache.stat().st_mtime,dt.timezone.utc).isoformat())
        return json.loads(cache.read_text(encoding='utf-8'))
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'TaiwanStockWatch/0.1 (public-data research)', 'Accept':'application/json'})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = json.loads(resp.read().decode('utf-8-sig'))
            if isinstance(payload, dict) and payload.get('stat') is not None and str(payload['stat']).upper() != 'OK':
                raise ValueError(str(payload.get('stat'))[:100])
            cache.write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
            record_source(url, dt.datetime.now(dt.timezone.utc).isoformat())
            return payload
        except Exception as exc:
            # TPEx's current certificate chain is rejected by Python 3.14 on
            # Windows (missing SKI), while the platform curl validates it.
            # GitHub-hosted runners also provide curl, so keep verification on.
            if 'tpex.org.tw' in url and shutil.which('curl'):
                try:
                    completed=subprocess.run(['curl','--compressed','--connect-timeout','10','--max-time',str(timeout),'--retry','0','-L','--fail','--silent','--show-error',url],check=True,capture_output=True)
                    payload=json.loads(completed.stdout.decode('utf-8-sig'))
                    cache.write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
                    record_source(url, dt.datetime.now(dt.timezone.utc).isoformat())
                    return payload
                except Exception:
                    pass
            if attempt < retries-1: time.sleep(1 + attempt * 2)
            else:
                errors.append(f'{public_source_url(url)}: {type(exc).__name__}')
                if required: raise RuntimeError(f'Source fetch failed: {public_source_url(url)}') from None
                return None

def post_json(url: str, params: dict[str, str], retries=2, timeout=20):
    body=urllib.parse.urlencode(params)
    cache=RAW/(hashlib.sha256((url+'?'+body).encode()).hexdigest()+'.json')
    if cache.exists() and time.time()-cache.stat().st_mtime<3600:
        record_source(url+'?'+body,dt.datetime.fromtimestamp(cache.stat().st_mtime,dt.timezone.utc).isoformat())
        return json.loads(cache.read_text(encoding='utf-8'))
    headers={'User-Agent':'TaiwanStockWatch/0.1 (public-data research)','Accept':'application/json','Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','Referer':'https://www.tpex.org.tw/zh-tw/announce/market/attention.html','Origin':'https://www.tpex.org.tw'}
    for attempt in range(retries):
        try:
            req=urllib.request.Request(url,data=body.encode(),headers=headers,method='POST')
            with urllib.request.urlopen(req,timeout=timeout) as resp: payload=json.loads(resp.read().decode('utf-8-sig'))
            if not isinstance(payload,dict) or str(payload.get('stat','')).lower()!='ok': raise ValueError('TPEx historical attention response invalid')
            cache.write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
            record_source(url+'?'+body,dt.datetime.now(dt.timezone.utc).isoformat())
            return payload
        except Exception as exc:
            if 'tpex.org.tw' in url and shutil.which('curl'):
                try:
                    completed=subprocess.run(['curl','--compressed','--connect-timeout','10','--max-time',str(timeout),'--retry','0','-L','--fail','--silent','--show-error','-H',f'User-Agent: {headers["User-Agent"]}','-H',f'Referer: {headers["Referer"]}','-H','Content-Type: application/x-www-form-urlencoded; charset=UTF-8','--data-binary',body,url],check=True,capture_output=True)
                    payload=json.loads(completed.stdout.decode('utf-8-sig'))
                    if not isinstance(payload,dict) or str(payload.get('stat','')).lower()!='ok': raise ValueError('TPEx historical attention response invalid')
                    cache.write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
                    record_source(url+'?'+body,dt.datetime.now(dt.timezone.utc).isoformat())
                    return payload
                except Exception: pass
            if attempt<retries-1: time.sleep(1+attempt*2)
            else:
                errors.append(f'{public_source_url(url)}: {type(exc).__name__}')
                return None

def get_csv(url: str, required=True):
    cache = RAW / (hashlib.sha256(url.encode()).hexdigest() + '.csv')
    if cache.exists() and time.time() - cache.stat().st_mtime < 3600:
        record_source(url, dt.datetime.fromtimestamp(cache.stat().st_mtime,dt.timezone.utc).isoformat())
        return list(csv.DictReader(io.StringIO(cache.read_text(encoding='utf-8-sig'))))
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'TaiwanStockWatch/0.1 (public-data research)', 'Accept':'text/csv'})
            with urllib.request.urlopen(req, timeout=25) as resp:
                content=resp.read().decode('utf-8-sig')
            rows=list(csv.DictReader(io.StringIO(content)))
            if len(rows)<500 or not rows or '公司代號' not in rows[0]:
                raise ValueError('官方公司基本資料 CSV 欄位或筆數異常')
            cache.write_text(content, encoding='utf-8-sig')
            record_source(url, dt.datetime.now(dt.timezone.utc).isoformat())
            return rows
        except Exception as exc:
            if attempt < 2: time.sleep(1 + attempt * 2)
            else:
                errors.append(f'{public_source_url(url)}: {type(exc).__name__}')
                if required: raise RuntimeError(f'Source fetch failed: {public_source_url(url)}') from None
                return None

def number(v):
    try: return float(str(v).replace(',', '').replace('+', '').strip())
    except (ValueError, TypeError): return None

def institutional_net_5(dates, market):
    """Sum official daily three-institution net shares across five sessions."""
    totals={}
    for date in dates:
        if market=='TWSE':
            url=f'https://www.twse.com.tw/rwd/zh/fund/T86?response=json&date={date.replace("-", "")}&selectType=ALLBUT0999'
            report=get(url, False)
            if not isinstance(report, dict) or not report.get('data'):
                return None
            fields=[strip(field) for field in report.get('fields',[])]
            try: net_index=next(i for i,field in enumerate(fields) if '三大法人買賣超股數' in field)
            except StopIteration:
                errors.append(f'{public_source_url(url)}: missing institutional net-share column')
                return None
            rows=((str(row[0]).strip(),number(row[net_index])) for row in report['data'] if len(row)>net_index)
        else:
            roc=dt.date.fromisoformat(date).year-1911
            date_param=f'{roc}/{date[5:7]}/{date[8:10]}'
            url='https://www.tpex.org.tw/web/stock/3insti/daily_trade/3itrade_hedge_result.php?'+urllib.parse.urlencode({'l':'zh-tw','o':'json','se':'EW','t':'D','d':date_param})
            report=get(url, False)
            if not isinstance(report, dict) or not report.get('tables'):
                return None
            table=report['tables'][0]
            fields=[strip(field) for field in table.get('fields',[])]
            try: net_index=next(i for i,field in enumerate(fields) if '三大法人買賣超股數合計' in field)
            except StopIteration:
                errors.append(f'{public_source_url(url)}: missing institutional net-share column')
                return None
            rows=((str(row[0]).strip(),number(row[net_index])) for row in table.get('data',[]) if len(row)>net_index)
        for code,net in rows:
            if net is not None and re.fullmatch(r'[1-9]\d{3}',code):
                totals[code]=totals.get(code,0)+int(net)
    return totals

def day_trade_shares(as_of, market):
    """Read per-stock official same-day round-trip volume, in shares."""
    if market=='TWSE':
        url=f'https://www.twse.com.tw/exchangeReport/TWTB4U?response=json&date={as_of.replace("-", "")}&selectType=All'
        report=get(url,False)
        if not isinstance(report,dict): return None
        tables=report.get('tables') or [report]
        for table in tables:
            fields=[strip(field) for field in table.get('fields',[])]
            try:
                code_index=next(i for i,field in enumerate(fields) if '證券代號' in field)
                shares_index=next(i for i,field in enumerate(fields) if '當日沖銷交易成交股數' in field)
            except StopIteration: continue
            rows=table.get('data') or []
            if rows:
                return {str(row[code_index]).strip():number(row[shares_index]) for row in rows if len(row)>shares_index and re.fullmatch(r'[1-9]\d{3}',str(row[code_index]).strip())}
        errors.append(f'{public_source_url(url)}: missing per-stock day-trading table')
        return None
    roc=dt.date.fromisoformat(as_of).year-1911
    date_param=f'{roc}/{as_of[5:7]}/{as_of[8:10]}'
    url='https://www.tpex.org.tw/web/stock/trading/intraday_stat/intraday_trading_stat_result.php?'+urllib.parse.urlencode({'l':'zh-tw','d':date_param,'s':'0,asc,0','o':'json'})
    report=get(url,False)
    if not isinstance(report,dict): return None
    for table in report.get('tables',[]):
        fields=[strip(field) for field in table.get('fields',[])]
        try:
            code_index=next(i for i,field in enumerate(fields) if '證券代號' in field)
            shares_index=next(i for i,field in enumerate(fields) if '當日沖銷交易成交股數' in field)
        except StopIteration: continue
        rows=table.get('data') or []
        if rows:
            return {str(row[code_index]).strip():number(row[shares_index]) for row in rows if len(row)>shares_index and re.fullmatch(r'[1-9]\d{3}',str(row[code_index]).strip())}
    errors.append(f'{public_source_url(url)}: missing per-stock day-trading table')
    return None

def iso(v):
    digits = re.findall(r'\d+', str(v))
    if len(digits)==1 and len(digits[0]) in (7,8):
        s=digits[0]; digits=[s[:-4], s[-4:-2], s[-2:]]
    if len(digits)<3: return None
    y,m,d=map(int,digits[:3]); y=y+1911 if y<1911 else y
    try: return dt.date(y,m,d).isoformat()
    except ValueError: return None

def roc_date(value: str):
    date=dt.date.fromisoformat(value)
    return f'{date.year-1911:03d}/{date.month:02d}/{date.day:02d}'

CN={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12,'十三':13,'十四':14}
def strip(v): return re.sub('<[^>]+>', '', str(v)).strip()
def notice_rules(reason):
    rules=set()
    for value in re.findall(r'第([0-9]{1,2}|[一二三四五六七八九十]+)款',str(reason)):
        rule=int(value) if value.isdigit() else CN.get(value)
        if rule is not None: rules.add(rule)
    return sorted(rules)
def twse_notice(row):
    return {'code':str(row[1]),'name':row[2],'date':iso(row[5]),'reason':strip(row[4]),'rules':notice_rules(row[4]), 'close':number(row[6]),'pe':number(row[7])}

def tpex_notice(row):
    reason=strip(row.get('TradingInformation',''))
    return {'code':str(row.get('SecuritiesCompanyCode','')),'name':row.get('CompanyName',''),'date':iso(row.get('Date')),'reason':reason,'rules':notice_rules(reason),'close':number(row.get('ClosePrice')),'pe':number(row.get('PriceEarningRatio'))}

def tpex_historical_notices(payload, code):
    """Normalize the official TPEx historical attention query, tolerating its tabular response variants."""
    if not isinstance(payload, dict): return []
    result=[]
    tables=payload.get('tables') or []
    if not tables and ('fields' in payload or 'data' in payload): tables=[payload]
    for table in tables:
        fields=[strip(field) for field in table.get('fields',[])]
        rows=table.get('data') or []
        for row in rows:
            if isinstance(row,dict):
                get_value=lambda *terms: next((v for k,v in row.items() if any(term in strip(k) for term in terms)),None)
                values={'date':get_value('公告日期','日期'),'code':get_value('證券代號','代號'),'name':get_value('證券名稱','名稱'),'reason':get_value('注意交易資訊','交易資訊','注意原因'),'close':get_value('收盤價'),'pe':get_value('本益比')}
            else:
                values={}
                for key,terms in {'date':('公告日期','日期'),'code':('證券代號','代號'),'name':('證券名稱','名稱'),'reason':('注意交易資訊','交易資訊','注意原因'),'close':('收盤價',),'pe':('本益比',)}.items():
                    index=next((i for i,field in enumerate(fields) if any(term in field for term in terms)),None)
                    values[key]=row[index] if index is not None and index<len(row) else None
            row_code=str(values.get('code') or code).strip()
            notice_date=iso(values.get('date'))
            reason=strip(values.get('reason') or '')
            if row_code!=code or not notice_date or not reason: continue
            result.append({'code':code,'name':strip(values.get('name') or ''),'date':notice_date,'reason':reason,'rules':notice_rules(reason),'close':number(values.get('close')),'pe':number(values.get('pe'))})
    return result

def fetch_tpex_historical_notices(code, start_date, end_date):
    """Fetch one TPEx common stock's official attention announcements for a date range."""
    url='https://www.tpex.org.tw/www/zh-tw/bulletin/attention'
    payload=post_json(url,{'cate':'','code':code,'endDate':roc_date(end_date),'order':'date','response':'json','startDate':roc_date(start_date),'type':'code'},retries=2,timeout=20)
    if payload is None: return None
    return tpex_historical_notices(payload,code)

def fetch_twse_historical_notices(code, start_date, end_date):
    """Supplement the broad TWSE feed with an official per-security history query."""
    start=dt.date.fromisoformat(start_date).strftime('%Y%m%d')
    end=dt.date.fromisoformat(end_date).strftime('%Y%m%d')
    url='https://www.twse.com.tw/announcement/notice?'+urllib.parse.urlencode({'response':'json','startDate':start,'endDate':end,'stockNo':code})
    payload=get(url,False)
    if payload is None: return None
    return [twse_notice(row) for row in payload.get('data',[]) if len(row)>5 and str(row[1]).strip()==code and iso(row[5])]

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--as-of'); args=parser.parse_args()
    quotes=get('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL')
    tpex_quotes=get('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes')
    twse_dates=sorted({iso(x.get('Date')) for x in quotes if iso(x.get('Date'))})
    tpex_dates=sorted({iso(x.get('Date')) for x in tpex_quotes if iso(x.get('Date'))})
    if not twse_dates or not tpex_dates:
        raise ValueError(f'Market quote dates unavailable: TWSE={twse_dates[-1:]}, TPEX={tpex_dates[-1:]}')
    # The two official daily quote feeds can publish at different times. Anchor
    # the whole snapshot to the newest feed date, then recover any lagging
    # market's prices from its official per-stock daily history endpoint below.
    latest_quote_date=max(twse_dates[-1],tpex_dates[-1])
    date_gap=abs((dt.date.fromisoformat(twse_dates[-1])-dt.date.fromisoformat(tpex_dates[-1])).days)
    if date_gap>4:
        raise ValueError(f'Market quote feeds are more than four calendar days apart: TWSE={twse_dates[-1]}, TPEX={tpex_dates[-1]}')
    as_of=args.as_of or latest_quote_date
    if as_of!=latest_quote_date: raise ValueError('The quote endpoints only expose recent snapshots; historical collection is not supported.')
    day=dt.date.fromisoformat(as_of); compact=as_of.replace('-',''); start=(day-dt.timedelta(days=105)).strftime('%Y%m%d')
    notices=get(f'https://www.twse.com.tw/announcement/notice?response=json&startDate={start}&endDate={compact}')
    cand=get(f'https://www.twse.com.tw/announcement/notetrans?response=json&date={compact}')
    punish=get(f'https://www.twse.com.tw/announcement/punish?response=json&startDate={start}&endDate={compact}')
    fundamentals=get('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL',False) or []
    firms=get_csv('https://mopsfin.twse.com.tw/opendata/t187ap03_L.csv')
    tpex_firms=get_csv('https://mopsfin.twse.com.tw/opendata/t187ap03_O.csv')
    holidays=get('https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule',False) or []
    exrights=get('https://openapi.twse.com.tw/v1/exchangeReport/TWT48U_ALL',False)
    tpex_notices_raw=get('https://www.tpex.org.tw/openapi/v1/tpex_trading_warning_information')
    tpex_candidates_raw=get('https://www.tpex.org.tw/openapi/v1/tpex_trading_warning_note')
    tpex_punish_raw=get('https://www.tpex.org.tw/openapi/v1/tpex_disposal_information')
    tpex_fundamentals=get('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis',False) or []
    # Company master restricts this build to common shares, not ETFs or warrants.
    company={str(x.get('公司代號','')):x for x in firms}
    tpex_company={str(x.get('公司代號','')):x for x in tpex_firms}
    def issued_shares(row):
        for key,value in row.items():
            if '已發行普通股數' in str(key): return number(value)
        return None
    is_common=lambda code: bool(re.fullmatch(r'[1-9]\d{3}',code)) and (code in company if company else True)
    all_notices=[twse_notice(r) for r in notices.get('data',[]) if is_common(str(r[1]))]
    all_notices=[x for x in all_notices if x['date'] and x['date']<=as_of]
    candidates={str(r[1]):strip(r[3]) for r in cand.get('data',[]) if is_common(str(r[1]))}
    is_tpex_common=lambda code: bool(re.fullmatch(r'[1-9]\d{3}',code))
    tpex_notices=[tpex_notice(r) for r in tpex_notices_raw if is_tpex_common(str(r.get('SecuritiesCompanyCode','')))]
    tpex_notices=[x for x in tpex_notices if x['date']==as_of]
    tpex_candidates={str(r.get('SecuritiesCompanyCode','')):strip(r.get('AccumulationSituation','')) for r in tpex_candidates_raw if is_tpex_common(str(r.get('SecuritiesCompanyCode',''))) and iso(r.get('Date'))==as_of}
    today=[n for n in all_notices if n['date']==as_of]+[n for n in tpex_notices if n['date']==as_of]
    dispositions=[]
    for r in punish.get('data',[]):
        if not is_common(str(r[2])): continue
        period=re.findall(r'\d{2,3}/\d{1,2}/\d{1,2}',r[6]); announced=iso(r[1])
        if not announced or announced>as_of:continue
        dispositions.append({'code':str(r[2]),'name':r[3],'announced':announced,'start':iso(period[0]) if period else None,'end':iso(period[1]) if len(period)>1 else None,'condition':strip(r[5]),'measure':strip(r[7]),'content':strip(r[8])})
    for r in tpex_punish_raw:
        code=str(r.get('SecuritiesCompanyCode','')); announced=iso(r.get('Date'))
        if not is_tpex_common(code) or not announced or announced>as_of: continue
        period=str(r.get('DispositionPeriod','')).split('~')
        dispositions.append({'code':code,'name':r.get('CompanyName',code),'announced':announced,'start':iso(period[0]) if period else None,'end':iso(period[1]) if len(period)>1 else None,'condition':strip(r.get('DispositionReasons','')),'measure':'櫃買中心正式處置','content':strip(r.get('DisposalCondition',''))})
    active=[d for d in dispositions if d['end'] and d['end']>=as_of]
    quote_map={x['Code']:x for x in quotes}
    f_map={x.get('Code'):x for x in fundamentals}
    tpex_quote_map={str(x.get('SecuritiesCompanyCode','')):x for x in tpex_quotes}
    tpex_f_map={str(x.get('SecuritiesCompanyCode','')):x for x in tpex_fundamentals}
    # The attention feeds can overlap across markets and may include recently
    # transferred/delisted names. Use each market's quote roster as its security
    # master, without requiring the quote row itself to match as_of (the feeds
    # can differ by one session).
    twse_market_symbols={str(x.get('Code','')) for x in quotes}
    tpex_market_symbols={str(x.get('SecuritiesCompanyCode','')) for x in tpex_quotes}
    # Candidate feeds also overlap across markets. Require roster membership
    # before collecting them, otherwise a TWSE candidate appears again as a
    # price-less TPEx record (and vice versa).
    risk_twse_symbols={code for code in candidates if code in twse_market_symbols}|{n['code'] for n in today if n['code'] in twse_market_symbols}|{d['code'] for d in active if d['code'] in twse_market_symbols}
    risk_tpex_symbols={code for code in tpex_candidates if code in tpex_market_symbols}|{n['code'] for n in today if n['code'] in tpex_market_symbols}|{d['code'] for d in active if d['code'] in tpex_market_symbols}
    # Both exchanges publish official per-day historical attention notices.
    # Verify/fill recent announcement history for every risk stock directly
    # from both exchanges. TPEx OpenAPI above is current-day only.
    history_start=(day-dt.timedelta(days=105)).isoformat()
    twse_history_complete=set()
    twse_history_codes=sorted(risk_twse_symbols)
    with ThreadPoolExecutor(max_workers=8) as history_pool:
        twse_history=history_pool.map(lambda item:fetch_twse_historical_notices(item,history_start,as_of),twse_history_codes)
        for code,historical in zip(twse_history_codes,twse_history):
            if historical is None:
                errors.append(f'TWSE historical attention history unavailable for {code}')
                continue
            if code in candidates and not historical:
                errors.append(f'TWSE official candidate history unexpectedly empty for {code}')
                continue
            twse_history_complete.add(code)
            by_date={notice['date']:notice for notice in all_notices if notice['code']==code}
            by_date.update({notice['date']:notice for notice in historical})
            all_notices=[notice for notice in all_notices if notice['code']!=code]+list(by_date.values())
    tpex_history_complete=set()
    tpex_history_codes=sorted(risk_tpex_symbols)
    with ThreadPoolExecutor(max_workers=8) as history_pool:
        tpex_history=history_pool.map(lambda item:fetch_tpex_historical_notices(item,history_start,as_of),tpex_history_codes)
        for code,historical in zip(tpex_history_codes,tpex_history):
            if historical is None:
                errors.append(f'TPEx historical attention history unavailable for {code}')
                continue
            if code in tpex_candidates and not historical:
                errors.append(f'TPEx official candidate history unexpectedly empty for {code}')
                continue
            tpex_history_complete.add(code)
            by_date={notice['date']:notice for notice in tpex_notices if notice['code']==code}
            by_date.update({notice['date']:notice for notice in historical})
            tpex_notices=[notice for notice in tpex_notices if notice['code']!=code]+list(by_date.values())
    all_notices.extend(tpex_notices)
    today=[n for n in all_notices if n['date']==as_of]
    # Keep the screener's universe aligned with every common stock in both
    # official quote rosters, not only the attention/disposition watchlist.
    twse_symbols={code for code in twse_market_symbols if is_common(code)}
    tpex_symbols={code for code in tpex_market_symbols if is_tpex_common(code)}
    priority_twse={code for code in candidates if code in twse_symbols}|{n['code'] for n in today if n['code'] in twse_symbols}|{d['code'] for d in active if d['code'] in twse_symbols}
    priority_tpex={code for code in tpex_candidates if code in tpex_symbols}|{n['code'] for n in today if n['code'] in tpex_symbols}|{d['code'] for d in active if d['code'] in tpex_symbols}
    # Split the broad history refresh across the five existing daily runs.
    # We still publish every stock's current quote each run, retain previous
    # history for untouched stocks, and always refresh official risk names.
    taipei_now=dt.datetime.now(dt.timezone.utc)+dt.timedelta(hours=8)
    slots=[8,12,14,18,23]
    history_batch=min(range(len(slots)),key=lambda index:abs((taipei_now.hour+ taipei_now.minute/60)-slots[index]))
    old_snapshot_path=ROOT/'public'/'data'/'screener.json'
    try:
        old_snapshot=json.loads(old_snapshot_path.read_text(encoding='utf-8'))
        old_bars={f"{item.get('market')}:{item.get('code')}":item.get('bars',[]) for item in old_snapshot.get('stocks',[])}
    except (OSError,ValueError,AttributeError):
        old_bars={}
    refresh_twse={code for code in twse_symbols if code in priority_twse or int(code)%len(slots)==history_batch}
    refresh_tpex={code for code in tpex_symbols if code in priority_tpex or int(code)%len(slots)==history_batch}
    months=[]
    for i in range(6):
        serial=day.year*12+day.month-1-i; months.append(f'{serial//12:04d}{serial%12+1:02d}01')
    def load_twse_stock(code):
        q=quote_map.get(code,{})
        bars=[]
        for month in months if code in candidates else months[:3] if code in refresh_twse else []:
            payload=get(f'https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date={month}&stockNo={code}',False)
            for r in (payload or {}).get('data',[]):
                date=iso(r[0]); close=number(r[6]); change=number(r[7]); reference=close-change if close is not None and change is not None else None
                if date and date<=as_of:
                    bars.append({'date':date,'open':number(r[3]),'high':number(r[4]),'low':number(r[5]),'close':close,'reference':reference,'volume':number(r[1]),'note':strip(r[9]) if len(r)>9 else ''})
            time.sleep(.3)
        bars=sorted({b['date']:b for b in bars}.values(),key=lambda b:b['date'])
        if code not in refresh_twse:
            bars=[b for b in old_bars.get(f'TWSE:{code}',[]) if b.get('date','')<=as_of]
        as_of_bar=next((b for b in reversed(bars) if b['date']==as_of),None)
        if not as_of_bar and iso(q.get('Date'))==as_of:
            quote_close=number(q.get('ClosingPrice')); quote_change=number(q.get('Change'))
            if quote_close is not None:
                as_of_bar={'date':as_of,'open':None,'high':None,'low':None,'close':quote_close,'reference':quote_close-quote_change if quote_change is not None else None,'volume':number(q.get('TradeVolume')),'note':'官方當日行情補齊'}
                bars.append(as_of_bar)
        if code in candidates and (not as_of_bar or as_of_bar['close'] is None):
            raise ValueError(f'Missing official TWSE daily history for candidate {code} on {as_of}')
        stock_notices=sorted([n for n in all_notices if n['code']==code],key=lambda n:n['date'],reverse=True)
        latest=stock_notices[0] if stock_notices else {}
        f=f_map.get(code,{})
        pe=number(f.get('PEratio'))
        if pe is None: pe=latest.get('pe') if latest.get('date')==as_of else None
        pb=number(f.get('PBratio'))
        if pb is None and latest.get('date')==as_of:
            match=re.search(r'股價淨值比為\s*([\d.]+)',latest.get('reason','')); pb=float(match.group(1)) if match else None
        close=number(q.get('ClosingPrice')) if q else None
        change=number(q.get('Change')) if q else None
        volume=number(q.get('TradeVolume')) if q else None
        if as_of_bar:
            close=as_of_bar['close'] if close is None else close
            change=close-as_of_bar['reference'] if change is None and close is not None and as_of_bar['reference'] is not None else change
            volume=as_of_bar['volume'] if volume is None else volume
        return {'code':code,'name':q.get('Name') or company.get(code,{}).get('公司簡稱') or latest.get('name',code),'market':'TWSE','quoteDate':iso(q.get('Date')) if q else (as_of_bar['date'] if as_of_bar else None),'industry':company.get(code,{}).get('產業別',''),'close':close,'change':change,'changePercent':change/(close-change)*100 if close and change is not None and close!=change else None,'volume':volume,'issuedShares':issued_shares(company.get(code,{})),'pe':pe,'pb':pb,'valuationDate':as_of if pe is not None or pb is not None else None,'bars':bars,'notices':stock_notices,'noticeHistoryComplete':code in twse_history_complete,'candidateReason':candidates.get(code),'dispositions':[d for d in dispositions if d['code']==code]}

    def load_tpex_stock(code):
        q=tpex_quote_map.get(code,{}); bars=[]
        for month in months if code in tpex_candidates else months[:3] if code in refresh_tpex else []:
            date=f'{month[:4]}/{month[4:6]}/01'
            url='https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock?'+urllib.parse.urlencode({'code':code,'date':date,'id':'','response':'json'})
            payload=get(url,False) or {}
            table=(payload.get('tables') or [{}])[0]
            for r in table.get('data',[]):
                trading_date=iso(r[0]); close=number(r[6]); change=number(r[7]); reference=close-change if close is not None and change is not None else None
                if trading_date and trading_date<=as_of:
                    bars.append({'date':trading_date,'open':number(r[3]),'high':number(r[4]),'low':number(r[5]),'close':close,'reference':reference,'volume':number(r[1]),'note':''})
            time.sleep(.2)
        bars=sorted({b['date']:b for b in bars}.values(),key=lambda b:b['date'])
        if code not in refresh_tpex:
            bars=[b for b in old_bars.get(f'TPEX:{code}',[]) if b.get('date','')<=as_of]
        as_of_bar=next((b for b in reversed(bars) if b['date']==as_of),None)
        if not as_of_bar and iso(q.get('Date'))==as_of:
            quote_close=number(q.get('Close')); quote_change=number(q.get('Change'))
            if quote_close is not None:
                as_of_bar={'date':as_of,'open':None,'high':None,'low':None,'close':quote_close,'reference':quote_close-quote_change if quote_change is not None else None,'volume':number(q.get('TradingShares')),'note':'官方當日行情補齊'}
                bars.append(as_of_bar)
        if code in tpex_candidates and (not as_of_bar or as_of_bar['close'] is None):
            raise ValueError(f'Missing official TPEx daily history for candidate {code} on {as_of}')
        stock_notices=sorted([n for n in all_notices if n['code']==code],key=lambda n:n['date'],reverse=True)
        latest=stock_notices[0] if stock_notices else {}; f=tpex_f_map.get(code,{})
        pe=number(f.get('PriceEarningRatio'))
        if pe is None: pe=latest.get('pe') if latest.get('date')==as_of else None
        pb=number(f.get('PriceBookRatio'))
        if pb is None and latest.get('date')==as_of:
            match=re.search(r'股價淨值比為\s*([\d.]+)',latest.get('reason','')); pb=float(match.group(1)) if match else None
        close=number(q.get('Close')) if q else None
        change=number(q.get('Change')) if q else None
        volume=number(q.get('TradingShares')) if q else None
        if as_of_bar:
            close=as_of_bar['close'] if close is None else close
            change=close-as_of_bar['reference'] if change is None and close is not None and as_of_bar['reference'] is not None else change
            volume=as_of_bar['volume'] if volume is None else volume
        return {'code':code,'name':q.get('CompanyName') or latest.get('name',code),'market':'TPEX','quoteDate':iso(q.get('Date')) if q else (as_of_bar['date'] if as_of_bar else None),'industry':'','close':close,'change':change,'changePercent':change/(close-change)*100 if close and change is not None and close!=change else None,'volume':volume,'issuedShares':issued_shares(tpex_company.get(code,{})),'pe':pe,'pb':pb,'valuationDate':as_of if pe is not None or pb is not None else None,'bars':bars,'notices':stock_notices,'noticeHistoryComplete':code in tpex_history_complete,'candidateReason':tpex_candidates.get(code),'dispositions':[d for d in dispositions if d['code']==code]}

    with ThreadPoolExecutor(max_workers=4) as pool:
        stocks=list(pool.map(load_twse_stock,sorted(twse_symbols)))+list(pool.map(load_tpex_stock,sorted(tpex_symbols)))
    screener_stocks=[{'code':stock['code'],'name':stock['name'],'market':stock['market'],'quoteDate':stock['quoteDate'],'close':stock['close'],'change':stock['change'],'changePercent':stock['changePercent'],'volume':stock['volume'],'issuedShares':stock['issuedShares'],'bars':[{'date':bar['date'],'close':bar['close']} for bar in stock['bars'][-31:]]} for stock in stocks]
    stocks=[stock for stock in stocks if stock['code'] in (risk_twse_symbols if stock['market']=='TWSE' else risk_tpex_symbols)]
    for stock in stocks: stock['bars']=stock['bars'][-31:]
    for stock in stocks:
        company_row=(company if stock['market']=='TWSE' else tpex_company).get(stock['code'],{})
        stock['paidInCapital']=number(company_row.get('實收資本額'))
    day_trade_twse=day_trade_shares(as_of,'TWSE')
    day_trade_tpex=day_trade_shares(as_of,'TPEX')
    for stock in stocks:
        reported=day_trade_twse if stock['market']=='TWSE' else day_trade_tpex
        stock['dayTradeShares']=reported.get(stock['code']) if reported is not None else None
    # Calendar is derived from a broad-market listed stock's actual sessions, plus official holiday records for future dates.
    calendar=sorted({b['date'] for s in stocks for b in s['bars']})
    last_five=calendar[-5:]
    if len(last_five)==5 and last_five[-1]==as_of:
        twse_net=institutional_net_5(last_five,'TWSE')
        tpex_net=institutional_net_5(last_five,'TPEX')
        for stock in stocks:
            market_net=twse_net if stock['market']=='TWSE' else tpex_net
            stock['institutionalNet5Shares']=market_net.get(stock['code'],0) if market_net is not None else None
    else:
        for stock in stocks: stock['institutionalNet5Shares']=None
    closed=set()
    for h in holidays:
        date=iso(h.get('Date',''))
        description=str(h.get('Name',''))+str(h.get('Description',''))
        if date and '開始交易' not in description and '最後交易' not in description: closed.add(date)
    forecast_dates=[]; cursor=day
    while len(forecast_dates)<3:
        cursor+=dt.timedelta(days=1)
        if cursor.weekday()<5 and cursor.isoformat() not in closed: forecast_dates.append(cursor.isoformat())
    target=dt.date.fromisoformat(forecast_dates[0]); effective=dt.date.fromisoformat(forecast_dates[1])
    result={'schemaVersion':3,'asOf':as_of,'targetDate':target.isoformat(),'effectiveDate':effective.isoformat(),'forecastDates':forecast_dates,'generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'calendarVerified':bool(holidays),'classificationVerified':bool(company),'corporateActionsAvailable':exrights is not None,'calendar':calendar,'stocks':stocks,'todayNotices':today,'dispositions':dispositions,'sources':sources,'ingestionErrors':errors,'coverage':{'TWSE':f'all common-stock quote roster; 30-session history refresh batch {history_batch+1}/5; official risk stocks refresh every run','TPEX':f'all common-stock quote roster; 30-session history refresh batch {history_batch+1}/5; official risk stocks refresh every run'},'historyRefreshBatch':history_batch+1,'historyRefreshBatches':len(slots),'rulesVersion':'TW-MARKETS-2026-08-10-v0.3','predictionLabel':'三個交易日處置風險・官方隔日候選優先'}
    dest=ROOT/'data'; dest.mkdir(exist_ok=True)
    raw=json.dumps(result,ensure_ascii=False,indent=2)
    fingerprint=hashlib.sha256(raw.encode()).hexdigest()[:12]
    archive=ROOT/'work'/'snapshots';archive.mkdir(exist_ok=True)
    (archive/f'{as_of}-{fingerprint}.json').write_text(raw,encoding='utf-8')
    tmp=dest/'market.pending.json'; tmp.write_text(raw,encoding='utf-8'); tmp.replace(dest/'market.json')
    public=ROOT/'public'/'data'; public.mkdir(parents=True,exist_ok=True)
    (public/'market.json').write_text(raw,encoding='utf-8')
    screener_result={'asOf':as_of,'generatedAt':result['generatedAt'],'historyRefreshBatch':history_batch+1,'historyRefreshBatches':len(slots),'stocks':screener_stocks}
    screener_raw=json.dumps(screener_result,ensure_ascii=False,separators=(',',':'))
    (dest/'screener.json').write_text(screener_raw,encoding='utf-8')
    screener_public=public/'screener.json'; screener_public.parent.mkdir(parents=True,exist_ok=True); screener_public.write_text(screener_raw,encoding='utf-8')
    print(json.dumps({'asOf':as_of,'quoteDates':{'TWSE':twse_dates[-1],'TPEX':tpex_dates[-1]},'riskStocks':len(stocks),'screenerStocks':len(screener_stocks),'twseCandidates':len(candidates),'tpexCandidates':len(tpex_candidates),'todayNotices':len(today),'historyRefreshBatch':history_batch+1,'refreshedHistoryStocks':len(refresh_twse)+len(refresh_tpex),'calendarVerified':bool(holidays),'errors':len(errors),'output':str(dest/'market.json'),'screenerOutput':str(dest/'screener.json')},ensure_ascii=False))

if __name__=='__main__': main()
