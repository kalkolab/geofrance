import { useState } from 'react'
import { db, type Visit } from '../db'
import type { RefData } from '../lib/ref'
import type { Progress, Stats } from '../lib/stats'
import { placeLabel } from './AddVisit'
import { formatDate } from './PlacePanel'

interface Props {
  geo: RefData
  stats: Stats
  visits: Visit[]
}

const pct = (p: Progress) => (p.total ? (100 * p.visited) / p.total : 0)
const fmt = (n: number) => n.toLocaleString('fr-FR')

function Headline({ label, progress }: { label: string; progress: Progress }) {
  return (
    <div className="headline">
      <div className="big">
        {fmt(progress.visited)}
        <span className="muted"> / {fmt(progress.total)}</span>
      </div>
      <div>{label}</div>
      <div className="muted">{pct(progress).toFixed(pct(progress) < 1 && progress.visited ? 2 : 0)}%</div>
    </div>
  )
}

const SOURCE_LABEL = { manual: 'Manual', timeline: 'Timeline', photo: 'Photo' }

export function StatsView({ geo, stats, visits }: Props) {
  const [showAll, setShowAll] = useState(false)
  const sorted = [...visits].sort(
    (a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.createdAt.localeCompare(a.createdAt),
  )
  const shown = showAll ? sorted : sorted.slice(0, 30)

  return (
    <div className="page">
      <section className="headlines">
        <Headline label="Communes" progress={stats.communes} />
        <Headline label="Departments" progress={stats.departements} />
        <Headline label="Regions" progress={stats.regions} />
      </section>

      <section>
        <h2>By region</h2>
        <p className="muted">Share of each region's departments you have visited.</p>
        <ul className="bars">
          {stats.byRegion.map((r) => (
            <li key={r.code}>
              <div className="bar-label">
                <span>{r.name}</span>
                <span className="muted">
                  {r.departements.visited}/{r.departements.total} departments · {fmt(r.communes.visited)}{' '}
                  {r.communes.visited === 1 ? 'commune' : 'communes'}
                </span>
              </div>
              <div className="bar">
                <div style={{ width: `${pct(r.departements)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Your visits</h2>
        {sorted.length === 0 ? (
          <p className="muted">No visits yet. Tap the map or use "Add a visit" to record one.</p>
        ) : (
          <ul className="visits">
            {shown.map((v) => {
              const c = geo.commune.get(v.commune)
              return (
                <li key={v.id}>
                  <div>
                    <strong>{c?.name ?? v.commune}</strong> <span className="muted">{c && placeLabel(geo, c)}</span>
                    <div className="muted">
                      {v.date ? formatDate(v.date) : 'Date unknown'} · {SOURCE_LABEL[v.source]}
                      {v.note ? ` · ${v.note}` : ''}
                    </div>
                  </div>
                  <button className="link" onClick={() => db.visits.delete(v.id!)} aria-label={`Delete visit to ${c?.name}`}>
                    Delete
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {sorted.length > shown.length && (
          <button className="link" onClick={() => setShowAll(true)}>
            Show all {sorted.length} visits
          </button>
        )}
      </section>
    </div>
  )
}
