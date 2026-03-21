-- Sierra Pulse — Phase 5c: strike window engine output table
-- One row per zone, upserted by compute-strike-windows edge function.

create table strike_windows (
  id            uuid primary key default gen_random_uuid(),
  zone          text not null unique,
  score         integer not null default 0,          -- 0–100
  window_status text not null default 'unknown',     -- 'go' | 'caution' | 'blocked' | 'unknown'
  aqi_status    text,                                -- 'clear' | 'caution' | 'blocked'
  aqi_value     integer,
  swe_pct       integer,                             -- % of historical p50 median (null = no data)
  effort_count  integer,                             -- summed Strava efforts in zone (null = no data)
  permits_avail boolean,                             -- any permit available in next 14 days
  flags         jsonb not null default '{}',         -- detailed per-signal breakdown
  computed_at   timestamptz default now()
);

create index strike_windows_status_idx on strike_windows(window_status);
create index strike_windows_computed_idx on strike_windows(computed_at desc);

alter table strike_windows enable row level security;
create policy "public read strike_windows" on strike_windows for select using (true);
grant select on strike_windows to anon;
