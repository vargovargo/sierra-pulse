-- Sierra Pulse — Phase 5c: weekly effort delta + season lifecycle per trail segment
--
-- segment_weekly_efforts columns:
--   weekly_efforts  = max(effort_count) - min(effort_count) over last 8 days
--                     (8-day window ensures a full 7-day delta even with slight ingest drift)
--   last_seen       = timestamp of most recent effort_count observation
--   season_opener   = first date this calendar year where effort_count increased
--                     (null until first activity of the year)
--   last_active     = last date this calendar year where effort_count increased
--   season_closer   = last_active, but only exposed after 14+ days of silence
--                     (null during active season; appears when trail has gone quiet)

create or replace view segment_weekly_efforts as
with
  weekly as (
    select
      station_id,
      greatest(max(value) - min(value), 0) as weekly_efforts,
      max(observed_at)                      as last_seen
    from observations
    where parameter    = 'effort_count'
      and observed_at >= now() - interval '8 days'
    group by station_id
  ),
  lagged as (
    -- One row per daily snapshot; compute delta vs previous snapshot
    select
      station_id,
      observed_at,
      value,
      lag(value) over (partition by station_id order by observed_at) as prev_value
    from observations
    where parameter    = 'effort_count'
      and observed_at >= date_trunc('year', now() at time zone 'America/Los_Angeles')
                           at time zone 'America/Los_Angeles'
  ),
  active_days as (
    -- Only rows where effort_count actually increased (real boot traffic)
    select
      station_id,
      (observed_at at time zone 'America/Los_Angeles')::date as activity_date
    from lagged
    where prev_value is not null
      and value > prev_value
  ),
  season_bounds as (
    select
      station_id,
      min(activity_date) as season_opener,
      max(activity_date) as last_active
    from active_days
    group by station_id
  )
select
  w.station_id,
  w.weekly_efforts,
  w.last_seen,
  sb.season_opener,
  sb.last_active,
  -- season_closer: surface last_active only after 14+ days of silence
  -- During active season this is null so it doesn't clutter the popup.
  case
    when sb.last_active is not null
     and (now() at time zone 'America/Los_Angeles')::date - sb.last_active >= 14
    then sb.last_active
    else null
  end as season_closer
from weekly w
left join season_bounds sb using (station_id);

grant select on segment_weekly_efforts to anon;
