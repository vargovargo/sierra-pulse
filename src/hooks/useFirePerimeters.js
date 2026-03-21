import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Fetches active fire perimeters from Supabase.
 * Returns GeoJSON FeatureCollection ready for Mapbox addSource.
 */
export function useFirePerimeters() {
  const [geojson, setGeojson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    supabase
      .from('fire_perimeters')
      .select('fire_name, acres, containment_pct, status, geometry')
      .then(({ data, error }) => {
        if (error) {
          setError(error)
          setLoading(false)
          return
        }

        const features = (data ?? [])
          .filter(row => row.geometry)
          .map(row => ({
            type: 'Feature',
            properties: {
              fire_name:       row.fire_name,
              acres:           row.acres,
              containment_pct: row.containment_pct,
              status:          row.status,
            },
            geometry: row.geometry,
          }))

        setGeojson({ type: 'FeatureCollection', features })
        setLoading(false)
      })
  }, [])

  return { geojson, loading, error }
}

/**
 * Fetches active Caltrans road alerts for Sierra passes.
 */
export function useRoadAlerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('alerts')
      .select('id, title, description, category, park_or_forest, published_at, expires_at')
      .eq('source', 'caltrans')
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('category', { ascending: true })  // closures first
      .order('published_at', { ascending: false })
      .limit(40)
      .then(({ data }) => {
        setAlerts(data ?? [])
        setLoading(false)
      })
  }, [])

  return { alerts, loading }
}
