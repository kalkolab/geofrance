import type { RefData } from './ref'

export interface Progress {
  visited: number
  total: number
}

export interface RegionProgress {
  code: string
  name: string
  departements: Progress
  communes: Progress
}

export interface Stats {
  communes: Progress
  departements: Progress
  regions: Progress
  byRegion: RegionProgress[] // most complete first
  communesByDepartement: Map<string, number>
  departementShareByRegion: Map<string, number> // 0..1
}

// Departments and regions are derived from visited communes, never stored separately.
export function computeStats(ref: RefData, visitedCommunes: Iterable<string>): Stats {
  const communesByDepartement = new Map<string, number>()
  let communes = 0
  for (const code of new Set(visitedCommunes)) {
    const c = ref.commune.get(code)
    if (!c) continue
    communes++
    communesByDepartement.set(c.departement, (communesByDepartement.get(c.departement) ?? 0) + 1)
  }

  const totals = new Map(ref.regions.map((r) => [r.code, { deps: 0, depsVisited: 0, communes: 0, communesVisited: 0 }]))
  const regionOfDep = new Map(ref.departements.map((d) => [d.code, d.region]))
  for (const d of ref.departements) {
    const t = totals.get(d.region)!
    t.deps++
    if (communesByDepartement.has(d.code)) t.depsVisited++
    t.communesVisited += communesByDepartement.get(d.code) ?? 0
  }
  for (const c of ref.communes) totals.get(regionOfDep.get(c.departement)!)!.communes++

  const byRegion = ref.regions
    .map((r) => {
      const t = totals.get(r.code)!
      return {
        code: r.code,
        name: r.name,
        departements: { visited: t.depsVisited, total: t.deps },
        communes: { visited: t.communesVisited, total: t.communes },
      }
    })
    .sort(
      (a, b) =>
        b.departements.visited / b.departements.total - a.departements.visited / a.departements.total ||
        b.communes.visited - a.communes.visited ||
        a.name.localeCompare(b.name, 'fr'),
    )

  return {
    communes: { visited: communes, total: ref.communes.length },
    departements: { visited: communesByDepartement.size, total: ref.departements.length },
    regions: { visited: byRegion.filter((r) => r.departements.visited > 0).length, total: ref.regions.length },
    byRegion,
    communesByDepartement,
    departementShareByRegion: new Map(byRegion.map((r) => [r.code, r.departements.visited / r.departements.total])),
  }
}
