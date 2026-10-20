import { useState } from 'react'
import { deleteVisits, type Visit } from '../db'
import type { RefData } from '../lib/ref'
import type { Progress, Stats } from '../lib/stats'
import { placeLabel } from './AddVisit'
import { formatDate, formatNumber as fmt, useT, type MessageKey } from '../i18n'

interface Props {
  geo: RefData
  stats: Stats
  visits: Visit[]
}

const pct = (p: Progress) => (p.total ? (100 * p.visited) / p.total : 0)

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

const SOURCE_LABEL: Record<Visit['source'], MessageKey> = {
  manual: 'sourceManual',
  csv: 'sourceCsv',
  timeline: 'sourceTimeline',
  photo: 'sourcePhoto',
}

export function StatsView({ geo, stats, visits }: Props) {
  const [showAll, setShowAll] = useState(false)
  const t = useT()
  const sorted = [...visits].sort(
    (a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.createdAt.localeCompare(a.createdAt),
  )
  const shown = showAll ? sorted : sorted.slice(0, 30)

  return (
    <div className="page">
      <section className="headlines">
        <Headline label={t('communes')} progress={stats.communes} />
        <Headline label={t('departements')} progress={stats.departements} />
        <Headline label={t('regions')} progress={stats.regions} />
      </section>

      <section>
        <h2>{t('byRegion')}</h2>
        <p className="muted">{t('byRegionHelp')}</p>
        <ul className="bars">
          {stats.byRegion.map((r) => (
            <li key={r.code}>
              <div className="bar-label">
                <span>{r.name}</span>
                <span className="muted">
                  {t('regionDeps', { visited: r.departements.visited, total: r.departements.total })} ·{' '}
                  {t('communesCount', { count: r.communes.visited })}
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
        <h2>{t('yourVisits')}</h2>
        {sorted.length === 0 ? (
          <p className="muted">{t('noVisits')}</p>
        ) : (
          <ul className="visits">
            {shown.map((v) => {
              const c = geo.commune.get(v.commune)
              return (
                <li key={v.id}>
                  <div>
                    <strong>{c?.name ?? v.commune}</strong> <span className="muted">{c && placeLabel(geo, c)}</span>
                    <div className="muted">
                      {v.date ? formatDate(v.date) : t('dateUnknown')} · {t(SOURCE_LABEL[v.source])}
                      {v.note ? ` · ${v.note}` : ''}
                    </div>
                  </div>
                  <button className="link" onClick={() => deleteVisits([v])} aria-label={t('deleteVisitTo', { name: c?.name ?? v.commune })}>
                    {t('delete')}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {sorted.length > shown.length && (
          <button className="link" onClick={() => setShowAll(true)}>
            {t('showAll', { count: sorted.length })}
          </button>
        )}
      </section>
    </div>
  )
}
