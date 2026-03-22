import { useState } from 'react'

const STEPS = [
  {
    title: 'Welcome to Sierra Pulse',
    body: `Sierra Pulse is a decision-support tool for backcountry travelers in the Eastern Sierra.

It synthesizes snowpack, streamflow, weather, air quality, fire, road access, trail traffic, and permit availability into a single live picture — updated throughout the day.

The goal: know when conditions are actually good before you drive four hours to find out they aren't.`,
    nav: 'Dashboard →',
  },
  {
    title: 'Dashboard — live conditions',
    body: `The Dashboard shows the current state of the range. Every card is a live sensor reading pulled from CDEC, USGS, NPS, AirNow, Caltrans, and NIFC.

Color tells you the story at a glance:
  • Blue — snow and water data
  • Green — open / passable / good AQI
  • Amber — caution
  • Red — closed or dangerous
  • Orange — fire activity

Active NPS park alerts appear at the top when they're posted.`,
    nav: 'Water & Snow →',
  },
  {
    title: 'Water & Snow — historical context',
    body: `Raw sensor numbers are hard to interpret without context. This page puts the current year in perspective.

Each chart shows the historical envelope — the range of values across past years — alongside where things stand today. You can see whether this year's snowpack is deep or thin, and whether rivers are running high or low for the season.`,
    nav: 'Map →',
  },
  {
    title: 'Map — everything geographically',
    body: `The Map layers all data sources on top of 3D Mapbox terrain.

  • Snow and streamflow station markers — click for current readings
  • AQI monitors — color-coded by air quality index
  • Fire perimeters — updated every 30 minutes during fire season
  • Road / pass status — chain controls and closures
  • Trail segment markers — recent boot traffic from Strava

Use the map to understand which zones are in smoke, which passes are open, and where the snow line currently sits.`,
    nav: 'Strike Windows →',
  },
  {
    title: 'Strike Windows — when everything aligns',
    body: `A strike window is the moment conditions converge: breathable air, accessible snowpack, low trail traffic, and available permits.

Sierra Pulse scores each zone on four signals and flags the windows where all four are green. Think of it as a go / caution / no-go rating for each trailhead area — recalculated every two hours.

Check this page before finalizing your trip dates.`,
    nav: 'Got it',
  },
]

export default function TutorialModal({ onClose }) {
  const [step, setStep] = useState(0)
  const [welcomed, setWelcomed] = useState(false)

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  // First-visit welcome screen
  if (!welcomed) {
    return (
      <Backdrop>
        <Card>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Sierra Pulse</div>
          <div style={{ color: 'var(--c-text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
            Looks like your first visit. Would you like a quick tour of how the site works?
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={ghostBtn}>Skip</button>
            <button onClick={() => setWelcomed(true)} style={primaryBtn}>Take the tour</button>
          </div>
        </Card>
      </Backdrop>
    )
  }

  return (
    <Backdrop>
      <Card>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                height: 3,
                flex: 1,
                borderRadius: 2,
                background: i <= step ? 'var(--c-snow)' : 'var(--c-border)',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        <div style={{ fontSize: 11, fontFamily: 'var(--c-font-mono)', color: 'var(--c-text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {step + 1} / {STEPS.length}
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14, color: 'var(--c-text)' }}>
          {current.title}
        </div>

        <div style={{
          fontSize: 13,
          lineHeight: 1.75,
          color: 'var(--c-text-muted)',
          whiteSpace: 'pre-wrap',
          marginBottom: 28,
          minHeight: 120,
        }}>
          {current.body}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            style={{ ...ghostBtn, opacity: step === 0 ? 0 : 1, pointerEvents: step === 0 ? 'none' : 'auto' }}
          >
            ← Back
          </button>
          <button
            onClick={isLast ? onClose : () => setStep(s => s + 1)}
            style={primaryBtn}
          >
            {current.nav}
          </button>
        </div>
      </Card>
    </Backdrop>
  )
}

function Backdrop({ children }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 16,
    }}>
      {children}
    </div>
  )
}

function Card({ children }) {
  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 12,
      padding: '28px 28px 24px',
      width: '100%',
      maxWidth: 480,
      boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    }}>
      {children}
    </div>
  )
}

const primaryBtn = {
  background: 'var(--c-snow)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const ghostBtn = {
  background: 'transparent',
  color: 'var(--c-text-muted)',
  border: '1px solid var(--c-border)',
  borderRadius: 6,
  padding: '8px 14px',
  fontSize: 13,
  cursor: 'pointer',
}
