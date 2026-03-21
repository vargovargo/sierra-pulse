/**
 * Pure NPS API mapping logic — no Deno or external imports.
 */

export type AlertCategory = 'closure' | 'danger' | 'caution' | 'info'

export function mapCategory(npsCategory: string): AlertCategory {
  const lower = (npsCategory ?? '').toLowerCase()
  if (lower.includes('closure') || lower.includes('closed')) return 'closure'
  if (lower.includes('danger') || lower.includes('hazard'))  return 'danger'
  if (lower.includes('caution') || lower.includes('warning')) return 'caution'
  return 'info'
}

export interface NpsAlertRow {
  source:         'nps'
  source_id:      string
  title:          string
  description:    string | null
  category:       AlertCategory
  park_or_forest: string
  published_at:   string
  expires_at:     null
}

export function parseNpsAlerts(data: unknown[], parkName: string): NpsAlertRow[] {
  if (!Array.isArray(data)) return []

  return data
    .filter(alert => (alert as any)?.id && (alert as any)?.title)
    .map(alert => {
      const a = alert as any
      return {
        source:         'nps' as const,
        source_id:      String(a.id),
        title:          String(a.title),
        description:    a.description ? String(a.description) : null,
        category:       mapCategory(a.category ?? ''),
        park_or_forest: parkName,
        published_at:   a.lastIndexedDate
          ? new Date(a.lastIndexedDate).toISOString()
          : new Date().toISOString(),
        expires_at:     null,
      }
    })
}

/** Validate NPS alert rows for required fields. */
export interface NpsWarning {
  source_id: string
  message:   string
}

export function validateNpsAlerts(rows: NpsAlertRow[]): NpsWarning[] {
  const warnings: NpsWarning[] = []
  for (const row of rows) {
    if (!row.title.trim()) {
      warnings.push({ source_id: row.source_id, message: 'Empty title' })
    }
    if (!row.park_or_forest) {
      warnings.push({ source_id: row.source_id, message: 'Missing park_or_forest' })
    }
  }
  return warnings
}
