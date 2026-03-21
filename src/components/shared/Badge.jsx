const CATEGORY_STYLES = {
  closure: { bg: 'var(--c-stop)',  text: '#fff' },
  danger:  { bg: 'var(--c-fire)',  text: '#fff' },
  caution: { bg: 'var(--c-warn)',  text: '#000' },
  info:    { bg: 'var(--c-snow)',  text: '#000' },
  snow:    { bg: 'var(--c-snow)',  text: '#000' },
  streamflow: { bg: '#3A6090',     text: '#fff' },
  weather: { bg: '#5A4A80',        text: '#fff' },
  nps:     { bg: '#2A5030',        text: '#fff' },
  usfs:    { bg: '#3A5020',        text: '#fff' },
  cdec:    { bg: '#1A3A5A',        text: '#fff' },
  usgs:    { bg: '#0A2A4A',        text: '#fff' },
}

export default function Badge({ label, category }) {
  const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.info
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 600,
      fontFamily: 'var(--c-font-mono)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      background: style.bg,
      color: style.text,
      whiteSpace: 'nowrap',
    }}>
      {label ?? category}
    </span>
  )
}
