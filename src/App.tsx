import { useEffect, useMemo, useState } from 'react'
import { AddVisit } from './components/AddVisit'
import { FranceMap, type Level } from './components/FranceMap'
import { PlacePanel } from './components/PlacePanel'
import { SettingsView } from './components/SettingsView'
import { StatsView } from './components/StatsView'
import { geocoder, loadRef } from './data'
import { useVisits } from './db'
import type { Location } from './lib/geocoder'
import type { RefData } from './lib/ref'
import { computeStats } from './lib/stats'

type Tab = 'map' | 'stats' | 'settings'
type Overlay = { kind: 'place'; location: Location | null } | { kind: 'add'; commune?: string } | null

export function App() {
  const [geo, setGeo] = useState<RefData>()
  const [error, setError] = useState<string>()
  const [tab, setTab] = useState<Tab>('map')
  const [level, setLevel] = useState<Level>('departements')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const visits = useVisits()

  useEffect(() => {
    loadRef().then(setGeo, (e: Error) => setError(e.message))
  }, [])

  const visited = useMemo(() => new Set(visits?.map((v) => v.commune)), [visits])
  const stats = useMemo(() => geo && computeStats(geo, visited), [geo, visited])

  if (error) return <div className="loading">Could not load map data: {error}</div>
  if (!geo || !stats || !visits) return <div className="loading">Loading GeoFrance…</div>

  async function pick(lon: number, lat: number) {
    setOverlay({ kind: 'place', location: await geocoder.locate(lon, lat) })
  }

  const selected = overlay?.kind === 'place' ? overlay.location : null

  return (
    <div className="app">
      <header>
        <h1>GeoFrance</h1>
        <p className="summary">
          {stats.communes.visited} communes · {stats.departements.visited} departments · {stats.regions.visited} regions
        </p>
        <nav>
          {(['map', 'stats', 'settings'] as const).map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t === 'map' ? 'Map' : t === 'stats' ? 'Statistics' : 'Settings'}
            </button>
          ))}
        </nav>
      </header>

      <main>
        <div className="map-view" hidden={tab !== 'map'}>
          <FranceMap geo={geo} stats={stats} visited={visited} level={level} selected={selected} onPick={pick} />
          <div className="map-controls">
            <div className="segmented" role="group" aria-label="Map level">
              <button className={level === 'departements' ? 'active' : ''} onClick={() => setLevel('departements')}>
                Departments
              </button>
              <button className={level === 'regions' ? 'active' : ''} onClick={() => setLevel('regions')}>
                Regions
              </button>
            </div>
            <button className="primary" onClick={() => setOverlay({ kind: 'add' })}>
              Add a visit
            </button>
          </div>
          <Legend level={level} />
          {overlay?.kind === 'place' && (
            <PlacePanel
              geo={geo}
              stats={stats}
              location={overlay.location}
              visits={visits}
              onAdd={() => setOverlay({ kind: 'add', commune: overlay.location?.commune ?? undefined })}
              onClose={() => setOverlay(null)}
            />
          )}
          {overlay?.kind === 'add' && (
            <AddVisit
              geo={geo}
              initial={overlay.commune ? geo.commune.get(overlay.commune) : undefined}
              onDone={() => setOverlay(null)}
            />
          )}
        </div>
        {tab === 'stats' && <StatsView geo={geo} stats={stats} visits={visits} />}
        {tab === 'settings' && <SettingsView geo={geo} visited={visited} visitCount={visits.length} />}
      </main>
    </div>
  )
}

function Legend({ level }: { level: Level }) {
  return level === 'departements' ? (
    <div className="legend">
      <span className="swatch commune" /> Visited commune
      <span className="swatch departement" /> Visited department
      <span className="swatch none" /> Not yet
    </div>
  ) : (
    <div className="legend">
      <span>Departments visited</span>
      <span className="swatch none" /> 0%
      <span className="ramp" /> 100%
    </div>
  )
}
