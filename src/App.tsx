import { useEffect, useMemo, useRef, useState } from 'react'
import { AddVisit } from './components/AddVisit'
import { FranceMap, type Level } from './components/FranceMap'
import { goalTitle } from './components/goalTitle'
import { GoalsView } from './components/GoalsView'
import { PlacePanel } from './components/PlacePanel'
import { SettingsView } from './components/SettingsView'
import { ShareMap } from './components/ShareMap'
import { StatsView } from './components/StatsView'
import { SyncButton } from './components/SyncButton'
import { geocoder, loadRef } from './data'
import { keepFirstVisits, useVisits } from './db'
import { useT } from './i18n'
import type { Location } from './lib/geocoder'
import { goalProgress, goalsFor, type GoalProgress } from './lib/goals'
import type { RefData } from './lib/ref'
import { computeStats } from './lib/stats'

type Tab = 'map' | 'stats' | 'goals' | 'settings'
type Overlay = { kind: 'place'; location: Location | null } | { kind: 'add'; commune?: string } | { kind: 'share' } | null

export function App() {
  const [geo, setGeo] = useState<RefData>()
  const [error, setError] = useState<string>()
  const [tab, setTab] = useState<Tab>('map')
  const [level, setLevel] = useState<Level>('departements')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [shown, setShown] = useState<string>() // goal whose missing places are marked on the map
  const [toast, setToast] = useState<string>()
  const visits = useVisits()
  const t = useT()

  useEffect(() => {
    loadRef().then(setGeo, (e: Error) => setError(e.message))
    keepFirstVisits().catch(console.error)
  }, [])

  const visited = useMemo(() => new Set(visits?.map((v) => v.commune)), [visits])
  const stats = useMemo(() => geo && computeStats(geo, visited), [geo, visited])
  const goalDefs = useMemo(() => geo && goalsFor(geo), [geo])
  const goals = useMemo(() => (geo && goalDefs && visits ? goalProgress(geo, goalDefs, visits) : []), [geo, goalDefs, visits])
  const shownGoal = goals.find((g) => g.id === shown && !g.reached)

  // Says so when a visit completes a goal (not for goals already reached when the app opens).
  const reachedBefore = useRef<Set<string>>(undefined)
  useEffect(() => {
    if (!goals.length) return
    const reached = new Set(goals.filter((g) => g.reached).map((g) => g.id))
    const fresh = reachedBefore.current && goals.filter((g) => reached.has(g.id) && !reachedBefore.current!.has(g.id))
    reachedBefore.current = reached
    if (!fresh?.length) return
    setToast(fresh.map((g) => t('goalReachedToast', { goal: goalTitle(g.title) })).join(' '))
  }, [goals, t])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(undefined), 6000)
    return () => clearTimeout(timer)
  }, [toast])

  if (error) return <div className="loading">{t('loadError', { error })}</div>
  if (!geo || !stats || !visits) return <div className="loading">{t('loading')}</div>

  async function pick(lon: number, lat: number) {
    setOverlay({ kind: 'place', location: await geocoder.locate(lon, lat) })
  }

  const selected = overlay?.kind === 'place' ? overlay.location : null

  function showGoal(goal: GoalProgress) {
    setShown(goal.id)
    setTab('map')
  }

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
          {(['map', 'stats', 'goals', 'settings'] as const).map((name) => (
            <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>
              {t(TAB_LABEL[name])}
            </button>
          ))}
        </nav>
      </header>

      <main>
        <div className="map-view" hidden={tab !== 'map'}>
          <FranceMap
            geo={geo}
            stats={stats}
            visited={visited}
            level={level}
            selected={selected}
            highlight={shownGoal?.missing ?? null}
            onPick={pick}
          />
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
            <button onClick={() => setOverlay({ kind: 'share' })}>{t('shareMap')}</button>
            {shownGoal && (
              <div className="goal-banner">
                <span>
                  <strong>{goalTitle(shownGoal.title)}</strong> · {t('goalStillToVisit', { count: shownGoal.missing.length })}
                </span>
                <button className="link" onClick={() => setShown(undefined)}>
                  {t('clear')}
                </button>
              </div>
            )}
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
          {overlay?.kind === 'share' && (
            <ShareMap
              stats={stats}
              visited={visited}
              level={level}
              goals={{ reached: goals.filter((g) => g.reached).length, total: goals.length }}
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
        {tab === 'goals' && <GoalsView geo={geo} goals={goals} onShow={showGoal} />}
        {tab === 'settings' && <SettingsView geo={geo} visited={visited} visits={visits} />}
      </main>
      {toast && (
        <div className="toast" role="status" onClick={() => setToast(undefined)}>
          {toast}
        </div>
      )}
    </div>
  )
}

const TAB_LABEL = { map: 'tabMap', stats: 'tabStats', goals: 'tabGoals', settings: 'tabSettings' } as const

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
