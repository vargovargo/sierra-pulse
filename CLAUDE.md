# Sierra Pulse — CLAUDE.md

A living portrait of the Sierra Nevada, updated daily. Decision-support tool for backcountry travelers synthesizing snowpack, streamflow, weather, fire, road access, human trail activity (Strava), and permit availability.

## Core concept

**Strike window**: conditions + air quality + boot traffic + permits align → flag the moment for a specific zone.

AQI signal thresholds (Phase 5 strike window engine):
- AQI ≤ 100 → breathable (clear for strike window)
- AQI 101–150 → caution flag
- AQI > 150 → strike window blocked

## Tech stack

- **Frontend**: React 19 + Vite 7, Tailwind v4 via `@tailwindcss/vite`
- **Backend/DB**: Supabase (Postgres + Edge Functions + Cron)
- **Map**: Mapbox GL JS (Phase 2+)
- **Charts**: Recharts (Phase 1–2), D3.js for historical envelope charts (Phase 3+)
- **Deploy**: Vercel (frontend), Supabase hosted (edge functions)

## Project structure

```
src/
  lib/          supabase.js (singleton), formatters.js
  hooks/        useStations, useObservations, useAlerts
  components/
    layout/     AppShell, StatusBar
    data/       StationsTable, ObservationsChart, AlertsList, StatCard
    shared/     Badge, LoadingSpinner, ErrorBoundary
  pages/        PulseStatusPage (Phase 1 proof-of-life)
supabase/
  migrations/   20260314000000_init.sql (full schema)
                20260314000001_improvements.sql (station_latest_obs view, airnow enum, geometry col)
  functions/
    _shared/    supabaseAdmin.ts, cors.ts
    ingest-cdec/
    ingest-usgs/
    ingest-nps-alerts/
    ingest-aqi/
    ingest-fire/
    ingest-roads/
    ingest-strava/   zones.ts (12 zones, Bishop 6 active), client.ts, index.ts
    ingest-permits/  divisions.ts (Inyo NF facility 233262, 8 Bishop divisions), index.ts
  seed.sql      (48h synthetic obs — delete with fractional-second timestamp filter before prod)
```

## Design tokens (src/index.css)

- `--c-bg`, `--c-surface`, `--c-surface-2`, `--c-border`
- `--c-text`, `--c-text-muted`, `--c-text-dim`
- `--c-snow` (blue) — snow/water data
- `--c-fire` (orange) — fire/heat
- `--c-go` (green) — open/passable
- `--c-stop` (red) — closed/danger
- `--c-warn` (amber) — caution

Color encodes meaning, not decoration. Dark theme by default.

## Data sources

| Source | What | Schedule | Auth |
|--------|------|----------|------|
| CDEC   | SWE, snow depth, precip, temp | 12h | None |
| USGS   | Discharge (cfs), gage height | 6h | None |
| NPS API | Park alerts (Yosemite/SEKI/Devils Postpile) | 2h | `NPS_API_KEY` |
| AirNow (EPA) | AQI, PM2.5 (smoke signal) | 2h | `AIRNOW_API_KEY` |
| Caltrans LCS | Road closures, chain controls | 30min | None |
| NIFC ArcGIS | Fire perimeters | 30min/daily | None |
| Strava | Segment effort counts (boot traffic) | Daily | OAuth |
| Recreation.gov RIDB | Permit availability | 2h | `RIDB_API_KEY` |

## Infrastructure decisions

**Hosted Supabase, not local Docker.** Docker Desktop had a corrupted metadata store (`meta.db` I/O error) that prevented `supabase start` from pulling images. Rather than debug Docker, we switched to the hosted Supabase free tier (`kcvjovrsxxttqvlikyhc`). This is the permanent dev setup — no local Supabase needed.

Migrations and seed were applied via **Supabase dashboard → SQL Editor** (paste and run each file).

**Cron schedules** are set via **Supabase dashboard → Database → Cron Jobs**, not config.toml. The `schedule` key in `[functions.*]` config.toml is not supported by the current CLI version — removed and replaced with comments.

## Supabase setup (hosted)

```bash
# Link to hosted project
supabase link --project-ref kcvjovrsxxttqvlikyhc

# Deploy functions (--use-api bypasses Docker bundling)
supabase functions deploy ingest-cdec --use-api --no-verify-jwt
supabase functions deploy ingest-usgs --use-api --no-verify-jwt
supabase functions deploy ingest-nps-alerts --use-api --no-verify-jwt
supabase functions deploy ingest-aqi --use-api --no-verify-jwt
supabase functions deploy ingest-strava --use-api --no-verify-jwt
supabase functions deploy ingest-permits --use-api --no-verify-jwt
supabase functions deploy compute-strike-windows --use-api --no-verify-jwt

# Set secrets
supabase secrets set NPS_API_KEY=...
supabase secrets set AIRNOW_API_KEY=...
supabase secrets set STRAVA_CLIENT_ID=...
supabase secrets set STRAVA_CLIENT_SECRET=...
supabase secrets set STRAVA_REFRESH_TOKEN=...
supabase secrets set RIDB_API_KEY=...

# Invoke via curl (supabase functions invoke not available in current CLI)
curl -s -X POST "https://kcvjovrsxxttqvlikyhc.supabase.co/functions/v1/ingest-cdec"
# (functions deployed with --no-verify-jwt, so no auth header needed)
```

## Environment variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_MAPBOX_TOKEN        # needed for Phase 2
```

Supabase function secrets: `NPS_API_KEY`, `AIRNOW_API_KEY`, `RIDB_API_KEY` (Phase 5), `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` (Phase 5)

## Phases

- **Phase 1 ✅**: Data spine — CDEC + USGS + NPS alerts + AirNow ingestion, proof-of-life dashboard
- **Phase 2 ✅**: Mapbox terrain map, station markers (snow/streamflow/AQI), NPS alert overlays, 3D terrain, popups
- **Phase 3 ✅**: Historical context — current year vs. historical envelope charts
- **Phase 4 ✅**: Fire perimeters (NIFC), road/pass status (Caltrans)
- **Phase 5 ✅**: Boot traffic (Strava) + permit availability (Recreation.gov) → **strike window detection**
  - 5a ✅ `ingest-strava` — segment discovery + effort_count observations (Bishop-area zones active)
  - 5b ✅ `ingest-permits` — Recreation.gov RIDB permit availability (stations registered; data live May 1 when Inyo NF season opens)
  - 5c ✅ `compute-strike-windows` — combines AQI + snowpack + boot traffic + permits into per-zone score + `/strike` page
- **Phase 6**: Sentinel-2 NDSI snow cover, melt-out estimates, zone narrative reports (Claude API)

## Phase 6 note — Claude API

Zone narrative reports in Phase 6 will use the **claude-api** skill to generate natural-language condition summaries from structured sensor data. Use `claude-sonnet-4-6` as the default model.

## Ingest function conventions

- All functions use `_shared/supabaseAdmin.ts` for write access (service role)
- All functions use `_shared/cors.ts` for CORS headers
- Observations upsert with `ON CONFLICT (station_id, parameter, observed_at) DO NOTHING` — idempotent re-runs
- Stations upsert with `ON CONFLICT (source, source_id)` — safe to re-run
- All functions return `{ stations_upserted, observations_inserted, errors[] }`

## Phase 4 setup (fire + roads)

Deploy the two new edge functions:
```bash
supabase functions deploy ingest-fire  --use-api --no-verify-jwt
supabase functions deploy ingest-roads --use-api --no-verify-jwt
```

No migrations needed — `fire_perimeters` and `alerts` (with `caltrans` source) were already in the schema.

Cron jobs to add in **Dashboard → Database → Cron Jobs**:
- `ingest-fire`:  `*/30 * * * *` (or `0 0 * * *` outside fire season)
- `ingest-roads`: `*/30 * * * *`

USFS alerts skipped for now — no reliable public JSON feed; revisit in Phase 6.

## Phase 3 setup (historical normals)

Apply the migration and seed in **Supabase dashboard → SQL Editor**:
1. Run `supabase/migrations/20260315000000_historical_normals.sql`
2. Run `supabase/seed_historical.sql`

The `daily_observations` view aggregates hourly → daily on the fly (no extra table).
The `/history` route renders the envelope charts for GIN SWE (days 1–210) and Merced discharge (days 1–300).

Until real ingest populates the `observations` table, the current-year line will be flat/absent — only the historical envelope bands will show.

## Open issues / gaps to resolve next session

### Strike window engine (Phase 5c) — DONE
`compute-strike-windows` edge function in place. Migration `20260316000000_strike_windows.sql` adds `strike_windows` table. `/strike` page in frontend. Deploy + add cron (see below).

Setup steps:
1. Run `supabase/migrations/20260316000000_strike_windows.sql` in Supabase dashboard SQL Editor
2. Deploy: `supabase functions deploy compute-strike-windows --use-api --no-verify-jwt`
3. Add cron in Dashboard → Database → Cron Jobs: `0 */2 * * *` → `compute-strike-windows`
4. Invoke manually to verify: `curl -s -X POST "https://kcvjovrsxxttqvlikyhc.supabase.co/functions/v1/compute-strike-windows"`

Notes:
- Strava segments matched to zones by bounding-box geography (no zone stored in metadata)
- Traffic signal uses **weekly effort delta** (not cumulative total) via `segment_weekly_efforts` view
- Traffic thresholds: < 10/week = low, 10–30 = moderate, > 30 = high
- AQI uses Bishop station for all 6 Bishop-area zones
- SWE: first CDEC source_id in zone config with data wins; falls back to next in list
- Off-season permits (before May 1): `permits_avail = null` → permits score = 20 (neutral)

### segment_weekly_efforts view — PENDING MIGRATION
`supabase/migrations/20260316000001_segment_weekly_efforts.sql` adds the view. **Not yet applied.**
Run in Supabase dashboard SQL Editor before next session.

View columns: `weekly_efforts`, `last_seen`, `season_opener`, `last_active`, `season_closer`
- `season_opener` — first date this year effort_count increased (trail came alive)
- `season_closer` — last active date, only exposed after 14+ days of silence (trail gone quiet)
- Both shown in map popup for trail_segment markers

### CDEC stations — confirmed live (Eastern Sierra)
Verified by running ingest and checking DB. 17 live stations total.
- `BSH` (Bishop Pass, 11,200ft) ✅ — added this session, primary for South Lake / Bishop Pass zone
- `RCK` (Rock Creek Lakes, 10,000ft) ✅ — added this session, primary for Rock Creek + Pine Creek zones
- `PPS`, `BSP`, `BGP` ❌ — tried, don't exist in CDEC
- `ROC` ❌ — was in original list, never returned data, removed
- North Lake / Lake Sabrina / Big Pine Creek zones fall back to `SLK` / `GRZ` — acceptable proxies
- More Eastern Sierra station IDs to find: look up CDEC station search at cdec.water.ca.gov

### Cron jobs — SQL command format
All cron jobs must use named params and jsonb casting or they silently fail:
```sql
select net.http_post(
  url := 'https://kcvjovrsxxttqvlikyhc.supabase.co/functions/v1/<function-name>',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{}'::jsonb
);
```

Full schedule:
| Job | Schedule | Function |
|-----|----------|----------|
| `cdec-ingest` | `0 */12 * * *` | `ingest-cdec` |
| `usgs-ingest` | `0 */6 * * *` | `ingest-usgs` |
| `nps-ingest` | `0 */2 * * *` | `ingest-nps-alerts` |
| `aqi-ingest` | `0 */2 * * *` | `ingest-aqi` |
| `strava-ingest` | `0 6 * * *` | `ingest-strava` |
| `permits-ingest` | `0 */2 * * *` | `ingest-permits` |
| `strike-windows` | `0 */2 * * *` | `compute-strike-windows` |

### Strava — rate limit
Strava API limit: 100 req/15min. With 6 Bishop-area zones: 6 explore + up to 60 detail fetches = safe.
Do not test back-to-back — wait 15min between manual invocations. Daily cron never hits the limit.
Zones scoped to Bishop area only. Expand by uncommenting zones in `ingest-strava/zones.ts`.

### Recreation.gov permits — seasonal
Inyo NF wilderness permit (facility `233262`) is disabled in PermitService outside of permit season.
Permit season opens ~May 1. `ingest-permits` handles this gracefully (WARN, no crash).
Division IDs for Bishop trailheads are in `ingest-permits/divisions.ts` — correct and verified.
Availability endpoint: `GET https://www.recreation.gov/api/permits/{id}/availability/month?start_date=YYYY-MM-01T00:00:00.000Z`
Requires `User-Agent` header and `apikey` header. Date must be first of month (ISO timestamp).

### Map — Strava trail segment markers
`MapView.jsx` already has `trail_segment` marker style (green ▲) and `effort_count` param wired.
Markers will appear after `ingest-strava` populates stations with `type='trail_segment'`.
`useLatestObservations` updated to include `effort_count` in param list.

### Map component notes
- `src/components/map/MapView.jsx` — Mapbox GL JS, 3D terrain, HTML markers
- NPS alert markers only appear if `alerts.lat` / `alerts.lon` are populated — current seed has no alert coordinates, so alert markers won't show until real NPS ingest runs
- Mapbox marker hover: scale transform must go on inner child div, not the outer `el` (outer el is managed by Mapbox for positioning)

## Known gotchas

- CDEC CSV: `---` values = nodata (skip). Sensor num encoded in description as `(N)`.
- CDEC: out-of-range values (e.g. 2880" snow depth) are filtered before upsert via `filterValidRows()` in `parser.ts`. Same pattern in ingest-usgs and ingest-aqi.
- USGS: nodata sentinel is `-999999`. Fetch all gauges in one request (comma-separated site IDs).
- USGS migrating to `api.waterdata.usgs.gov` by early 2027 — feature-flagged via `USGS_API_VERSION=new` env var in `ingest-usgs/parser.ts`.
- NPS alert descriptions often contain HTML — strip `<script>` and `<style>` before rendering, use `dangerouslySetInnerHTML` for remaining formatting.
- AirNow: `DateObserved` field has trailing whitespace — trim before parsing. Returns AQI-equivalent for PM2.5, not raw µg/m³.
- CDEC at scale: ingest-cdec uses `Promise.allSettled` batches of 10 to stay under the 150s edge function timeout.
- Strava: rate limit 100 req/15min. Explorer returns max 10 segments per bounding box. Stations upserted from explore data (no extra request); detail fetch capped at 80 for effort_count.
- Recreation.gov availability API: requires `User-Agent` header + ISO timestamp date (`T00:00:00.000Z`). Internal API, not RIDB v1. Inyo permit disabled off-season.
- seed.sql timestamps have microsecond precision (`now() - interval`); real ingest uses clean second boundaries. Delete seed obs with: `DELETE FROM observations WHERE observed_at != date_trunc('second', observed_at);`

## Range-agnostic architecture note

Current schema is Sierra-specific only through its data, not its structure. No `region` column exists yet — this is intentional. When a second range is added, a single `alter table stations add column region text default 'sierra-nevada'` migration handles it. Don't add a `region` field before Phase 6+.

## Fire geometry (Phase 4)

Simplify fire perimeter geometry with Ramer-Douglas-Peucker algorithm (tolerance ~0.005°, ≈500m) before writing to `fire_perimeters.geometry` jsonb. Reduces 10k–50k point perimeters to ~200–500 points (98%+ reduction). Implement as `rdpSimplify(coordinates, tolerance)` pure function in `ingest-fire/parser.ts`. No Supabase Storage needed.
