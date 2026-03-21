-- Sierra Pulse — Phase 1 improvements
-- Adds: AirNow station source, station_latest_obs view, geometry column on stations

-- ---------------------------------------------------------------------------
-- AirNow as a station source
-- ---------------------------------------------------------------------------

alter type station_source add value 'airnow';

-- ---------------------------------------------------------------------------
-- Efficient latest-observation query
-- Replaces client-side reduction in useLatestObservations hook.
-- DISTINCT ON over the existing (station_id, parameter, observed_at desc) index
-- is sub-10ms at Phase 1 data volumes (~20k rows). Revisit materialized view
-- at Phase 4+ if query time exceeds 100ms.
-- ---------------------------------------------------------------------------

create view station_latest_obs as
  select distinct on (station_id, parameter)
    station_id, parameter, value, unit, observed_at
  from observations
  order by station_id, parameter, observed_at desc;

grant select on station_latest_obs to anon;

-- ---------------------------------------------------------------------------
-- Geometry column for Strava segment polylines (GeoJSON LineString)
-- Also used for fire perimeter simplified geometry (Phase 4)
-- ---------------------------------------------------------------------------

alter table stations add column geometry jsonb;
