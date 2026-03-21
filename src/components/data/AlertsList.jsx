import { useAlerts } from '../../hooks/useAlerts.js'
import { fmtRelativeTime } from '../../lib/formatters.js'
import Badge from '../shared/Badge.jsx'
import LoadingSpinner from '../shared/LoadingSpinner.jsx'

export default function AlertsList({ source, park, limit }) {
  const { alerts, loading } = useAlerts({ source, park, limit })

  if (loading) return <LoadingSpinner />

  if (!alerts.length) {
    return (
      <p style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--c-font-mono)', fontSize: 12 }}>
        No active alerts
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {alerts.map(alert => (
        <div key={alert.id} style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderLeft: `3px solid ${categoryColor(alert.category)}`,
          borderRadius: 6,
          padding: '10px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
            <Badge category={alert.category} />
            {alert.park_or_forest && (
              <Badge category="nps" label={alert.park_or_forest} />
            )}
            <span style={{ flex: 1, fontSize: 13, color: 'var(--c-text)', fontWeight: 500 }}>
              {alert.title}
            </span>
            <span style={{ fontSize: 11, color: 'var(--c-text-dim)', fontFamily: 'var(--c-font-mono)', flexShrink: 0 }}>
              {fmtRelativeTime(alert.published_at)}
            </span>
          </div>
          {alert.description && (
            <div style={{
              marginTop: 6,
              fontSize: 12,
              color: 'var(--c-text-muted)',
              lineHeight: 1.5,
              // Strip basic HTML tags from NPS descriptions
              dangerouslySetInnerHTML: { __html: stripTags(alert.description) },
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

function categoryColor(category) {
  const map = {
    closure: 'var(--c-stop)',
    danger:  'var(--c-fire)',
    caution: 'var(--c-warn)',
    info:    'var(--c-snow)',
  }
  return map[category] ?? 'var(--c-border)'
}

function stripTags(html) {
  return html.replace(/<script[^>]*>.*?<\/script>/gi, '')
             .replace(/<style[^>]*>.*?<\/style>/gi, '')
}
