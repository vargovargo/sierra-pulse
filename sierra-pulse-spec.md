# Sierra Pulse — Project Specification

**A living portrait of the Sierra Nevada, updated daily.**

Sierra Pulse stitches together snowpack, streamflow, weather, fire, road access, official conditions reports, human trail activity, and permit availability into a single decision-support tool for backcountry travelers. It answers the question nobody else is answering in one place: *Can I go, are people getting through, and can I get a permit?*

---

## Core Concept: The Strike Window

A **strike window** is the moment when conditions, access, and availability all align for a specific zone or trailhead. Sierra Pulse surfaces these windows by synthesizing three signal types:

1. **Conditions** — sensor data + official reports (snowpack, streamflow, weather, fire, road status, NPS/USFS alerts)
2. **Boot traffic** — Strava segment effort deltas showing whether people are actually getting through a pass or trail
3. **Permit availability** — real-time wilderness permit openings from Recreation.gov

When all three align — conditions are favorable, boot traffic confirms passability, and permits are available — that's a strike window.

---

## Data Sources

### Sensor & Environmental Data

| Source | Data | API/Format | Update Freq | Auth |
|--------|------|------------|-------------|------|
| **CDEC** (CA Dept of Water Resources) | Snow water equivalent, snow depth, precipitation, temperature at ~130 Sierra sensors | CSV via servlet: `cdec.water.ca.gov/dynamicapp/req/CSVDataServlet?Stations={ID}&SensorNums={NUM}&dur_code={D/H/E}&Start={date}&End={date}` | 15 min | None |
| **USGS Water Services** | Streamflow (discharge), gage height at Sierra stream gauges | JSON via REST: `waterservices.usgs.gov/nwis/iv/?sites={ID}&parameterCd=00060&format=json` — migrating to `api.waterdata.usgs.gov` by early 2027 | 15–60 min | None |
| **NOAA Weather** | Temperature, precipitation, wind, forecasts | JSON REST: `api.weather.gov` | Hourly | None |
| **NIFC** (National Interagency Fire Center) | Active fire perimeters, fire size, containment, cause | ArcGIS FeatureServer (GeoJSON): `services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/Public_Wildfire_Perimeters_View/FeatureServer` | 5 min (fire season) | None |
| **AirNow** (EPA) | Air quality index (AQI), PM2.5 concentrations — smoke is the key signal for Sierra backcountry | JSON/CSV/XML via REST: `docs.airnowapi.org` — query by lat/lon bounding box or reporting area | Hourly | Free API key |
| **Caltrans LCS** (Lane Closure System) | Road closures, chain controls, construction — all Sierra highways | JSON/CSV/XML: `cwwp2.dot.ca.gov` — data by district, refreshed every 5 min | 5 min | None |
| **Sentinel-2** (ESA Copernicus) | Satellite imagery for snow cover mapping via NDSI (Normalized Difference Snow Index) | COG tiles via STAC API: `earth-search.aws.element84.com/v0/` — Bands B03 (green) and B11 (SWIR) at 20m resolution | 5-day revisit | None |

### Human & Administrative Data

| Source | Data | API/Format | Update Freq | Auth |
|--------|------|------------|-------------|------|
| **NPS API** | Park alerts: closures, hazards, trail conditions for Yosemite (`yose`), Sequoia-Kings Canyon (`seki`), Devils Postpile (`depo`) | JSON REST: `developer.nps.gov/api/v1/alerts?parkCode={codes}` | ~2 hours | Free API key |
| **USFS Alerts** | Forest closures, fire restrictions, trail conditions for Inyo, Sierra, Sequoia, Stanislaus, Tahoe National Forests | HTML (structured scrape from `fs.usda.gov/alerts/{forest}/alerts-notices`) | Daily | None |
| **Strava Segments** (Boot Traffic) | Effort counts on curated Sierra pass/trail segments — delta over time = human traffic signal | JSON REST: `strava.com/api/v3/segments/{id}` returns `effort_count`, `athlete_count`; `segments/explore?bounds=` for discovery | Daily poll | OAuth (app-level) |
| **Recreation.gov RIDB** (Permit Availability) | Wilderness permit availability for Inyo NF, Yosemite, SEKI trailheads | JSON REST: `ridb.recreation.gov/api/v1/permits` + availability endpoints | Hourly poll | Free API key |
| **ReserveCalifornia** (Campground Availability) | State park campsite availability for Eastern Sierra basecamps (Convict Lake, June Lake, etc.) | Undocumented JSON: `calirdr.usedirect.com/rdr/rdr/search/grid` with facility IDs — no official API, but proven by multiple open-source projects | Hourly poll | None (fragile — build with graceful failure) |

---

## Key Sierra Segments to Curate (Boot Traffic)

Pre-define Strava segments for critical chokepoints. These represent the passes, crossings, and trail sections where "is it passable?" is the key question. Initial target: 30–50 segments.

### Priority Passes (north to south)
- Tioga Pass (SR 120)
- Donohue Pass
- Island Pass
- Silver Pass
- Selden Pass
- Muir Pass
- Mather Pass
- Pinchot Pass
- Glen Pass
- Forester Pass
- Kearsarge Pass
- Bishop Pass
- Piute Pass
- Lamarck Col
- North/South Palisade approaches
- Baxter Pass
- Shepherd Pass
- Cottonwood Pass
- Trail Crest / Mt Whitney Trail
- Army Pass

### Priority Creek Crossings
- Evolution Creek
- Bear Creek
- Piute Creek
- South Fork San Joaquin
- Middle Fork Kings River
- Bubbs Creek

### Key Trail Sections
- JMT major segments
- High Sierra Trail segments
- Sierra High Route segments
- PCT through-sections

---

## Architecture

### Tech Stack
- **Frontend**: React + Vite (deployed on Vercel)
- **Backend/DB**: Supabase (Postgres + Edge Functions + Storage + Cron)
- **Map**: Mapbox GL JS (terrain, 3D, custom layers)
- **Charts**: D3.js or Recharts (time-series)
- **Satellite processing**: Client-side or edge function NDSI computation from COG tiles
- **Domain**: Standalone site (TBD — sierrapulse.com, sierrapulse.org, etc.)

### Database Schema (Supabase/Postgres)

```
stations
  id (uuid, pk)
  source (enum: cdec, usgs, noaa, strava_segment)
  source_id (text) — external ID from the source system
  name (text)
  lat (float)
  lon (float)
  elevation_ft (int)
  type (enum: snow, streamflow, weather, trail_segment)
  metadata (jsonb) — source-specific fields
  created_at, updated_at

observations
  id (uuid, pk)
  station_id (fk → stations)
  observed_at (timestamptz)
  parameter (text) — e.g. 'swe', 'snow_depth', 'discharge', 'temp', 'effort_count'
  value (float)
  unit (text)
  created_at

alerts
  id (uuid, pk)
  source (enum: nps, usfs, caltrans)
  source_id (text)
  title (text)
  description (text)
  category (enum: closure, danger, caution, info)
  park_or_forest (text)
  lat (float, nullable)
  lon (float, nullable)
  geometry (jsonb, nullable) — for fire perimeters, closure areas
  published_at (timestamptz)
  expires_at (timestamptz, nullable)
  created_at

permits
  id (uuid, pk)
  trailhead (text)
  trailhead_id (text) — recreation.gov ID
  date (date)
  quota (int)
  available (int)
  permit_type (enum: overnight, day_use)
  forest (text)
  checked_at (timestamptz)

fire_perimeters
  id (uuid, pk)
  fire_name (text)
  irwin_id (text)
  acres (float)
  containment_pct (int)
  discovered_at (timestamptz)
  geometry (jsonb) — GeoJSON polygon
  status (text)
  updated_at

zones
  id (uuid, pk)
  name (text) — e.g. 'Evolution Region', 'Palisades', 'Whitney Zone'
  geometry (jsonb) — GeoJSON polygon boundary
  description (text)
  station_ids (uuid[]) — linked sensor stations
  segment_ids (uuid[]) — linked Strava segments
  trailhead_ids (text[]) — linked recreation.gov trailheads
  external_links (jsonb) — curated outbound links: AllTrails search URLs, NPS/USFS condition pages, etc.
    e.g. { "alltrails": "https://alltrails.com/explore?q=kearsarge+pass",
           "usfs_conditions": "https://fs.usda.gov/...",
           "nps_conditions": "https://nps.gov/yose/planyourvisit/conditions.htm" }
```

### Ingestion Pipeline

Each data source gets a Supabase Edge Function (or Vercel cron) that runs on a schedule:

| Job | Schedule | Source | Target Table |
|-----|----------|--------|--------------|
| `ingest-cdec` | Every 6 hours | CDEC CSV servlet | observations |
| `ingest-usgs` | Every 6 hours | USGS Water Services JSON | observations |
| `ingest-noaa` | Every 6 hours | NOAA weather API | observations |
| `ingest-fire` | Every 30 min (fire season) / daily (off-season) | NIFC ArcGIS | fire_perimeters |
| `ingest-aqi` | Every 2 hours | AirNow API | observations (aqi, pm25) |
| `ingest-caltrans` | Every 30 min | Caltrans LCS JSON | alerts |
| `ingest-nps-alerts` | Every 2 hours | NPS API /alerts | alerts |
| `scrape-usfs-alerts` | Daily | USFS alert pages (HTML) | alerts |
| `ingest-strava` | Daily | Strava segment detail API | observations (effort_count) |
| `ingest-permits` | Every 2 hours | Recreation.gov RIDB | permits |
| `ingest-campgrounds` | Every 2 hours | ReserveCalifornia (usedirect.com) | permits (type: campground) |

### Derived Computations

These run after ingestion, as Postgres functions or scheduled edge functions:

- **Boot traffic delta**: `effort_count(today) - effort_count(7_days_ago)` per segment
- **Snowpack vs. historical**: current SWE vs. median/min/max for same date across available years
- **Melt-out estimate**: linear projection from current snowpack + historical melt rate + forecast temps
- **Strike window detection**: zone has (favorable conditions) + (breathable air quality) + (positive boot traffic) + (available permits) → flag as "strike window open"

---

## Phased Roadmap

### Phase 1: Data Spine (Weeks 1–2)
- Set up Supabase project + schema
- Implement `ingest-cdec` for all Sierra snow sensors (~130 stations)
- Implement `ingest-usgs` for Sierra streamflow gauges
- Implement `ingest-nps-alerts` for Yosemite, SEKI, Devils Postpile
- Basic proof-of-life page: table or simple chart showing data is flowing
- Register for API keys: NPS, Recreation.gov RIDB, Strava, Mapbox

### Phase 2: The Map (Weeks 2–3)
- Mapbox GL JS terrain map of the Sierra Nevada
- Station markers color-coded by type and current value
- Click station → popup with current reading + sparkline
- Alert overlay (closures, hazards as icons on map)
- Mobile-responsive layout
- Deploy to Vercel with custom domain

### Phase 3: Historical Context (Weeks 3–4)
- Time-series charts: current water year vs. historical envelope
- "Is this a big snow year?" visualization
- Add NOAA weather data for temperature/precip context
- Snowpack % of April 1 average by region (Northern, Central, Southern Sierra)
- Zone-based summary cards

### Phase 4: Fire, Roads & Access (Weeks 4–5)
- NIFC fire perimeter overlay (GeoJSON polygons on map)
- Caltrans road/pass status integration
- USFS alert scraping for forest closures
- Pass status timeline: historical open/close dates vs. current year

### Phase 5: Boot Traffic + Permits (Weeks 5–6)
- Curate initial Strava segment list (30–50 key segments)
- Daily effort count polling + delta computation
- Boot traffic indicators on map (green/yellow/red/gray)
- Recreation.gov permit availability polling
- Permit availability display per trailhead
- **Strike window detection and display**

### Phase 6: Polish & Trip Planning (Weeks 6+)
- Trip planning mode: select a zone, see everything relevant in one view
- Strike window notifications or alerts
- Historical pass open/close date timeline vs. current year
- Mobile optimization and performance tuning
- See "Future Features" section for post-MVP ambitions (satellite NDSI, GPX import, etc.)

---

## Design Direction

**Tone**: Utilitarian but beautiful. Think topographic map meets weather dashboard. The Sierra is dramatic — let the terrain do the visual heavy lifting via Mapbox 3D terrain, then keep the data overlays clean and functional.

**Key design principles**:
- Dark theme by default (works better with map-centric layouts)
- Monospace or condensed sans-serif for data readability
- Color encodes meaning, not decoration (warm = fire/heat, cool = water/snow, green = go/open, red = closed/danger)
- Mobile-first — people check conditions from their phones at the trailhead
- Fast — no heavy frameworks, minimal JS, aggressive caching of sensor data

---

## What Makes This Novel

1. **Nobody stitches these sources together.** Checking Sierra conditions currently requires visiting 6+ government websites.
2. **Boot traffic is a new data layer.** Deriving passability from Strava effort count deltas is, as far as we can tell, unprecedented.
3. **Strike windows don't exist as a concept elsewhere.** The combination of conditions + human validation + permit availability as a unified decision signal is original.
4. **It updates every visit.** This isn't a static report — the data changes daily, and during fire season, hourly.
5. **It serves a real community.** The backcountry Sierra community is underserved by existing tools and would share this widely.

---

## Positioning: The Product They Should Have Built

AllTrails has millions of users and trip reports but no real-time conditions integration. Mountain Project has detailed route beta but no snowpack or permit data. Recreation.gov has permits but no context about whether conditions are even favorable. CalTopo has incredible maps but no live sensor overlays. CDEC has the sensor network but a brutalist 1990s interface.

Each one owns a piece of the trip-planning puzzle. None of them have connected the pieces. Sierra Pulse is the connective tissue between these platforms — not competing with any of them, but synthesizing what they collectively fail to surface.

**Design implication:** Sierra Pulse is a *hub*, not a destination. It links out generously — to AllTrails for trip reports, to Recreation.gov for permit booking, to CalTopo for detailed route planning, to the USFS for official closure orders. The value is in the synthesis and the strike window signal, not in replacing any single source. Every zone and trailhead should have curated outbound links that say "now go deeper."

**Product implication:** This positions Sierra Pulse as the thing AllTrails or Mountain Project should have built but didn't. If the project gains traction, that's either a acquisition signal or a proof-of-concept for pitching the feature to those platforms directly. Build it as if you're showing them what they're missing.

**Extensibility implication:** The architecture is range-agnostic. USGS, NOAA, NIFC, AirNow, and Strava all work nationwide. The same system could serve the Cascades, the Rockies, or the Whites. Start with the Sierra because you know it and love it, but build the schema and pipelines so a second range is a configuration change, not a rewrite.

---

## Open Questions

- [ ] Domain name: sierrapulse.com? sierrapulse.org? Other?
- [ ] Strava API rate limits for segment polling at scale (50+ segments daily)
- [ ] Recreation.gov availability endpoint specifics — need to test RIDB for real-time permit slot data vs. facility metadata
- [ ] Whether to build the zone narrative reports with an LLM (Claude API generating natural-language condition summaries from structured data)

---

## Future Features (Post-MVP)

These are valuable but not part of the initial build. The MVP is the strike window: conditions + boot traffic + permits + smoke/fire + road access on a terrain map.

- **Sentinel-2 NDSI snow cover overlay** — satellite-derived snow line visualization via TiTiler + STAC API. Replaces manual EO Browser workflow. Technically ambitious; requires self-hosted tile server (~$5-7/mo).
- **GPX import** — upload a planned route and see conditions along it. Overlay GPX on the terrain map with per-waypoint snow/streamflow/elevation context.
- **Melt-out date estimates** — linear projection from current snowpack + historical melt rate + forecast temps per zone.
- **Zone narrative reports** — LLM-generated natural-language condition summaries from structured data (Claude API).
- **Community trip reports** — user-submitted conditions reports with date, trailhead, snow line elevation, crossing status.
- **Cascades expansion** — second mountain range using the same architecture. USGS, NOAA, NIFC, AirNow, Strava all work nationwide.
- **CalTopo integration** — deep link to CalTopo with zone bounding box pre-loaded for route planning.
