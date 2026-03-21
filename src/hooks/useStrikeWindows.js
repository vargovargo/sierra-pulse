import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function useStrikeWindows() {
  const [windows, setWindows]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    supabase
      .from('strike_windows')
      .select('*')
      .order('score', { ascending: false })
      .then(({ data, error }) => {
        setWindows(data ?? [])
        setError(error)
        setLoading(false)
      })
  }, [])

  return { windows, loading, error }
}
