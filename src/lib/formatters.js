const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const intFmt    = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function fmtValue(value, unit) {
  if (value == null) return '—'
  const n = numberFmt.format(value)
  switch (unit) {
    case 'inches':      return `${n}"`
    case 'cfs':         return `${intFmt.format(value)} cfs`
    case 'feet':        return `${n} ft`
    case 'fahrenheit':  return `${n}°F`
    default:            return `${n} ${unit}`
  }
}

export function fmtElevation(ft) {
  if (ft == null) return '—'
  return `${intFmt.format(ft)} ft`
}

export function fmtRelativeTime(isoString) {
  if (!isoString) return 'never'
  const ms = Date.now() - new Date(isoString).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1)   return 'just now'
  if (min < 60)  return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)   return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export function fmtDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
