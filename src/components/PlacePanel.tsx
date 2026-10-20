import { deleteVisits, type Visit } from '../db'
import { formatDate, t as translate, useT } from '../i18n'
import type { Location } from '../lib/geocoder'
import type { RefData } from '../lib/ref'
import type { Stats } from '../lib/stats'

interface Props {
  geo: RefData
  stats: Stats
  location: Location | null
  visits: Visit[]
  onAdd(): void
  onClose(): void
}

// Shown after tapping the map: what is there and whether you have been.
export function PlacePanel({ geo, stats, location, visits, onAdd, onClose }: Props) {
  const t = useT()
  if (!location) {
    return (
      <div className="panel">
        <p>{t('outsideFrance')}</p>
        <div className="actions">
          <button onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    )
  }
  const dep = geo.departement.get(location.departement)!
  const region = geo.region.get(dep.region)!
  const commune = location.commune ? geo.commune.get(location.commune) : undefined
  const here = commune ? visits.filter((v) => v.commune === commune.code) : []
  const inDep = stats.communesByDepartement.get(dep.code) ?? 0
  const first = here[0]

  return (
    <div className="panel">
      <h2>{commune?.name ?? dep.name}</h2>
      <p className="muted">
        {commune ? `${dep.name} (${dep.code}) · ` : `${t('departementCode', { code: dep.code })} · `}
        {region.name}
      </p>
      {commune && (
        <p>
          {!first ? t('notVisited') : first.date ? t('firstVisitedOn', { date: formatDate(first.date) }) : t('visitedNoDate')}
        </p>
      )}
      <p className="muted">
        {t('communesInDep', { visited: inDep, count: geo.communes.filter((c) => c.departement === dep.code).length, dep: dep.name })}
      </p>
      <div className="actions">
        <button onClick={onClose}>{t('close')}</button>
        {commune && here.length > 0 && (
          <button className="danger" onClick={() => remove(commune.name, here)}>
            {t('remove')}
          </button>
        )}
        {commune && !first && (
          <button className="primary" onClick={onAdd}>
            {t('markVisited')}
          </button>
        )}
      </div>
    </div>
  )
}

function remove(name: string, visits: Visit[]) {
  if (confirm(translate('confirmRemove', { name }))) deleteVisits(visits)
}
