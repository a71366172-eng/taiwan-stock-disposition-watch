"""Upsert one immutable market snapshot through Supabase REST.

The service-role key is read only from the GitHub Actions environment.
"""
from __future__ import annotations
import hashlib, json, os, pathlib, sys, urllib.request

path=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'data/market.json')
payload=json.loads(path.read_text(encoding='utf-8'))
raw=json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode()
row={'id':hashlib.sha256(raw).hexdigest(),'data_date':payload['asOf'],'created_at':payload['generatedAt'],'payload':payload}
base=os.environ['SUPABASE_URL'].rstrip('/')
key=os.environ['SUPABASE_SERVICE_ROLE_KEY']
request=urllib.request.Request(f'{base}/rest/v1/market_snapshots?on_conflict=id',data=json.dumps(row,ensure_ascii=False).encode(),method='POST',headers={'apikey':key,'Authorization':f'Bearer {key}','Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'})
with urllib.request.urlopen(request,timeout=30) as response:
    if response.status not in (200,201,204): raise RuntimeError(f'Unexpected Supabase response: {response.status}')
print(json.dumps({'id':row['id'],'dataDate':row['data_date']}))
