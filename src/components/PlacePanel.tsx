import { deleteVisits, type Visit } from '../db'
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
  if (!location) {
    return (
      <div className="panel">
        <p>This point is outside mainland France.</p>
        <div className="actions">
          <button onClick={onClose}>Close</button>
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
        {commune ? `${dep.name} (${dep.code}) · ` : `Department ${dep.code} · `}
        {region.name}
      </p>
      {commune && (
        <p>
          {!first ? 'Not visited yet.' : first.date ? `First visited on ${formatDate(first.date)}.` : 'Visited, date unknown.'}
        </p>
      )}
      <p className="muted">
        {inDep} of {geo.communes.filter((c) => c.departement === dep.code).length} communes visited in {dep.name}.
      </p>
      <div className="actions">
        <button onClick={onClose}>Close</button>
        {commune && here.length > 0 && (
          <button className="danger" onClick={() => remove(commune.name, here)}>
            Remove
          </button>
        )}
        {commune && !first && (
          <button className="primary" onClick={onAdd}>
            Mark as visited
          </button>
        )}
      </div>
    </div>
  )
}

function remove(name: string, visits: Visit[]) {
  if (confirm(`Remove your visit to ${name}? If you sync with Google Drive, it is removed on your other devices too.`)) deleteVisits(visits)
}

export const formatDate = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
