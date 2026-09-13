create table if not exists public.market_snapshots (
  id text primary key,
  data_date date not null,
  created_at timestamptz not null,
  payload jsonb not null,
  inserted_at timestamptz not null default now()
);

create index if not exists market_snapshots_latest_idx
  on public.market_snapshots (data_date desc, created_at desc);

alter table public.market_snapshots enable row level security;

drop policy if exists "Public snapshots are readable" on public.market_snapshots;
create policy "Public snapshots are readable"
  on public.market_snapshots for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.market_snapshots from anon, authenticated;
grant select on public.market_snapshots to anon, authenticated;
