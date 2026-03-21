import { useRoadAlerts } from '../../hooks/useFirePerimeters.js'
import Badge from '../shared/Badge.jsx'
import LoadingSpinner from '../shared/LoadingSpinner.jsx'

const CATEGORY_COLOR = {
  closure: 'var(--c-stop)',
  caution: 'var(--c-warn)',
  info:    'var(--c-text-muted)',
}

const CATEGORY_LABEL = {
  closure: 'CLOSED',
  caution: 'CAUTION',
  info:    'INFO',
}

export default function RoadStatusList() {
  const { alerts, loading } = useRoadAlerts()

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
        <LoadingSpinner />
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div style={{
        padding: '16px 20px',
        fontSize: 13,
        color: 'var(--c-text-muted)',
      }}>
        No active chain controls or road closures — all Sierra passes currently clear.
      </div>
    )
  }

  return (
    <div>
      {alerts.map(alert => (
        <div key={alert.id} style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '12px 20px',
          borderBottom: '1px solid var(--c-border)',
        }}>
          <div style={{
            marginTop: 2,
            flexShrink: 0,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: CATEGORY_COLOR[alert.category] ?? 'var(--c-text-dim)',
          }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--c-text)', lineHeight: 1.4 }}>
              {alert.title}
            </div>
            {alert.description && alert.description !== alert.title && (
              <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 2 }}>
                {alert.description}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--c-text-dim)', marginTop: 4 }}>
              {alert.park_or_forest}
            </div>
          </div>
          <Badge
            label={CATEGORY_LABEL[alert.category] ?? alert.category.toUpperCase()}
            category={alert.category}
          />
        </div>
      ))}
    </div>
  )
}
