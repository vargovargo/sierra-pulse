import MapView from '../components/map/MapView.jsx'
import ErrorBoundary from '../components/shared/ErrorBoundary.jsx'

export default function MapPage() {
  return (
    <ErrorBoundary>
      <div style={{ height: 'calc(100vh - 48px - 48px)', borderRadius: 8, overflow: 'hidden' }}>
        <MapView />
      </div>
    </ErrorBoundary>
  )
}
