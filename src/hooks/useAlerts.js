import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function useAlerts({ park, source, limit = 50 } = {}) {
  const [alerts, setAlerts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    let query = supabase
      .from('alerts')
      .select('*')
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('published_at', { ascending: false })
      .limit(limit)

    if (park)   query = query.eq('park_or_forest', park)
    if (source) query = query.eq('source', source)

    query.then(({ data, error }) => {
      setAlerts(data ?? [])
      setError(error)
      setLoading(false)
    })
  }, [park, source, limit])

  return { alerts, loading, error }
}
