import { describe, it, expect } from 'vitest'
import { mapCategory, parseNpsAlerts, validateNpsAlerts } from './mapper'

// ---------------------------------------------------------------------------
// mapCategory
// ---------------------------------------------------------------------------
describe('mapCategory', () => {
  it('maps "Closure" to closure', () => {
    expect(mapCategory('Closure')).toBe('closure')
  })

  it('maps "Park Closure" to closure', () => {
    expect(mapCategory('Park Closure')).toBe('closure')
  })

  it('maps "Trail Closed" to closure', () => {
    expect(mapCategory('Trail Closed')).toBe('closure')
  })

  it('maps "Danger" to danger', () => {
    expect(mapCategory('Danger')).toBe('danger')
  })

  it('maps "Hazard" to danger', () => {
    expect(mapCategory('Hazard')).toBe('danger')
  })

  it('maps "Rockfall Hazard" to danger', () => {
    expect(mapCategory('Rockfall Hazard')).toBe('danger')
  })

  it('maps "Caution" to caution', () => {
    expect(mapCategory('Caution')).toBe('caution')
  })

  it('maps "Warning" to caution', () => {
    expect(mapCategory('Warning')).toBe('caution')
  })

  it('maps "Flood Warning" to caution', () => {
    expect(mapCategory('Flood Warning')).toBe('caution')
  })

  it('maps "Information" to info', () => {
    expect(mapCategory('Information')).toBe('info')
  })

  it('maps empty string to info', () => {
    expect(mapCategory('')).toBe('info')
  })

  it('maps undefined-like null to info', () => {
    expect(mapCategory(null as any)).toBe('info')
  })

  it('is case-insensitive', () => {
    expect(mapCategory('CLOSURE')).toBe('closure')
    expect(mapCategory('danger')).toBe('danger')
    expect(mapCategory('CAUTION')).toBe('caution')
  })

  // Closure takes priority over danger if both keywords appear
  it('maps "Closed due to Hazard" to closure (closure checked first)', () => {
    expect(mapCategory('Closed due to Hazard')).toBe('closure')
  })
})

// ---------------------------------------------------------------------------
// parseNpsAlerts — happy path
// ---------------------------------------------------------------------------
describe('parseNpsAlerts — happy path', () => {
  const SAMPLE_ALERT = {
    id: 'abc-123',
    title: 'Half Dome Cables Down',
    description: 'The cables on the Half Dome trail have been removed for winter.',
    category: 'Closure',
    lastIndexedDate: '2024-10-15T10:00:00Z',
  }

  it('parses a single alert', () => {
    const rows = parseNpsAlerts([SAMPLE_ALERT], 'Yosemite National Park')
    expect(rows).toHaveLength(1)
  })

  it('sets source to nps', () => {
    const rows = parseNpsAlerts([SAMPLE_ALERT], 'Yosemite National Park')
    expect(rows[0].source).toBe('nps')
  })

  it('maps source_id from alert id', () => {
    const rows = parseNpsAlerts([SAMPLE_ALERT], 'Yosemite National Park')
    expect(rows[0].source_id).toBe('abc-123')
  })

  it('maps category via mapCategory', () => {
    const rows = parseNpsAlerts([SAMPLE_ALERT], 'Yosemite National Park')
    expect(rows[0].category).toBe('closure')
  })

  it('sets park_or_forest from argument', () => {
    const rows = parseNpsAlerts([SAMPLE_ALERT], 'Yosemite National Park')
    expect(rows[0].park_or_forest).toBe('Yosemite National Park')
  })

  it('converts lastIndexedDate to ISO string', () => {
    const rows = parseNpsAlerts([SAMPLE_ALERT], 'Yosemite National Park')
    expect(rows[0].published_at).toBe('2024-10-15T10:00:00.000Z')
  })

  it('always sets expires_at to null', () => {
    const rows = parseNpsAlerts([SAMPLE_ALERT], 'Yosemite National Park')
    expect(rows[0].expires_at).toBeNull()
  })

  it('parses multiple alerts', () => {
    const alerts = [
      SAMPLE_ALERT,
      { ...SAMPLE_ALERT, id: 'def-456', title: 'Road Closure SR-120', category: 'Closure' },
    ]
    expect(parseNpsAlerts(alerts, 'Yosemite National Park')).toHaveLength(2)
  })

  it('uses current time as fallback when lastIndexedDate is missing', () => {
    const before = Date.now()
    const rows = parseNpsAlerts([{ ...SAMPLE_ALERT, lastIndexedDate: undefined }], 'Yosemite')
    const after = Date.now()
    const published = new Date(rows[0].published_at).getTime()
    expect(published).toBeGreaterThanOrEqual(before)
    expect(published).toBeLessThanOrEqual(after)
  })
})

// ---------------------------------------------------------------------------
// parseNpsAlerts — edge cases
// ---------------------------------------------------------------------------
describe('parseNpsAlerts — edge cases', () => {
  it('returns empty array for empty input', () => {
    expect(parseNpsAlerts([], 'Yosemite')).toHaveLength(0)
  })

  it('returns empty array for non-array input', () => {
    expect(parseNpsAlerts(null as any, 'Yosemite')).toHaveLength(0)
  })

  it('skips alerts missing id', () => {
    const rows = parseNpsAlerts([{ title: 'No ID alert', category: 'Info' }], 'Yosemite')
    expect(rows).toHaveLength(0)
  })

  it('skips alerts missing title', () => {
    const rows = parseNpsAlerts([{ id: 'xyz', category: 'Info' }], 'Yosemite')
    expect(rows).toHaveLength(0)
  })

  it('stores null description when description is absent', () => {
    const alert = { id: 'abc', title: 'Test Alert', category: 'Info' }
    const rows = parseNpsAlerts([alert], 'Yosemite')
    expect(rows[0].description).toBeNull()
  })

  it('stores description as string when present', () => {
    const alert = { id: 'abc', title: 'Test', description: '<p>Some <b>HTML</b> content</p>', category: 'Info' }
    const rows = parseNpsAlerts([alert], 'Yosemite')
    expect(rows[0].description).toBe('<p>Some <b>HTML</b> content</p>')
  })
})

// ---------------------------------------------------------------------------
// validateNpsAlerts
// ---------------------------------------------------------------------------
describe('validateNpsAlerts', () => {
  const validAlert = {
    source: 'nps' as const,
    source_id: 'abc-123',
    title: 'Bear Activity on JMT',
    description: null,
    category: 'caution' as const,
    park_or_forest: 'Yosemite National Park',
    published_at: '2024-08-01T00:00:00.000Z',
    expires_at: null,
  }

  it('returns no warnings for a valid alert', () => {
    expect(validateNpsAlerts([validAlert])).toHaveLength(0)
  })

  it('flags alerts with empty title', () => {
    const warnings = validateNpsAlerts([{ ...validAlert, title: '  ' }])
    expect(warnings).toHaveLength(1)
    expect(warnings[0].source_id).toBe('abc-123')
    expect(warnings[0].message).toMatch(/empty title/i)
  })

  it('flags alerts with missing park_or_forest', () => {
    const warnings = validateNpsAlerts([{ ...validAlert, park_or_forest: '' }])
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toMatch(/park_or_forest/i)
  })

  it('returns no warnings for empty input', () => {
    expect(validateNpsAlerts([])).toHaveLength(0)
  })
})
