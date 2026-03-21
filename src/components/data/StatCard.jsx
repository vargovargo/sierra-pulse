import LoadingSpinner from '../shared/LoadingSpinner.jsx'

export default function StatCard({ label, value, sub, loading, accent }) {
  return (
    <div style={{
      background: 'var(--c-surface)',
      border: `1px solid ${accent ? accent : 'var(--c-border)'}`,
      borderRadius: 8,
      padding: '16px 20px',
      minWidth: 140,
    }}>
      <div style={{
        fontSize: 11,
        fontFamily: 'var(--c-font-mono)',
        color: 'var(--c-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 28,
        fontFamily: 'var(--c-font-mono)',
        fontWeight: 600,
        color: accent ?? 'var(--c-text)',
        lineHeight: 1.1,
        minHeight: 34,
        display: 'flex',
        alignItems: 'center',
      }}>
        {loading ? <LoadingSpinner size={22} /> : (value ?? '—')}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--c-text-dim)', marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
