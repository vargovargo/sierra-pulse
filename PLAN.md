# Sierra Pulse — Gap Resolution + Spec Sync Plan

## Context

This plan addresses the gaps identified between the built Phase 1 code, the SVG architecture diagram, and the updated spec. Two spec changes were found: (1) **AirNow (EPA)** added as a new data source for AQI/PM2.5, now a 4th signal in strike window detection alongside conditions, boot traffic, and permits; and (2) new **Positioning** section establishing range-agnostic architecture and hub-not-destination UX intent.

User feedback on each gap shaped the approach below:
- Cron frequency: conservative 6h for snowpack/streamflow is fine; not too aggressive
- Fire geometry: simplify perimeter points with RDP algorithm — no Supabase Storage needed for most fires
- Latest observations: use Postgres view + synthetic seed data
- Vercel Pro: avoid for now; stay on Supabase-cron-only
- CDEC scale timeout: batch approach in Supabase edge functions

---

## Status

| Item | Status |
|------|--------|
| 1. Migration: `station_latest_obs` view + AirNow enum + geometry col | ✅ Done |
| 2. `useLatestObservations` → query `station_latest_obs` view | ✅ Done |
| 3. Synthetic seed observations (48h SWE + discharge + AQI) | ✅ Done |
| 4. AirNow ingest function (mapper.ts, mapper.test.ts, index.ts) | ✅ Done |
| 5. Cron frequency audit: CDEC 12h, ingest-aqi 2h | ✅ Done |
| 6. CDEC concurrent batch processing (Promise.allSettled, BATCH_SIZE=10) | ✅ Done |
| 7. USGS API migration feature flag (`USGS_API_VERSION=new`) | ✅ Done |
| 8. Fire geometry RDP approach (documented in CLAUDE.md for Phase 4) | ✅ Done |
| 9. Spec sync: AirNow strike window signal, range-agnostic note | ✅ Done |
| 10. CLAUDE.md updated (AirNow source, 4-signal strike window, gotchas) | ✅ Done |

---

## Items in scope

### 1. New migration: `station_latest_obs` view + AirNow enum + stations geometry column

**File**: `supabase/migrations/20260314000001_improvements.sql`

- `alter type station_source add value 'airnow'`
- `create view station_latest_obs as select distinct on (station_id, parameter) ...`
- `grant select on station_latest_obs to anon`
- `alter table stations add column geometry jsonb`

**Why DISTINCT ON over materialized view**: A regular view recomputes on each query but avoids a refresh job. At Phase 1–2 data volumes (~20k rows), DISTINCT ON over the existing compound index is sub-10ms. Revisit materialized view at Phase 4+ when data volumes grow.

---

### 2. Update `useLatestObservations` to query the view

**File**: `src/hooks/useObservations.js`

Changed `from('observations')` → `from('station_latest_obs')`. Dropped `order` and client-side reduction loop — the view returns one row per (station_id, parameter).

---

### 3. Synthetic seed observations

**File**: `supabase/seed.sql`

Added 48h of hourly observations for all seeded stations:
- SWE for CDEC snow stations (typical April water year values)
- Discharge for USGS gauges (typical peak melt values)
- AQI for AirNow stations (good baseline, no smoke event)

`station_latest_obs` view returns the most recent regardless of source — works correctly with both synthetic and real ingest rows.

---

### 4. AirNow ingest function

**New files**:
- `supabase/functions/ingest-aqi/mapper.ts` — pure parse logic, no Deno imports
- `supabase/functions/ingest-aqi/mapper.test.ts` — Vitest unit tests (~25 tests)
- `supabase/functions/ingest-aqi/index.ts` — Deno edge function

**API**: `https://www.airnowapi.org/aq/observation/latLong/current/`

**Sierra stations queried**: Bishop, Mammoth Lakes, Yosemite Valley

**Strike window thresholds**:
- AQI ≤ 100 → clear
- AQI 101–150 → caution
- AQI > 150 → blocked

**Secret**: `AIRNOW_API_KEY` — set via `supabase secrets set AIRNOW_API_KEY=<key>`

---

### 5. Cron frequency

| Function | Schedule | Rationale |
|----------|----------|-----------|
| `ingest-cdec` | `0 */12 * * *` | Snowpack changes daily not hourly |
| `ingest-usgs` | `0 */6 * * *` | Discharge spikes in hours during melt |
| `ingest-nps-alerts` | `0 */2 * * *` | Fine |
| `ingest-aqi` | `0 */2 * * *` | Smoke moves fast |

---

### 6. CDEC batch strategy

**File**: `supabase/functions/ingest-cdec/index.ts`

Extracted `processStation()` helper. Main loop uses `Promise.allSettled` over batches of `BATCH_SIZE=10`. 25 stations ÷ 10 = 3 batches × ~5s = ~15s total. Well within the 150s edge function timeout.

Scales to ~130 stations: 13 batches × 5s = ~65s. Still under timeout.

---

### 7. USGS API migration feature flag

**File**: `supabase/functions/ingest-usgs/parser.ts`

`buildUsgsUrl` now checks `USGS_API_VERSION=new` env var and uses the new `api.waterdata.usgs.gov` endpoint if set. Comment documents the 2027 cutover deadline.

---

### 8. Fire geometry simplification (Phase 4)

Documented in CLAUDE.md. When building `ingest-fire`:
- Implement `rdpSimplify(coordinates, tolerance)` pure function (~30 lines TypeScript)
- Use tolerance `0.005` (≈500m at Sierra latitudes)
- Reduces 10k–50k point perimeters to ~200–500 points
- No Supabase Storage needed; store simplified GeoJSON directly in `fire_perimeters.geometry`

---

### 9. Range-agnostic architecture

No `region` column added (over-engineering for Phase 1–5). When a second range is added, a single migration handles it. Documented in CLAUDE.md.

---

## Files modified/created

| Action | File |
|--------|------|
| Created | `supabase/migrations/20260314000001_improvements.sql` |
| Edited | `supabase/seed.sql` — AirNow stations + 48h synthetic observations |
| Edited | `supabase/config.toml` — CDEC 12h, ingest-aqi 2h |
| Edited | `src/hooks/useObservations.js` — query `station_latest_obs` view |
| Created | `supabase/functions/ingest-aqi/mapper.ts` |
| Created | `supabase/functions/ingest-aqi/mapper.test.ts` |
| Created | `supabase/functions/ingest-aqi/index.ts` |
| Edited | `supabase/functions/ingest-usgs/parser.ts` — API version flag + TODO |
| Edited | `supabase/functions/ingest-cdec/index.ts` — concurrent batch processing |
| Edited | `CLAUDE.md` — AirNow, 4-signal strike window, gotchas, range-agnostic note |
| Created | `PLAN.md` — this file |

---

## Verification checklist

1. `npm test` — all existing tests pass; new AirNow mapper tests pass (~25 new tests)
2. `supabase db reset` → `station_latest_obs` view returns 1 row per station/parameter
3. `npm run dev` → PulseStatusPage loads with populated station table and 48h chart (no ingest needed)
4. `supabase secrets set AIRNOW_API_KEY=<key>` → `supabase functions invoke ingest-aqi` → `{ observations_inserted: N, errors: [] }`
5. `node scripts/check-ingestion.js` — add AirNow section to live check script (future)
6. `npm run build` — clean build, no new bundle warnings
