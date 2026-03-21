-- Sierra Pulse — synthetic historical normals (Phase 3 dev seed)
-- Realistic percentile bands for SWE at Gin Flat (CDEC GIN) and
-- discharge at Merced R at Happy Isles (USGS 11264500).
-- Based on approximate 1991–2020 climatology; values are illustrative, not archival.
--
-- Run in Supabase dashboard SQL editor AFTER seed.sql has been applied.
-- Generates one row per day of year using a generate_series + math approximation.

-- ---------------------------------------------------------------------------
-- GIN Flat — SWE (inches)
-- Peak ~April 1 (day 91) at ~34" median; zero July–October.
-- ---------------------------------------------------------------------------

with gin as (
  select id from stations where source = 'cdec' and source_id = 'GIN'
),
days as (
  select generate_series(1, 365) as doy
),
curve as (
  select
    doy,
    -- SWE bell-curve centered on day 91 (April 1), shoulder Oct–Nov buildup
    -- Approximate piecewise: buildup Oct(274)–Apr(91), melt Apr–Jul(180), zero Jul–Sep
    greatest(0, case
      -- buildup: Oct 1 (274) → Apr 1 (91, wrap-around via water year)
      when doy >= 274 then
        -- Oct 1 → Dec 31: 0 → 14" (days 274→365, span 91 days)
        round((14.0 * (doy - 274)::numeric / 91), 2)
      when doy <= 91 then
        -- Jan 1 → Apr 1: 14 → 34" (days 1→91, span 91 days)
        round((14.0 + 20.0 * doy::numeric / 91), 2)
      when doy <= 180 then
        -- melt Apr 1 → Jun 29: 34 → 0" (days 91→180, span 89 days)
        round((34.0 * (1.0 - (doy - 91)::numeric / 89)), 2)
      else 0
    end) as p50_swe
  from days
)
insert into historical_normals
  (station_id, parameter, day_of_year, p10, p25, p50, p75, p90, record_min, record_max, period_start, period_end)
select
  gin.id,
  'swe',
  c.doy,
  -- spread percentiles ±40% around median; dry year (p10) ~55% of median
  round(greatest(0, c.p50_swe * 0.55)::numeric, 2)                 as p10,
  round(greatest(0, c.p50_swe * 0.75)::numeric, 2)                 as p25,
  c.p50_swe                                                         as p50,
  round(greatest(0, c.p50_swe * 1.22)::numeric, 2)                 as p75,
  round(greatest(0, c.p50_swe * 1.45)::numeric, 2)                 as p90,
  round(greatest(0, c.p50_swe * 0.35)::numeric, 2)                 as record_min,
  round(greatest(0, c.p50_swe * 1.75)::numeric, 2)                 as record_max,
  1991,
  2020
from curve c
cross join gin
on conflict (station_id, parameter, day_of_year) do update set
  p10 = excluded.p10, p25 = excluded.p25, p50 = excluded.p50,
  p75 = excluded.p75, p90 = excluded.p90,
  record_min = excluded.record_min, record_max = excluded.record_max;

-- ---------------------------------------------------------------------------
-- Merced R at Happy Isles — discharge (cfs)
-- Peak runoff ~June 1 (day 152) from snowmelt; low baseflow Sept–Nov.
-- ---------------------------------------------------------------------------

with merced as (
  select id from stations where source = 'usgs' and source_id = '11264500'
),
days as (
  select generate_series(1, 365) as doy
),
curve as (
  select
    doy,
    greatest(0, case
      -- Low winter baseflow (Jan–Mar): ~150–300 cfs rising slowly
      when doy <= 60 then
        round((150.0 + 150.0 * doy::numeric / 60), 2)
      -- Rising limb (Apr–Jun 1): 300 → 2800 cfs
      when doy <= 152 then
        round((300.0 + 2500.0 * ((doy - 60)::numeric / 92)), 2)
      -- Falling limb (Jun 1 → Sep 1): 2800 → 200 cfs
      when doy <= 244 then
        round((2800.0 * (1.0 - ((doy - 152)::numeric / 92)^0.8)), 2)
      -- Late season / fall base: ~120–180 cfs
      else round((180.0 - 60.0 * ((doy - 244)::numeric / 121)), 2)
    end) as p50_cfs
  from days
)
insert into historical_normals
  (station_id, parameter, day_of_year, p10, p25, p50, p75, p90, record_min, record_max, period_start, period_end)
select
  merced.id,
  'discharge',
  c.doy,
  round(greatest(0, c.p50_cfs * 0.45)::numeric, 2)  as p10,
  round(greatest(0, c.p50_cfs * 0.68)::numeric, 2)  as p25,
  c.p50_cfs                                           as p50,
  round(greatest(0, c.p50_cfs * 1.38)::numeric, 2)  as p75,
  round(greatest(0, c.p50_cfs * 1.80)::numeric, 2)  as p90,
  round(greatest(0, c.p50_cfs * 0.25)::numeric, 2)  as record_min,
  round(greatest(0, c.p50_cfs * 2.50)::numeric, 2)  as record_max,
  1991,
  2020
from curve c
cross join merced
on conflict (station_id, parameter, day_of_year) do update set
  p10 = excluded.p10, p25 = excluded.p25, p50 = excluded.p50,
  p75 = excluded.p75, p90 = excluded.p90,
  record_min = excluded.record_min, record_max = excluded.record_max;

-- ---------------------------------------------------------------------------
-- BSH (Bishop Pass / South Fork Bishop Creek, 11,200 ft) — SWE (inches)
-- Higher elevation than GIN; drier Eastern Sierra aspect.
-- Peak ~April 10 (day 100), median ~22"; zero Aug–Oct.
-- ---------------------------------------------------------------------------
with bsh as (
  select id from stations where source = 'cdec' and source_id = 'BSH'
),
days as (select generate_series(1, 365) as doy),
curve as (
  select doy,
    greatest(0, case
      when doy >= 280 then round((8.0  * (doy - 280)::numeric / 85), 2)
      when doy <= 100 then round((8.0  + 14.0 * doy::numeric / 100), 2)
      when doy <= 185 then round((22.0 * (1.0 - (doy - 100)::numeric / 85)), 2)
      else 0
    end) as p50_swe
  from days
)
insert into historical_normals
  (station_id, parameter, day_of_year, p10, p25, p50, p75, p90, record_min, record_max, period_start, period_end)
select
  bsh.id, 'swe', c.doy,
  round(greatest(0, c.p50_swe * 0.50)::numeric, 2) as p10,
  round(greatest(0, c.p50_swe * 0.72)::numeric, 2) as p25,
  c.p50_swe                                         as p50,
  round(greatest(0, c.p50_swe * 1.25)::numeric, 2) as p75,
  round(greatest(0, c.p50_swe * 1.50)::numeric, 2) as p90,
  round(greatest(0, c.p50_swe * 0.30)::numeric, 2) as record_min,
  round(greatest(0, c.p50_swe * 1.85)::numeric, 2) as record_max,
  1991, 2020
from curve c cross join bsh
on conflict (station_id, parameter, day_of_year) do update set
  p10 = excluded.p10, p25 = excluded.p25, p50 = excluded.p50,
  p75 = excluded.p75, p90 = excluded.p90,
  record_min = excluded.record_min, record_max = excluded.record_max;

-- ---------------------------------------------------------------------------
-- RCK (Rock Creek Lakes, 10,000 ft) — SWE (inches)
-- Eastern Sierra, similar timing to GIN but lower accumulation.
-- Peak ~April 1 (day 91), median ~18"; zero Aug–Oct.
-- ---------------------------------------------------------------------------
with rck as (
  select id from stations where source = 'cdec' and source_id = 'RCK'
),
days as (select generate_series(1, 365) as doy),
curve as (
  select doy,
    greatest(0, case
      when doy >= 278 then round((7.0  * (doy - 278)::numeric / 87), 2)
      when doy <= 91  then round((7.0  + 11.0 * doy::numeric / 91), 2)
      when doy <= 178 then round((18.0 * (1.0 - (doy - 91)::numeric / 87)), 2)
      else 0
    end) as p50_swe
  from days
)
insert into historical_normals
  (station_id, parameter, day_of_year, p10, p25, p50, p75, p90, record_min, record_max, period_start, period_end)
select
  rck.id, 'swe', c.doy,
  round(greatest(0, c.p50_swe * 0.52)::numeric, 2) as p10,
  round(greatest(0, c.p50_swe * 0.73)::numeric, 2) as p25,
  c.p50_swe                                         as p50,
  round(greatest(0, c.p50_swe * 1.24)::numeric, 2) as p75,
  round(greatest(0, c.p50_swe * 1.48)::numeric, 2) as p90,
  round(greatest(0, c.p50_swe * 0.28)::numeric, 2) as record_min,
  round(greatest(0, c.p50_swe * 1.80)::numeric, 2) as record_max,
  1991, 2020
from curve c cross join rck
on conflict (station_id, parameter, day_of_year) do update set
  p10 = excluded.p10, p25 = excluded.p25, p50 = excluded.p50,
  p75 = excluded.p75, p90 = excluded.p90,
  record_min = excluded.record_min, record_max = excluded.record_max;

-- ---------------------------------------------------------------------------
-- Tuolumne R at Hetch Hetchy (USGS 11276500) — discharge (cfs)
-- Large basin, reservoir-regulated; peak runoff ~June 1 (day 152).
-- Median peak ~2200 cfs; higher variance than Merced.
-- ---------------------------------------------------------------------------
with hh as (
  select id from stations where source = 'usgs' and source_id = '11276500'
),
days as (select generate_series(1, 365) as doy),
curve as (
  select doy,
    greatest(0, case
      when doy <= 60  then round((200.0 + 100.0 * doy::numeric / 60), 2)
      when doy <= 152 then round((300.0 + 1900.0 * ((doy - 60)::numeric / 92)), 2)
      when doy <= 250 then round((2200.0 * (1.0 - ((doy - 152)::numeric / 98)^0.75)), 2)
      else round((160.0 - 40.0 * ((doy - 250)::numeric / 115)), 2)
    end) as p50_cfs
  from days
)
insert into historical_normals
  (station_id, parameter, day_of_year, p10, p25, p50, p75, p90, record_min, record_max, period_start, period_end)
select
  hh.id, 'discharge', c.doy,
  round(greatest(0, c.p50_cfs * 0.42)::numeric, 2) as p10,
  round(greatest(0, c.p50_cfs * 0.65)::numeric, 2) as p25,
  c.p50_cfs                                          as p50,
  round(greatest(0, c.p50_cfs * 1.40)::numeric, 2) as p75,
  round(greatest(0, c.p50_cfs * 1.85)::numeric, 2) as p90,
  round(greatest(0, c.p50_cfs * 0.20)::numeric, 2) as record_min,
  round(greatest(0, c.p50_cfs * 2.60)::numeric, 2) as record_max,
  1991, 2020
from curve c cross join hh
on conflict (station_id, parameter, day_of_year) do update set
  p10 = excluded.p10, p25 = excluded.p25, p50 = excluded.p50,
  p75 = excluded.p75, p90 = excluded.p90,
  record_min = excluded.record_min, record_max = excluded.record_max;

-- ---------------------------------------------------------------------------
-- Kings R near Piedra (USGS 11224500) — discharge (cfs)
-- Large Kings Canyon basin; peak ~May 20 (day 140), median ~3500 cfs.
-- ---------------------------------------------------------------------------
with kings as (
  select id from stations where source = 'usgs' and source_id = '11224500'
),
days as (select generate_series(1, 365) as doy),
curve as (
  select doy,
    greatest(0, case
      when doy <= 50  then round((400.0 + 200.0 * doy::numeric / 50), 2)
      when doy <= 140 then round((600.0 + 2900.0 * ((doy - 50)::numeric / 90)), 2)
      when doy <= 240 then round((3500.0 * (1.0 - ((doy - 140)::numeric / 100)^0.7)), 2)
      else round((220.0 - 80.0 * ((doy - 240)::numeric / 125)), 2)
    end) as p50_cfs
  from days
)
insert into historical_normals
  (station_id, parameter, day_of_year, p10, p25, p50, p75, p90, record_min, record_max, period_start, period_end)
select
  kings.id, 'discharge', c.doy,
  round(greatest(0, c.p50_cfs * 0.38)::numeric, 2) as p10,
  round(greatest(0, c.p50_cfs * 0.62)::numeric, 2) as p25,
  c.p50_cfs                                          as p50,
  round(greatest(0, c.p50_cfs * 1.45)::numeric, 2) as p75,
  round(greatest(0, c.p50_cfs * 1.95)::numeric, 2) as p90,
  round(greatest(0, c.p50_cfs * 0.18)::numeric, 2) as record_min,
  round(greatest(0, c.p50_cfs * 2.80)::numeric, 2) as record_max,
  1991, 2020
from curve c cross join kings
on conflict (station_id, parameter, day_of_year) do update set
  p10 = excluded.p10, p25 = excluded.p25, p50 = excluded.p50,
  p75 = excluded.p75, p90 = excluded.p90,
  record_min = excluded.record_min, record_max = excluded.record_max;

-- ---------------------------------------------------------------------------
-- Truckee R at Tahoe City (USGS 10336660) — discharge (cfs)
-- Regulated by Lake Tahoe; smaller basin, peak ~May 15 (day 135), median ~350 cfs.
-- ---------------------------------------------------------------------------
with truckee as (
  select id from stations where source = 'usgs' and source_id = '10336660'
),
days as (select generate_series(1, 365) as doy),
curve as (
  select doy,
    greatest(0, case
      when doy <= 45  then round((60.0 + 30.0 * doy::numeric / 45), 2)
      when doy <= 135 then round((90.0 + 260.0 * ((doy - 45)::numeric / 90)), 2)
      when doy <= 230 then round((350.0 * (1.0 - ((doy - 135)::numeric / 95)^0.8)), 2)
      else round((40.0 - 10.0 * ((doy - 230)::numeric / 135)), 2)
    end) as p50_cfs
  from days
)
insert into historical_normals
  (station_id, parameter, day_of_year, p10, p25, p50, p75, p90, record_min, record_max, period_start, period_end)
select
  truckee.id, 'discharge', c.doy,
  round(greatest(0, c.p50_cfs * 0.45)::numeric, 2) as p10,
  round(greatest(0, c.p50_cfs * 0.68)::numeric, 2) as p25,
  c.p50_cfs                                          as p50,
  round(greatest(0, c.p50_cfs * 1.35)::numeric, 2) as p75,
  round(greatest(0, c.p50_cfs * 1.75)::numeric, 2) as p90,
  round(greatest(0, c.p50_cfs * 0.22)::numeric, 2) as record_min,
  round(greatest(0, c.p50_cfs * 2.40)::numeric, 2) as record_max,
  1991, 2020
from curve c cross join truckee
on conflict (station_id, parameter, day_of_year) do update set
  p10 = excluded.p10, p25 = excluded.p25, p50 = excluded.p50,
  p75 = excluded.p75, p90 = excluded.p90,
  record_min = excluded.record_min, record_max = excluded.record_max;

-- ---------------------------------------------------------------------------
-- Kern R near Kernville (USGS 11186000) — discharge (cfs)
-- Southern Sierra; peak ~May 10 (day 130), median ~800 cfs.
-- ---------------------------------------------------------------------------
with kern as (
  select id from stations where source = 'usgs' and source_id = '11186000'
),
days as (select generate_series(1, 365) as doy),
curve as (
  select doy,
    greatest(0, case
      when doy <= 55  then round((150.0 + 80.0 * doy::numeric / 55), 2)
      when doy <= 130 then round((230.0 + 570.0 * ((doy - 55)::numeric / 75)), 2)
      when doy <= 235 then round((800.0 * (1.0 - ((doy - 130)::numeric / 105)^0.75)), 2)
      else round((80.0 - 25.0 * ((doy - 235)::numeric / 130)), 2)
    end) as p50_cfs
  from days
)
insert into historical_normals
  (station_id, parameter, day_of_year, p10, p25, p50, p75, p90, record_min, record_max, period_start, period_end)
select
  kern.id, 'discharge', c.doy,
  round(greatest(0, c.p50_cfs * 0.40)::numeric, 2) as p10,
  round(greatest(0, c.p50_cfs * 0.63)::numeric, 2) as p25,
  c.p50_cfs                                          as p50,
  round(greatest(0, c.p50_cfs * 1.42)::numeric, 2) as p75,
  round(greatest(0, c.p50_cfs * 1.88)::numeric, 2) as p90,
  round(greatest(0, c.p50_cfs * 0.20)::numeric, 2) as record_min,
  round(greatest(0, c.p50_cfs * 2.70)::numeric, 2) as record_max,
  1991, 2020
from curve c cross join kern
on conflict (station_id, parameter, day_of_year) do update set
  p10 = excluded.p10, p25 = excluded.p25, p50 = excluded.p50,
  p75 = excluded.p75, p90 = excluded.p90,
  record_min = excluded.record_min, record_max = excluded.record_max;
