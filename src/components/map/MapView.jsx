import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useStations } from '../../hooks/useStations.js'
import { useLatestObservations } from '../../hooks/useObservations.js'
import { useSegmentWeeklyEfforts } from '../../hooks/useSegmentWeeklyEfforts.js'
import { useAlerts } from '../../hooks/useAlerts.js'
import { useFirePerimeters } from '../../hooks/useFirePerimeters.js'
import { useStrikeWindows } from '../../hooks/useStrikeWindows.js'
import { buildZoneGeojson, TRAILHEADS } from '../../lib/zones.js'
import { fmtValue, fmtRelativeTime } from '../../lib/formatters.js'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const SIERRA_CENTER = [-119.2, 37.5]
const SIERRA_ZOOM   = 7

// Color and label by station type
function markerStyle(type) {
  switch (type) {
    case 'snow':         return { bg: '#7AB8CC', label: '❄' }
    case 'streamflow':   return { bg: '#5B9BD5', label: '〜' }
    case 'weather':      return { bg: '#E8B84A', label: '◉' }
    case 'trail_segment':return { bg: '#4CAF82', label: '▲' }
    default:             return { bg: '#8899AA', label: '•' }
  }
}

// Pick the most informative parameter to show in the marker tooltip
const PRIMARY_PARAM = {
  snow:         'swe',
  streamflow:   'discharge',
  weather:      'aqi',
  trail_segment:'effort_count',
}

const SECONDARY_PARAM = {
  snow:       'snow_depth',
  streamflow: 'gage_height',
}

const PARAM_COLOR = {
  snow:       '#7AB8CC',
  streamflow: '#5B9BD5',
  weather:    '#E8B84A',
}

function buildPopupHtml(station, obs, weeklyEfforts) {
  const param    = PRIMARY_PARAM[station.type]
  const param2   = SECONDARY_PARAM[station.type]
  const stObs    = obs?.[station.id] ?? {}
  const data     = stObs[param]
  const data2    = param2 ? stObs[param2] : null
  const color    = PARAM_COLOR[station.type] ?? '#7AB8CC'

  let valueStr
  if (station.type === 'trail_segment') {
    const weekly = weeklyEfforts?.[station.id]
    const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    const effortLine = weekly?.weekly_efforts != null
      ? `<div style="font-size:18px;font-weight:700;color:#4CAF82;margin:4px 0">${weekly.weekly_efforts.toLocaleString()} efforts</div>
         <div style="font-size:11px;color:#8899AA">this week</div>`
      : `<div style="font-size:12px;color:#8899AA;margin:4px 0">No weekly data yet</div>`

    const openerLine = weekly?.season_opener
      ? `<div style="font-size:11px;color:#4CAF82;margin-top:6px">Opened ${fmt(weekly.season_opener)}</div>`
      : ''

    const closerLine = weekly?.season_closer
      ? `<div style="font-size:11px;color:#E8B84A;margin-top:4px">Closed ~${fmt(weekly.season_closer)}</div>`
      : ''

    valueStr = effortLine + openerLine + closerLine
  } else if (data) {
    const secondaryLine = data2
      ? `<div style="font-size:11px;color:#8899AA;margin-top:2px">${param2.replace('_', ' ').toUpperCase()} ${fmtValue(data2.value, data2.unit)}</div>`
      : ''
    valueStr = `
      <div style="font-size:18px;font-weight:700;color:${color};margin:4px 0">${fmtValue(data.value, data.unit)}</div>
      <div style="font-size:11px;color:#8899AA">${param.toUpperCase()} · ${fmtRelativeTime(data.observed_at)}</div>
      ${secondaryLine}
    `
  } else {
    valueStr = `<div style="font-size:12px;color:#8899AA;margin:4px 0">No data</div>`
  }

  return `
    <div style="font-family:Inter,sans-serif;min-width:160px">
      <div style="font-weight:600;font-size:13px;color:#E8EFF8;margin-bottom:2px">${station.name}</div>
      <div style="font-size:11px;color:#8899AA;margin-bottom:6px">${station.source.toUpperCase()} · ${station.elevation_ft ? station.elevation_ft.toLocaleString() + ' ft' : '—'}</div>
      ${valueStr}
    </div>
  `
}

export default function MapView() {
  const mapContainer = useRef(null)
  const mapRef       = useRef(null)
  const mapLoaded    = useRef(false)
  const markersRef   = useRef([])
  const thMarkersRef = useRef([])

  const { stations }          = useStations()
  const stationIds            = stations.map(s => s.id)
  const trailIds              = stations.filter(s => s.type === 'trail_segment').map(s => s.id)
  const allParams             = ['swe', 'discharge', 'gage_height', 'aqi', 'effort_count']
  const { latest: obsLatest } = useLatestObservations(stationIds, allParams)
  const { efforts: weeklyEfforts } = useSegmentWeeklyEfforts(trailIds)

  const { alerts } = useAlerts({ limit: 20 })
  const { geojson: fireGeojson } = useFirePerimeters()
  const { windows } = useStrikeWindows()

  // Initialize map once
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style:     'mapbox://styles/mapbox/outdoors-v12',
      center:    SIERRA_CENTER,
      zoom:      SIERRA_ZOOM,
      minZoom:   5,
      maxZoom:   15,
    })

    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    mapRef.current.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-left')

    // Terrain 3D + mark map as loaded
    mapRef.current.on('load', () => {
      mapRef.current.addSource('mapbox-dem', {
        type: 'raster-dem',
        url:  'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      })
      mapRef.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })
      mapLoaded.current = true
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Add/update station markers when stations or observations change
  useEffect(() => {
    if (!mapRef.current || !stations.length) return

    // Remove old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    for (const station of stations) {
      if (!station.lat || !station.lon) continue

      const { bg, label } = markerStyle(station.type)

      // Outer el is unmodified so Mapbox can manage its positioning.
      // Scale transform goes on the inner div only.
      const el = document.createElement('div')
      el.style.cssText = 'width:28px;height:28px;cursor:pointer;'

      const inner = document.createElement('div')
      inner.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%;
        background: ${bg}; color: #0F1621;
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; font-weight: 700;
        border: 2px solid rgba(255,255,255,0.25);
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        transition: transform 0.15s;
      `
      inner.title = station.name
      inner.textContent = label
      el.appendChild(inner)
      el.addEventListener('mouseenter', () => { inner.style.transform = 'scale(1.2)' })
      el.addEventListener('mouseleave', () => { inner.style.transform = 'scale(1)' })

      const popup = new mapboxgl.Popup({
        offset: 16,
        closeButton: false,
        className: 'sierra-popup',
      }).setHTML(buildPopupHtml(station, obsLatest, weeklyEfforts))

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([station.lon, station.lat])
        .setPopup(popup)
        .addTo(mapRef.current)

      markersRef.current.push(marker)
    }
  }, [stations, obsLatest, weeklyEfforts])

  // Add/update fire perimeter polygons
  useEffect(() => {
    if (!fireGeojson) return

    function addFireLayer() {
      const map = mapRef.current
      if (!map || !mapLoaded.current) return

      if (map.getSource('fire-perimeters')) {
        // Update existing source data
        map.getSource('fire-perimeters').setData(fireGeojson)
        return
      }

      map.addSource('fire-perimeters', { type: 'geojson', data: fireGeojson })

      // Fill — semi-transparent orange
      map.addLayer({
        id:     'fire-fill',
        type:   'fill',
        source: 'fire-perimeters',
        paint:  {
          'fill-color':   '#E8702A',
          'fill-opacity': 0.18,
        },
      })

      // Outline
      map.addLayer({
        id:     'fire-outline',
        type:   'line',
        source: 'fire-perimeters',
        paint:  {
          'line-color': '#E8702A',
          'line-width': 1.5,
          'line-opacity': 0.7,
        },
      })

      // Popup on click
      map.on('click', 'fire-fill', (e) => {
        const props = e.features[0]?.properties ?? {}
        const acres = props.acres ? `${Math.round(props.acres).toLocaleString()} acres` : '—'
        const pct   = props.containment_pct != null ? `${props.containment_pct}% contained` : 'containment unknown'
        new mapboxgl.Popup({ closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:Inter,sans-serif;min-width:160px">
              <div style="font-weight:700;font-size:13px;color:#E8702A;margin-bottom:4px">${props.fire_name ?? 'Fire'}</div>
              <div style="font-size:12px;color:#E8EFF8">${acres}</div>
              <div style="font-size:11px;color:#8899AA;margin-top:2px">${pct}</div>
            </div>
          `)
          .addTo(map)
      })
      map.on('mouseenter', 'fire-fill', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'fire-fill', () => { map.getCanvas().style.cursor = '' })
    }

    // Map may not be loaded yet when geojson arrives — retry on load event
    if (mapLoaded.current) {
      addFireLayer()
    } else if (mapRef.current) {
      mapRef.current.once('load', addFireLayer)
    }
  }, [fireGeojson])

  // Add/update zone boundary polygons, colored by strike window status
  useEffect(() => {
    const geojson = buildZoneGeojson(windows)

    function addZoneLayers() {
      const map = mapRef.current
      if (!map || !mapLoaded.current) return

      const STATUS_FILL = {
        go:      'rgba(74,197,132,0.12)',
        caution: 'rgba(251,191,36,0.12)',
        blocked: 'rgba(239,68,68,0.12)',
        unknown: 'rgba(136,153,170,0.06)',
      }
      const STATUS_LINE = {
        go:      '#4AC584',
        caution: '#FBbf24',
        blocked: '#EF4444',
        unknown: '#8899AA',
      }

      if (map.getSource('zones')) {
        map.getSource('zones').setData(geojson)
        return
      }

      map.addSource('zones', { type: 'geojson', data: geojson })

      map.addLayer({
        id:     'zone-fill',
        type:   'fill',
        source: 'zones',
        paint:  {
          'fill-color': [
            'match', ['get', 'status'],
            'go',      STATUS_FILL.go,
            'caution', STATUS_FILL.caution,
            'blocked', STATUS_FILL.blocked,
            STATUS_FILL.unknown,
          ],
          'fill-opacity': 1,
        },
      })

      map.addLayer({
        id:     'zone-outline',
        type:   'line',
        source: 'zones',
        paint:  {
          'line-color': [
            'match', ['get', 'status'],
            'go',      STATUS_LINE.go,
            'caution', STATUS_LINE.caution,
            'blocked', STATUS_LINE.blocked,
            STATUS_LINE.unknown,
          ],
          'line-width':   1.5,
          'line-opacity': 0.6,
          'line-dasharray': [4, 3],
        },
      })

      map.addLayer({
        id:          'zone-labels',
        type:        'symbol',
        source:      'zones',
        layout: {
          'text-field':           ['concat', ['get', 'name'], '\n', ['get', 'score']],
          'text-size':            10,
          'text-font':            ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-justify':         'center',
          'text-anchor':          'center',
          'text-allow-overlap':   false,
        },
        paint: {
          'text-color':        '#E8EFF8',
          'text-halo-color':   '#0F1621',
          'text-halo-width':   1.5,
          'text-opacity':      0.85,
        },
        minzoom: 8,
      })

      map.on('click', 'zone-fill', (e) => {
        const props = e.features[0]?.properties ?? {}
        const scoreStr = props.score != null ? `Score ${props.score}` : 'No data'
        const statusColor = {
          go: '#4AC584', caution: '#FBbf24', blocked: '#EF4444',
        }[props.status] ?? '#8899AA'
        new mapboxgl.Popup({ closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:Inter,sans-serif;min-width:160px">
              <div style="font-weight:600;font-size:13px;color:#E8EFF8;margin-bottom:4px">${props.name}</div>
              <div style="font-size:12px;color:${statusColor};font-family:monospace;text-transform:uppercase">${props.status ?? '—'} · ${scoreStr}</div>
            </div>
          `)
          .addTo(map)
      })
      map.on('mouseenter', 'zone-fill', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'zone-fill', () => { map.getCanvas().style.cursor = '' })
    }

    if (mapLoaded.current) {
      addZoneLayers()
    } else if (mapRef.current) {
      mapRef.current.once('load', addZoneLayers)
    }
  }, [windows])

  // Add trailhead permit entry point markers (separate ref — not cleared by station effect)
  useEffect(() => {
    if (!mapRef.current) return

    thMarkersRef.current.forEach(m => m.remove())
    thMarkersRef.current = []

    const statusMap = {}
    for (const w of windows) statusMap[w.zone] = w.window_status

    for (const th of TRAILHEADS) {
      const status = statusMap[th.zone] ?? 'unknown'
      const color  = { go: '#4AC584', caution: '#FBbf24', blocked: '#EF4444' }[status] ?? '#8899AA'

      const el = document.createElement('div')
      el.style.cssText = 'width:22px;height:22px;cursor:pointer;'

      const inner = document.createElement('div')
      inner.style.cssText = `
        width: 22px; height: 22px; border-radius: 4px;
        background: #0F1621; border: 2px solid ${color};
        color: ${color}; font-size: 9px; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        letter-spacing: 0.02em; font-family: monospace;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
      `
      inner.textContent = 'TH'
      inner.title = th.name
      el.appendChild(inner)

      const popup = new mapboxgl.Popup({ offset: 14, closeButton: false })
        .setHTML(`
          <div style="font-family:Inter,sans-serif;min-width:140px">
            <div style="font-weight:600;font-size:12px;color:#E8EFF8;margin-bottom:2px">${th.name}</div>
            <div style="font-size:11px;color:#8899AA">${th.zone}</div>
            <div style="font-size:11px;color:#8899AA;margin-top:4px">Permit required · Inyo NF</div>
          </div>
        `)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([th.lon, th.lat])
        .setPopup(popup)
        .addTo(mapRef.current)

      thMarkersRef.current.push(marker)
    }
  }, [windows])

  // Add alert markers
  useEffect(() => {
    if (!mapRef.current || !alerts.length) return

    for (const alert of alerts) {
      if (!alert.lat || !alert.lon) continue

      const el = document.createElement('div')
      el.style.cssText = 'width:22px;height:22px;cursor:pointer;'

      const color = alert.category === 'closure' ? '#E85050'
                  : alert.category === 'danger'  ? '#E85050'
                  : alert.category === 'caution' ? '#E8B84A'
                  : '#7AB8CC'

      const inner = document.createElement('div')
      inner.style.cssText = `
        width: 22px; height: 22px; border-radius: 4px;
        background: ${color}; color: #0F1621;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 900;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      `
      inner.textContent = '!'
      el.appendChild(inner)

      const popup = new mapboxgl.Popup({ offset: 14, closeButton: false })
        .setHTML(`
          <div style="font-family:Inter,sans-serif;max-width:220px">
            <div style="font-weight:600;font-size:12px;color:#E8EFF8;margin-bottom:4px">${alert.title}</div>
            <div style="font-size:11px;color:#8899AA">${alert.park_or_forest ?? ''}</div>
          </div>
        `)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([alert.lon, alert.lat])
        .setPopup(popup)
        .addTo(mapRef.current)

      markersRef.current.push(marker)
    }
  }, [alerts])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 40, right: 12,
        background: 'rgba(15,22,33,0.88)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, padding: '10px 14px', fontSize: 11,
        color: 'var(--c-text-muted)', lineHeight: 1.8,
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--c-text)' }}>Stations</div>
        {[
          { color: '#4AC584', label: '▭  Zone (GO)' },
          { color: '#FBbf24', label: '▭  Zone (CAUTION)' },
          { color: '#7AB8CC', label: '❄  Snow / SWE' },
          { color: '#5B9BD5', label: '〜  Streamflow' },
          { color: '#E8B84A', label: '◉  Air Quality' },
          { color: '#8899AA', label: 'TH Trailhead / permit' },
          { color: '#E85050', label: '!   Alert' },
          { color: '#E8702A', label: '▪  Fire perimeter' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
