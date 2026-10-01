"""Collect public TWSE and TPEx data into a reproducible local snapshot.

Standard library only. No credentials, no adjusted-price substitution.
Run: python jobs/collect_market.py [--as-of YYYY-MM-DD]
"""
from __future__ import annotations
import argparse, datetime as dt, hashlib, json, pathlib, re, shutil, subprocess, time, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / 'work' / 'raw'
RAW.mkdir(parents=True, exist_ok=True)
errors: list[str] = []
sources: list[dict] = []

def get(url: str, required=True):
    cache = RAW / (hashlib.sha256(url.encode()).hexdigest() + '.json')
    if cache.exists() and time.time() - cache.stat().st_mtime < 3600:
        sources.append({'url':url, 'observedAt':dt.datetime.fromtimestamp(cache.stat().st_mtime,dt.timezone.utc).isoformat()})
        return json.loads(cache.read_text(encoding='utf-8'))
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'TaiwanStockWatch/0.1 (public-data research)', 'Accept':'application/json'})
            with urllib.request.urlopen(req, timeout=25) as resp:
                payload = json.loads(resp.read().decode('utf-8-sig'))
            if isinstance(payload, dict) and payload.get('stat') not in (None, 'OK'):
                raise ValueError(str(payload.get('stat'))[:100])
            cache.write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
            sources.append({'url':url, 'observedAt':dt.datetime.now(dt.timezone.utc).isoformat()})
            return payload
        except Exception as exc:
            # TPEx's current certificate chain is rejected by Python 3.14 on
            # Windows (missing SKI), while the platform curl validates it.
            # GitHub-hosted runners also provide curl, so keep verification on.
            if 'tpex.org.tw' in url and shutil.which('curl'):
                try:
                    completed=subprocess.run(['curl','--compressed','--retry','3','--retry-all-errors','-L','--fail','--silent','--show-error',url],check=True,capture_output=True)
                    payload=json.loads(completed.stdout.decode('utf-8-sig'))
                    cache.write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
                    sources.append({'url':url, 'observedAt':dt.datetime.now(dt.timezone.utc).isoformat()})
                    return payload
                except Exception:
                    pass
            if attempt < 2: time.sleep(1 + attempt * 2)
            else:
                errors.append(f'{url}: {type(exc).__name__}: {str(exc)[:100]}')
                if required: raise
                return None

def number(v):
    try: return float(str(v).replace(',', '').replace('+', '').strip())
    except (ValueError, TypeError): return None

def iso(v):
    digits = re.findall(r'\d+', str(v))
    if len(digits)==1 and len(digits[0]) in (7,8):
        s=digits[0]; digits=[s[:-4], s[-4:-2], s[-2:]]
    if len(digits)<3: return None
    y,m,d=map(int,digits[:3]); y=y+1911 if y<1911 else y
    try: return dt.date(y,m,d).isoformat()
    except ValueError: return None

CN={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12,'十三':13,'十四':14}
def strip(v): return re.sub('<[^>]+>', '', str(v)).strip()
def twse_notice(row):
    return {'code':str(row[1]),'name':row[2],'date':iso(row[5]),'reason':strip(row[4]),'rules':sorted(set(CN[x] for x in re.findall(r'第([一二三四五六七八九十]+)款', row[4]) if x in CN)), 'close':number(row[6]),'pe':number(row[7])}

def tpex_notice(row):
    reason=strip(row.get('TradingInformation',''))
    return {'code':str(row.get('SecuritiesCompanyCode','')),'name':row.get('CompanyName',''),'date':iso(row.get('Date')),'reason':reason,'rules':sorted(set(CN[x] for x in re.findall(r'第([一二三四五六七八九十]+)款',reason) if x in CN)),'close':number(row.get('ClosePrice')),'pe':number(row.get('PriceEarningRatio'))}

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
    firms=get('https://openapi.twse.com.tw/v1/opendata/t187ap03_L',False) or []
    holidays=get('https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule',False) or []
    exrights=get('https://openapi.twse.com.tw/v1/exchangeReport/TWT48U_ALL',False)
    tpex_notices_raw=get('https://www.tpex.org.tw/openapi/v1/tpex_trading_warning_information')
    tpex_candidates_raw=get('https://www.tpex.org.tw/openapi/v1/tpex_trading_warning_note')
    tpex_punish_raw=get('https://www.tpex.org.tw/openapi/v1/tpex_disposal_information')
    tpex_fundamentals=get('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis',False) or []
    # Company master restricts this build to common shares, not ETFs or warrants.
    company={str(x.get('公司代號','')):x for x in firms}
    is_common=lambda code: bool(re.fullmatch(r'[1-9]\d{3}',code)) and (code in company if company else True)
    all_notices=[twse_notice(r) for r in notices.get('data',[]) if is_common(str(r[1]))]
    all_notices=[x for x in all_notices if x['date'] and x['date']<=as_of]
    candidates={str(r[1]):strip(r[3]) for r in cand.get('data',[]) if is_common(str(r[1]))}
    is_tpex_common=lambda code: bool(re.fullmatch(r'[1-9]\d{3}',code))
    tpex_notices=[tpex_notice(r) for r in tpex_notices_raw if is_tpex_common(str(r.get('SecuritiesCompanyCode','')))]
    tpex_notices=[x for x in tpex_notices if x['date']==as_of]
    all_notices.extend(tpex_notices)
    tpex_candidates={str(r.get('SecuritiesCompanyCode','')):strip(r.get('AccumulationSituation','')) for r in tpex_candidates_raw if is_tpex_common(str(r.get('SecuritiesCompanyCode',''))) and iso(r.get('Date'))==as_of}
    today=[n for n in all_notices if n['date']==as_of]
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
    quote_map={x['Code']:x for x in quotes if iso(x.get('Date'))==as_of}
    f_map={x.get('Code'):x for x in fundamentals}
    tpex_quote_map={str(x.get('SecuritiesCompanyCode','')):x for x in tpex_quotes if iso(x.get('Date'))==as_of}
    tpex_f_map={str(x.get('SecuritiesCompanyCode','')):x for x in tpex_fundamentals}
    # The attention feeds can overlap across markets and may include recently
    # transferred/delisted names. Use each market's quote roster as its security
    # master, without requiring the quote row itself to match as_of (the feeds
    # can differ by one session).
    twse_market_symbols={str(x.get('Code','')) for x in quotes}
    tpex_market_symbols={str(x.get('SecuritiesCompanyCode','')) for x in tpex_quotes}
    twse_symbols=set(candidates)|{n['code'] for n in today if n['code'] in twse_market_symbols}|{d['code'] for d in active if d['code'] in twse_market_symbols}
    tpex_symbols=set(tpex_candidates)|{n['code'] for n in today if n['code'] in tpex_market_symbols}|{d['code'] for d in active if d['code'] in tpex_market_symbols}
    months=[]
    for i in range(6):
        serial=day.year*12+day.month-1-i; months.append(f'{serial//12:04d}{serial%12+1:02d}01')
    def load_twse_stock(code):
        q=quote_map.get(code,{})
        bars=[]
        # Long-window history is collected for real candidates; other stocks start with two months.
        for month in months if code in candidates else months[:2]:
            payload=get(f'https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date={month}&stockNo={code}',False)
            for r in (payload or {}).get('data',[]):
                date=iso(r[0]); close=number(r[6]); change=number(r[7]); reference=close-change if close is not None and change is not None else None
                if date and date<=as_of:
                    bars.append({'date':date,'open':number(r[3]),'high':number(r[4]),'low':number(r[5]),'close':close,'reference':reference,'volume':number(r[1]),'note':strip(r[9]) if len(r)>9 else ''})
            time.sleep(.3)
        bars=sorted({b['date']:b for b in bars}.values(),key=lambda b:b['date'])
        as_of_bar=next((b for b in reversed(bars) if b['date']==as_of),None)
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
        return {'code':code,'name':q.get('Name') or company.get(code,{}).get('公司簡稱') or latest.get('name',code),'market':'TWSE','industry':company.get(code,{}).get('產業別',''),'close':close,'change':change,'changePercent':change/(close-change)*100 if close and change is not None and close!=change else None,'volume':volume,'pe':pe,'pb':pb,'valuationDate':as_of if pe is not None or pb is not None else None,'bars':bars,'notices':stock_notices,'candidateReason':candidates.get(code),'dispositions':[d for d in dispositions if d['code']==code]}

    def load_tpex_stock(code):
        q=tpex_quote_map.get(code,{}); bars=[]
        for month in months if code in tpex_candidates else months[:2]:
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
        as_of_bar=next((b for b in reversed(bars) if b['date']==as_of),None)
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
        return {'code':code,'name':q.get('CompanyName') or latest.get('name',code),'market':'TPEX','industry':'','close':close,'change':change,'changePercent':change/(close-change)*100 if close and change is not None and close!=change else None,'volume':volume,'pe':pe,'pb':pb,'valuationDate':as_of if pe is not None or pb is not None else None,'bars':bars,'notices':stock_notices,'candidateReason':tpex_candidates.get(code),'dispositions':[d for d in dispositions if d['code']==code]}

    with ThreadPoolExecutor(max_workers=4) as pool:
        stocks=list(pool.map(load_twse_stock,sorted(twse_symbols)))+list(pool.map(load_tpex_stock,sorted(tpex_symbols)))
    # Calendar is derived from a broad-market listed stock's actual sessions, plus official holiday records for future dates.
    calendar=sorted({b['date'] for s in stocks for b in s['bars']})
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
    result={'schemaVersion':3,'asOf':as_of,'targetDate':target.isoformat(),'effectiveDate':effective.isoformat(),'forecastDates':forecast_dates,'generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'calendarVerified':bool(holidays),'classificationVerified':bool(company),'corporateActionsAvailable':exrights is not None,'calendar':calendar,'stocks':stocks,'todayNotices':today,'dispositions':dispositions,'sources':sources,'ingestionErrors':errors,'coverage':{'TWSE':'official attention, candidate, disposition and quotes','TPEX':'official attention, candidate, disposition and quotes'},'rulesVersion':'TW-MARKETS-2026-08-10-v0.3','predictionLabel':'三個交易日處置風險・官方隔日候選優先'}
    dest=ROOT/'data'; dest.mkdir(exist_ok=True)
    raw=json.dumps(result,ensure_ascii=False,indent=2)
    fingerprint=hashlib.sha256(raw.encode()).hexdigest()[:12]
    archive=ROOT/'work'/'snapshots';archive.mkdir(exist_ok=True)
    (archive/f'{as_of}-{fingerprint}.json').write_text(raw,encoding='utf-8')
    tmp=dest/'market.pending.json'; tmp.write_text(raw,encoding='utf-8'); tmp.replace(dest/'market.json')
    public=ROOT/'public'/'data'; public.mkdir(parents=True,exist_ok=True)
    (public/'market.json').write_text(raw,encoding='utf-8')
    print(json.dumps({'asOf':as_of,'quoteDates':{'TWSE':twse_dates[-1],'TPEX':tpex_dates[-1]},'stocks':len(stocks),'twseCandidates':len(candidates),'tpexCandidates':len(tpex_candidates),'todayNotices':len(today),'calendarVerified':bool(holidays),'errors':len(errors),'output':str(dest/'market.json')},ensure_ascii=False))

if __name__=='__main__': main()
