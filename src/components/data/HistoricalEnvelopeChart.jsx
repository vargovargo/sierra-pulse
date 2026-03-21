import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'
import LoadingSpinner from '../shared/LoadingSpinner.jsx'

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
// Cumulative days at start of each month (non-leap year)
const MONTH_START_DOYS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]

const MARGIN = { top: 20, right: 24, bottom: 36, left: 56 }

/**
 * Phase 3 historical envelope chart.
 *
 * Props:
 *   normals   — [{day_of_year, p10, p25, p50, p75, p90}] (365 rows, all-year)
 *   current   — [{day_of_year, value_avg}] (current-year daily observations)
 *   label     — chart title string
 *   unit      — y-axis unit label (e.g. "inches", "cfs")
 *   color     — line/fill color for current-year data (defaults to --c-snow)
 *   loading   — show spinner
 *   doyRange  — [startDoy, endDoy] to clip the x-axis (default [1, 365])
 */
export default function HistoricalEnvelopeChart({
  normals = [],
  current = [],
  label,
  unit = '',
  color,
  loading = false,
  doyRange = [1, 365],
}) {
  const svgRef    = useRef(null)
  const wrapRef   = useRef(null)
  const [width, setWidth] = useState(600)

  // Responsive width via ResizeObserver
  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width || 600)
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  // Resolve the CSS custom property color on first render
  const resolvedColor = color
    ?? (getComputedStyle(document.documentElement).getPropertyValue('--c-snow').trim() || '#60A5FA')

  useEffect(() => {
    if (loading || normals.length === 0) return

    const [doyMin, doyMax] = doyRange
    const filteredNormals  = normals.filter(d => d.day_of_year >= doyMin && d.day_of_year <= doyMax)
    const filteredCurrent  = current.filter(d => d.day_of_year >= doyMin && d.day_of_year <= doyMax)

    const height = 220
    const innerW = width  - MARGIN.left - MARGIN.right
    const innerH = height - MARGIN.top  - MARGIN.bottom

    // Scales
    const x = d3.scaleLinear()
      .domain([doyMin, doyMax])
      .range([0, innerW])

    const allValues = [
      ...filteredNormals.flatMap(d => [d.p10, d.p90]),
      ...filteredCurrent.map(d => d.value_avg),
    ].filter(v => v != null && v >= 0)

    const y = d3.scaleLinear()
      .domain([0, d3.max(allValues) * 1.1 || 1])
      .range([innerH, 0])
      .nice()

    // Clear previous render
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    svg
      .attr('width', width)
      .attr('height', height)

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // --- Background grid ---
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3.axisLeft(y)
          .ticks(5)
          .tickSize(-innerW)
          .tickFormat('')
      )
      .call(sel => sel.select('.domain').remove())
      .call(sel => sel.selectAll('line')
        .attr('stroke', 'rgba(255,255,255,0.06)')
        .attr('stroke-dasharray', '2,4')
      )

    // --- Envelope fills ---
    // Outer band: p10–p90
    const areaOuter = d3.area()
      .x(d => x(d.day_of_year))
      .y0(d => y(d.p10 ?? 0))
      .y1(d => y(d.p90 ?? 0))
      .curve(d3.curveCatmullRom.alpha(0.5))
      .defined(d => d.p10 != null && d.p90 != null)

    g.append('path')
      .datum(filteredNormals)
      .attr('fill', resolvedColor)
      .attr('fill-opacity', 0.10)
      .attr('d', areaOuter)

    // Inner band: p25–p75
    const areaInner = d3.area()
      .x(d => x(d.day_of_year))
      .y0(d => y(d.p25 ?? 0))
      .y1(d => y(d.p75 ?? 0))
      .curve(d3.curveCatmullRom.alpha(0.5))
      .defined(d => d.p25 != null && d.p75 != null)

    g.append('path')
      .datum(filteredNormals)
      .attr('fill', resolvedColor)
      .attr('fill-opacity', 0.18)
      .attr('d', areaInner)

    // Median line: p50
    const lineMedian = d3.line()
      .x(d => x(d.day_of_year))
      .y(d => y(d.p50 ?? 0))
      .curve(d3.curveCatmullRom.alpha(0.5))
      .defined(d => d.p50 != null)

    g.append('path')
      .datum(filteredNormals)
      .attr('fill', 'none')
      .attr('stroke', resolvedColor)
      .attr('stroke-opacity', 0.45)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3')
      .attr('d', lineMedian)

    // --- Current year line ---
    if (filteredCurrent.length > 0) {
      const lineCurrent = d3.line()
        .x(d => x(d.day_of_year))
        .y(d => y(d.value_avg))
        .curve(d3.curveCatmullRom.alpha(0.5))
        .defined(d => d.value_avg != null)

      g.append('path')
        .datum(filteredCurrent)
        .attr('fill', 'none')
        .attr('stroke', resolvedColor)
        .attr('stroke-width', 2)
        .attr('d', lineCurrent)

      // Terminal dot on the most recent observation
      const last = filteredCurrent[filteredCurrent.length - 1]
      g.append('circle')
        .attr('cx', x(last.day_of_year))
        .attr('cy', y(last.value_avg))
        .attr('r', 3.5)
        .attr('fill', resolvedColor)
    }

    // --- Axes ---
    // X axis — month tick marks
    const monthTicks = MONTH_START_DOYS.filter(doy => doy >= doyMin && doy <= doyMax)
    const xAxis = d3.axisBottom(x)
      .tickValues(monthTicks)
      .tickFormat(doy => {
        const idx = MONTH_START_DOYS.indexOf(doy)
        return idx >= 0 ? MONTH_LABELS[idx] : ''
      })
      .tickSize(4)

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .call(sel => sel.select('.domain').attr('stroke', 'rgba(255,255,255,0.15)'))
      .call(sel => sel.selectAll('text')
        .attr('fill', 'var(--c-text-dim, #6B7280)')
        .attr('font-size', 11)
      )
      .call(sel => sel.selectAll('line').attr('stroke', 'rgba(255,255,255,0.15)'))

    // Y axis
    g.append('g')
      .call(
        d3.axisLeft(y)
          .ticks(5)
          .tickFormat(v => v)
      )
      .call(sel => sel.select('.domain').attr('stroke', 'rgba(255,255,255,0.15)'))
      .call(sel => sel.selectAll('text')
        .attr('fill', 'var(--c-text-dim, #6B7280)')
        .attr('font-size', 11)
      )
      .call(sel => sel.selectAll('line').attr('stroke', 'rgba(255,255,255,0.15)'))

    // Y axis unit label
    if (unit) {
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerH / 2)
        .attr('y', -44)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--c-text-dim, #6B7280)')
        .attr('font-size', 10)
        .text(unit)
    }

    // Today marker
    const todayDoy = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
    )
    if (todayDoy >= doyMin && todayDoy <= doyMax) {
      g.append('line')
        .attr('x1', x(todayDoy)).attr('x2', x(todayDoy))
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', 'rgba(255,255,255,0.2)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3')
    }

  }, [normals, current, width, loading, resolvedColor, doyRange])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      {label && (
        <div style={{
          fontSize: 11,
          color: 'var(--c-text-dim)',
          marginBottom: 8,
          fontFamily: 'var(--c-font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {label}
          <span style={{ marginLeft: 12, color: 'var(--c-text-muted)', fontStyle: 'normal' }}>
            — shaded: p10–p90 / p25–p75 · dashed: median · solid: {new Date().getFullYear()}
          </span>
        </div>
      )}
      <svg ref={svgRef} style={{ overflow: 'visible', display: 'block' }} />
    </div>
  )
}
