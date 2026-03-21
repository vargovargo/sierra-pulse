-- Sierra Pulse — initial schema
-- Run: supabase db push

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type station_source as enum ('cdec', 'usgs', 'noaa', 'strava_segment');
create type station_type   as enum ('snow', 'streamflow', 'weather', 'trail_segment');
create type alert_source   as enum ('nps', 'usfs', 'caltrans');
create type alert_category as enum ('closure', 'danger', 'caution', 'info');
create type permit_type    as enum ('overnight', 'day_use', 'campground');

-- ---------------------------------------------------------------------------
-- stations
-- ---------------------------------------------------------------------------

create table stations (
  id           uuid primary key default gen_random_uuid(),
  source       station_source not null,
  source_id    text not null,
  name         text not null,
  lat          double precision,
  lon          double precision,
  elevation_ft integer,
  type         station_type not null,
  metadata     jsonb default '{}',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(source, source_id)
);

-- ---------------------------------------------------------------------------
-- observations
-- ---------------------------------------------------------------------------

create table observations (
  id          uuid primary key default gen_random_uuid(),
  station_id  uuid not null references stations(id) on delete cascade,
  observed_at timestamptz not null,
  parameter   text not null,
  value       double precision not null,
  unit        text not null,
  created_at  timestamptz default now()
);

-- All time-series queries filter by station + parameter + time desc
create index observations_station_time
  on observations(station_id, parameter, observed_at desc);

-- Prevents duplicate observations on re-ingest runs
create unique index observations_dedup
  on observations(station_id, parameter, observed_at);

-- ---------------------------------------------------------------------------
-- alerts
-- ---------------------------------------------------------------------------

create table alerts (
  id             uuid primary key default gen_random_uuid(),
  source         alert_source not null,
  source_id      text not null,
  title          text not null,
  description    text,
  category       alert_category not null default 'info',
  park_or_forest text,
  lat            double precision,
  lon            double precision,
  geometry       jsonb,
  published_at   timestamptz,
  expires_at     timestamptz,
  created_at     timestamptz default now(),
  unique(source, source_id)
);

create index alerts_source_idx on alerts(source);
create index alerts_published_idx on alerts(published_at desc);

-- ---------------------------------------------------------------------------
-- permits
-- ---------------------------------------------------------------------------

create table permits (
  id           uuid primary key default gen_random_uuid(),
  trailhead    text not null,
  trailhead_id text not null,
  date         date not null,
  quota        integer,
  available    integer,
  permit_type  permit_type not null default 'overnight',
  forest       text,
  checked_at   timestamptz default now(),
  unique(trailhead_id, date, permit_type)
);

create index permits_trailhead_date_idx on permits(trailhead_id, date);

-- ---------------------------------------------------------------------------
-- fire_perimeters
-- ---------------------------------------------------------------------------

create table fire_perimeters (
  id              uuid primary key default gen_random_uuid(),
  fire_name       text not null,
  irwin_id        text unique,
  acres           double precision,
  containment_pct integer,
  discovered_at   timestamptz,
  geometry        jsonb,
  status          text,
  updated_at      timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- zones
-- ---------------------------------------------------------------------------

create table zones (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  geometry       jsonb,
  description    text,
  station_ids    uuid[] default '{}',
  segment_ids    uuid[] default '{}',
  trailhead_ids  text[] default '{}'
);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table stations        enable row level security;
alter table observations    enable row level security;
alter table alerts          enable row level security;
alter table permits         enable row level security;
alter table fire_perimeters enable row level security;
alter table zones           enable row level security;

-- Public read on all tables; writes restricted to service role (edge functions)
create policy "public read stations"         on stations        for select using (true);
create policy "public read observations"     on observations    for select using (true);
create policy "public read alerts"           on alerts          for select using (true);
create policy "public read permits"          on permits         for select using (true);
create policy "public read fire_perimeters"  on fire_perimeters for select using (true);
create policy "public read zones"            on zones           for select using (true);
