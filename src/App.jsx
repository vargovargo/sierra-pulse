import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppShell from './components/layout/AppShell.jsx'
import PulseStatusPage from './pages/PulseStatusPage.jsx'
import MapPage from './pages/MapPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import StrikePage from './pages/StrikePage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/"        element={<PulseStatusPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/map"     element={<MapPage />} />
          <Route path="/strike"  element={<StrikePage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
