import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const CARD_W  = 360
const CARD_H  = 210  // approximate — used for above/below placement
const PAD     = 12   // padding around spotlight target

const TOUR_STEPS = [
  {
    route:    '/',
    selector: '[data-tour="zone-cards"]',
    title:    'Zone cards — your daily read',
    body:     'Each card is a zone in the Eastern Sierra. Color = status: green (GO), amber (CAUTION), red (BLOCKED). Click any card to jump to the full strike window breakdown.',
    hint:     'Click a card to explore the zone',
  },
  {
    route:    '/history',
    selector: '[data-tour="history-content"]',
    title:    'Live sensors + historical charts',
    body:     'Current streamflow and snowpack readings from USGS gauges and CDEC stations. Scroll down past the tables for the historical envelope — this year vs. the 30-year median.',
    hint:     'Scroll down for the envelope charts',
  },
  {
    route:    '/map',
    selector: '[data-tour="map-view"]',
    title:    'Interactive 3D terrain map',
    body:     'Click any marker to see current readings. Drag and tilt to explore 3D terrain. Fire perimeters and road closures refresh every 30 minutes.',
    hint:     'Click a marker to see live data',
  },
  {
    route:    '/strike',
    selector: '[data-tour="strike-cards"]',
    title:    'Strike windows — the go signal',
    body:     'Each zone is scored 0–100 across 4 signals: snowpack, air quality, trail traffic, and permit availability. A GO window means all four are aligned. Recomputed every 2 hours.',
    hint:     'Check this page before planning a trip',
  },
]

/** Measures a [data-tour] element twice (350ms + 750ms) to handle async renders */
function useSpotlight(selector) {
  const [rect, setRect] = useState(null)

  const measure = useCallback(() => {
    if (!selector) { setRect(null); return }
    const el = document.querySelector(selector)
    if (el) {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
  }, [selector])

  useEffect(() => {
    setRect(null)
    const t1 = setTimeout(measure, 350)
    const t2 = setTimeout(measure, 800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [measure])

  return rect
}

export default function TutorialModal({ onClose }) {
  const [welcomed, setWelcomed] = useState(false)
  const [step, setStep]         = useState(0)
  const navigate                = useNavigate()

  const current = TOUR_STEPS[step]
  const isLast  = step === TOUR_STEPS.length - 1

  // Navigate when each step becomes active
  useEffect(() => {
    if (!welcomed) return
    navigate(current.route)
  }, [welcomed, step]) // eslint-disable-line react-hooks/exhaustive-deps

  const rect = useSpotlight(welcomed ? current.selector : null)

  const handleNext = () => { isLast ? onClose() : setStep(s => s + 1) }
  const handleBack = () => setStep(s => s - 1)

  // ── Welcome screen ──────────────────────────────────────────────────────────
  if (!welcomed) {
    return (
      <Backdrop>
        <div style={cardStyle}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Sierra Pulse</div>
          <div style={{ color: 'var(--c-text-muted)', fontSize: 14, lineHeight: 1.65, marginBottom: 28 }}>
            Looks like your first visit. Would you like a quick tour of how the site works?
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={ghostBtn}>Skip</button>
            <button onClick={() => setWelcomed(true)} style={primaryBtn}>Take the tour</button>
          </div>
        </div>
      </Backdrop>
    )
  }

  // ── Compute spotlight + card positions ──────────────────────────────────────
  const spotStyle = rect ? {
    position:     'fixed',
    top:          rect.top  - PAD,
    left:         rect.left - PAD,
    width:        rect.width  + PAD * 2,
    height:       rect.height + PAD * 2,
    borderRadius: 10,
    boxShadow:    '0 0 0 9999px rgba(0,0,0,0.72)',
    border:       '2px solid rgba(255,255,255,0.18)',
    zIndex:       999,
    pointerEvents:'none',
    transition:   'top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease',
  } : null

  // Position tooltip below spotlight if space, otherwise above, fallback bottom-center
  let cardTop, cardLeft
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (rect) {
    const belowY = rect.top + rect.height + PAD + 16
    const aboveY = rect.top - PAD - CARD_H - 16
    cardTop  = belowY + CARD_H < vh - 16 ? belowY : Math.max(16, aboveY)
    cardLeft = Math.max(16, Math.min(rect.left + rect.width / 2 - CARD_W / 2, vw - CARD_W - 16))
  } else {
    cardTop  = vh - CARD_H - 40
    cardLeft = Math.max(16, (vw - CARD_W) / 2)
  }

  return (
    <>
      {/* Fallback dim when no spotlight yet */}
      {!rect && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 998,
          pointerEvents: 'none',
        }} />
      )}

      {/* Spotlight cutout */}
      {spotStyle && <div style={spotStyle} />}

      {/* Floating tour card */}
      <div style={{
        position:     'fixed',
        top:          cardTop,
        left:         cardLeft,
        width:        CARD_W,
        zIndex:       1000,
        background:   'var(--c-surface)',
        border:       '1px solid var(--c-border)',
        borderRadius: 12,
        padding:      '18px 20px 14px',
        boxShadow:    '0 8px 40px rgba(0,0,0,0.55)',
        transition:   'top 0.3s ease, left 0.3s ease',
      }}>
        {/* Step progress bar */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
          {TOUR_STEPS.map((_, i) => (
            <div key={i} style={{
              height: 3, flex: 1, borderRadius: 2,
              background: i <= step ? 'var(--c-snow)' : 'var(--c-border)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        <div style={{ fontSize: 10, fontFamily: 'var(--c-font-mono)', color: 'var(--c-text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {step + 1} / {TOUR_STEPS.length}
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: 'var(--c-text)' }}>
          {current.title}
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--c-text-muted)', marginBottom: 6 }}>
          {current.body}
        </div>

        {current.hint && (
          <div style={{ fontSize: 11, color: 'var(--c-snow)', fontFamily: 'var(--c-font-mono)', opacity: 0.85, marginBottom: 14 }}>
            ↑ {current.hint}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <button
            onClick={handleBack}
            disabled={step === 0}
            style={{ ...ghostBtn, opacity: step === 0 ? 0 : 1, pointerEvents: step === 0 ? 'none' : 'auto' }}
          >
            ← Back
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ ...ghostBtn, fontSize: 12 }}>Skip</button>
            <button onClick={handleNext} style={primaryBtn}>
              {isLast ? 'Done' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function Backdrop({ children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      {children}
    </div>
  )
}

const cardStyle = {
  background: 'var(--c-surface)',
  border: '1px solid var(--c-border)',
  borderRadius: 12,
  padding: '28px 28px 24px',
  width: '100%',
  maxWidth: 480,
  boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
}

const primaryBtn = {
  background: 'var(--c-snow)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '7px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const ghostBtn = {
  background: 'transparent',
  color: 'var(--c-text-muted)',
  border: '1px solid var(--c-border)',
  borderRadius: 6,
  padding: '7px 12px',
  fontSize: 13,
  cursor: 'pointer',
}
