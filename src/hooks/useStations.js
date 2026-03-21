import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function useStations({ type, source } = {}) {
  const [stations, setStations] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    let query = supabase.from('stations').select('*').order('name')
    if (type)   query = query.eq('type', type)
    if (source) query = query.eq('source', source)

    query.then(({ data, error }) => {
      setStations(data ?? [])
      setError(error)
      setLoading(false)
    })
  }, [type, source])

  return { stations, loading, error }
}
