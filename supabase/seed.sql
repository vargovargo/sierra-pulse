-- Dev seed: representative Sierra stations for local testing
-- Run after migration: supabase db reset (applies migration + seed)

insert into stations (source, source_id, name, lat, lon, elevation_ft, type) values
  -- Northern Sierra snow
  ('cdec', 'GIN', 'Gin Flat',          37.7678, -119.7731, 7050, 'snow'),
  ('cdec', 'TUM', 'Tuolumne Meadows',  37.8758, -119.3569, 8619, 'snow'),
  ('cdec', 'DAN', 'Dana Meadows',      37.8978, -119.2567, 9800, 'snow'),
  -- Central Sierra snow
  ('cdec', 'MMD', 'Mammoth Mountain',  37.6308, -119.0328, 9350, 'snow'),
  ('cdec', 'SLK', 'Silver Lake',       38.6814, -120.1097, 7230, 'snow'),
  -- Southern Sierra snow
  ('cdec', 'BLY', 'Big Meadow',        36.6025, -118.5808, 7680, 'snow'),
  ('cdec', 'COR', 'Cottonwood Lakes',  36.4681, -118.1747, 11100, 'snow'),
  -- USGS streamflow
  ('usgs', '11264500', 'Merced R at Happy Isles (Yosemite)', 37.7322, -119.5582, 4035, 'streamflow'),
  ('usgs', '11230500', 'San Joaquin R at Friant',            36.9958, -119.7222, 305,  'streamflow'),
  ('usgs', '11303000', 'Merced R at Shaffer Bridge',         37.5575, -120.0453, 155,  'streamflow')
on conflict (source, source_id) do nothing;

-- AirNow air quality monitoring stations
insert into stations (source, source_id, name, lat, lon, elevation_ft, type) values
  ('airnow', 'BISHOP',   'Bishop AQI',          37.363, -118.395, 4147, 'weather'),
  ('airnow', 'MAMMOTH',  'Mammoth Lakes AQI',   37.649, -118.972, 7953, 'weather'),
  ('airnow', 'YOSEMITE', 'Yosemite Valley AQI', 37.748, -119.588, 3966, 'weather')
on conflict (source, source_id) do nothing;

-- ---------------------------------------------------------------------------
-- Synthetic observations for local dev (April water year ~2024 baseline)
-- Provides 48h of hourly data so frontend works without running ingest crons.
-- Real ingest will add newer rows; station_latest_obs view always returns
-- the most recent regardless of whether rows are synthetic or real.
-- ---------------------------------------------------------------------------

-- SWE (snow water equivalent) for CDEC snow stations
with s as (select id, source_id from stations where source = 'cdec')
insert into observations (station_id, observed_at, parameter, value, unit)
select
  s.id,
  now() - (g.hr || ' hours')::interval,
  'swe',
  case s.source_id
    when 'GIN' then round((18.2 - (random() * 0.4))::numeric, 2)
    when 'TUM' then round((22.1 - (random() * 0.4))::numeric, 2)
    when 'DAN' then round((28.4 - (random() * 0.4))::numeric, 2)
    when 'MMD' then round((31.0 - (random() * 0.4))::numeric, 2)
    when 'SLK' then round((14.2 - (random() * 0.4))::numeric, 2)
    when 'BLY' then round((24.8 - (random() * 0.4))::numeric, 2)
    when 'COR' then round((19.3 - (random() * 0.4))::numeric, 2)
    else        round((20.0 - (random() * 0.4))::numeric, 2)
  end,
  'inches'
from s
cross join generate_series(0, 47) as g(hr)
where s.source_id in ('GIN', 'TUM', 'DAN', 'MMD', 'SLK', 'BLY', 'COR')
on conflict (station_id, parameter, observed_at) do nothing;

-- Discharge (streamflow) for USGS gauges
with s as (select id, source_id from stations where source = 'usgs')
insert into observations (station_id, observed_at, parameter, value, unit)
select
  s.id,
  now() - (g.hr || ' hours')::interval,
  'discharge',
  case s.source_id
    when '11264500' then round((1250 + (random() * 50))::numeric, 1)
    when '11230500' then round((890  + (random() * 30))::numeric, 1)
    when '11303000' then round((340  + (random() * 20))::numeric, 1)
    else             round((500  + (random() * 40))::numeric, 1)
  end,
  'cfs'
from s
cross join generate_series(0, 47) as g(hr)
on conflict (station_id, parameter, observed_at) do nothing;

-- AQI for AirNow stations (good baseline — no smoke event)
with s as (select id, source_id from stations where source = 'airnow')
insert into observations (station_id, observed_at, parameter, value, unit)
select
  s.id,
  now() - (g.hr || ' hours')::interval,
  'aqi',
  case s.source_id
    when 'BISHOP'   then round((35 + (random() * 10))::numeric, 0)
    when 'MAMMOTH'  then round((28 + (random() * 8))::numeric,  0)
    when 'YOSEMITE' then round((42 + (random() * 12))::numeric, 0)
    else             round((38 + (random() * 10))::numeric, 0)
  end,
  'AQI'
from s
cross join generate_series(0, 47) as g(hr)
on conflict (station_id, parameter, observed_at) do nothing;
