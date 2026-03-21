-- Sierra Pulse — Phase 3: historical normals table
-- Stores percentile bands computed from 30-year climatology (1991–2020 NOAA normals period).
-- One row per (station, parameter, day-of-year). Populated by seed or future ingest function.

create table historical_normals (
  id           bigserial primary key,
  station_id   uuid not null references stations(id) on delete cascade,
  parameter    text not null,
  day_of_year  smallint not null check (day_of_year between 1 and 366),
  p10          double precision,
  p25          double precision,
  p50          double precision,
  p75          double precision,
  p90          double precision,
  record_min   double precision,
  record_max   double precision,
  period_start smallint default 1991,
  period_end   smallint default 2020,
  unique (station_id, parameter, day_of_year)
);

create index historical_normals_station_param
  on historical_normals(station_id, parameter, day_of_year);

alter table historical_normals enable row level security;
create policy "public read historical_normals"
  on historical_normals for select using (true);

grant select on historical_normals to anon;

-- ---------------------------------------------------------------------------
-- daily_observations view — aggregates hourly observations to daily means.
-- Used by Phase 3 envelope charts to overlay current-year data.
-- ---------------------------------------------------------------------------

create view daily_observations as
  select
    station_id,
    parameter,
    date_trunc('day', observed_at at time zone 'America/Los_Angeles')::date as obs_date,
    extract(doy from observed_at at time zone 'America/Los_Angeles')::smallint as day_of_year,
    round(avg(value)::numeric, 2) as value_avg,
    round(min(value)::numeric, 2) as value_min,
    round(max(value)::numeric, 2) as value_max,
    count(*) as reading_count
  from observations
  group by station_id, parameter, obs_date, day_of_year;

grant select on daily_observations to anon;
