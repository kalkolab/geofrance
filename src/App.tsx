import { useEffect, useMemo, useState } from 'react'
import { AddVisit } from './components/AddVisit'
import { FranceMap, type Level } from './components/FranceMap'
import { PlacePanel } from './components/PlacePanel'
import { SettingsView } from './components/SettingsView'
import { StatsView } from './components/StatsView'
import { SyncButton } from './components/SyncButton'
import { geocoder, loadRef } from './data'
import { keepFirstVisits, useVisits } from './db'
import { useT } from './i18n'
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
  const t = useT()

  useEffect(() => {
    loadRef().then(setGeo, (e: Error) => setError(e.message))
    keepFirstVisits().catch(console.error)
  }, [])

  const visited = useMemo(() => new Set(visits?.map((v) => v.commune)), [visits])
  const stats = useMemo(() => geo && computeStats(geo, visited), [geo, visited])

  if (error) return <div className="loading">{t('loadError', { error })}</div>
  if (!geo || !stats || !visits) return <div className="loading">{t('loading')}</div>

  async function pick(lon: number, lat: number) {
    setOverlay({ kind: 'place', location: await geocoder.locate(lon, lat) })
  }

  const selected = overlay?.kind === 'place' ? overlay.location : null

  return (
    <div className="app">
      <header>
        <h1>GeoFrance</h1>
        <p className="summary">
          {t('communesCount', { count: stats.communes.visited })} · {t('departementsCount', { count: stats.departements.visited })} ·{' '}
          {t('regionsCount', { count: stats.regions.visited })}
        </p>
        <SyncButton />
        <nav>
          {(['map', 'stats', 'settings'] as const).map((name) => (
            <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>
              {t(name === 'map' ? 'tabMap' : name === 'stats' ? 'tabStats' : 'tabSettings')}
            </button>
          ))}
        </nav>
      </header>

      <main>
        <div className="map-view" hidden={tab !== 'map'}>
          <FranceMap geo={geo} stats={stats} visited={visited} level={level} selected={selected} onPick={pick} />
          <div className="map-controls">
            <div className="segmented" role="group" aria-label={t('mapLevel')}>
              <button className={level === 'departements' ? 'active' : ''} onClick={() => setLevel('departements')}>
                {t('departements')}
              </button>
              <button className={level === 'regions' ? 'active' : ''} onClick={() => setLevel('regions')}>
                {t('regions')}
              </button>
            </div>
            <button className="primary" onClick={() => setOverlay({ kind: 'add' })}>
              {t('addAVisit')}
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
        {tab === 'settings' && <SettingsView geo={geo} visited={visited} visits={visits} />}
      </main>
    </div>
  )
}

function Legend({ level }: { level: Level }) {
  const t = useT()
  return level === 'departements' ? (
    <div className="legend">
      <span className="item">
        <span className="swatch commune" /> {t('legendCommune')}
      </span>
      <span className="item">
        <span className="swatch departement" /> {t('legendDepartement')}
      </span>
      <span className="item">
        <span className="swatch none" /> {t('legendNone')}
      </span>
    </div>
  ) : (
    <div className="legend">
      <span>{t('legendShare')}</span>
      <span className="item">
        <span className="swatch none" /> 0%
      </span>
      <span className="item">
        <span className="ramp" /> 100%
      </span>
    </div>
  )
}
