// Goals are fixed lists of places worked out from the reference data; progress comes from your visits.
// A region or department counts once any commune in it is visited.

import { isOverseas, type RefData } from './ref'

export type GoalItem = { kind: 'region' | 'departement' | 'commune'; code: string }

export type GoalTitle =
  | { key: 'goalRegions' | 'goalDepartements' | 'goalMainlandRegions' | 'goalMainlandDepartements' | 'goalOverseas' | 'goalPrefectures' | 'goalCapitals' }
  | { key: 'goalCities'; count: number }
  | { key: 'goalRegionDeps'; region: string }

export interface Goal {
  id: string
  title: GoalTitle
  group: 'france' | 'region'
  items: GoalItem[]
}

export interface GoalProgress extends Goal {
  done: number
  total: number
  missing: GoalItem[]
  reached: boolean
  reachedOn: string | null // date of the visit that completed it, null if unknown or not reached
}

export function goalsFor(ref: RefData): Goal[] {
  const communes = (codes: (string | undefined)[]): GoalItem[] =>
    codes.filter((c): c is string => !!c && ref.commune.has(c)).map((code) => ({ kind: 'commune', code }))
  const mainlandDeps = ref.departements.filter((d) => !isOverseas(d.code))
  const mainlandRegions = new Set(mainlandDeps.map((d) => d.region))
  const largest = [...ref.communes].sort((a, b) => b.population - a.population)
  const france: Goal[] = [
    { id: 'regions', title: { key: 'goalRegions' }, items: ref.regions.map((r) => ({ kind: 'region', code: r.code })) },
    {
      id: 'departements',
      title: { key: 'goalDepartements' },
      items: ref.departements.map((d) => ({ kind: 'departement', code: d.code })),
    },
    {
      id: 'mainland-regions',
      title: { key: 'goalMainlandRegions' },
      items: ref.regions.filter((r) => mainlandRegions.has(r.code)).map((r) => ({ kind: 'region', code: r.code })),
    },
    {
      id: 'mainland-departements',
      title: { key: 'goalMainlandDepartements' },
      items: mainlandDeps.map((d) => ({ kind: 'departement', code: d.code })),
    },
    {
      id: 'overseas',
      title: { key: 'goalOverseas' },
      items: ref.departements.filter((d) => isOverseas(d.code)).map((d) => ({ kind: 'departement', code: d.code })),
    },
    { id: 'prefectures', title: { key: 'goalPrefectures' }, items: communes(ref.departements.map((d) => d.prefecture)) },
    { id: 'capitals', title: { key: 'goalCapitals' }, items: communes(ref.regions.map((r) => r.capital)) },
    { id: 'cities10', title: { key: 'goalCities', count: 10 }, items: communes(largest.slice(0, 10).map((c) => c.code)) },
    { id: 'cities50', title: { key: 'goalCities', count: 50 }, items: communes(largest.slice(0, 50).map((c) => c.code)) },
  ].map((g) => ({ ...g, group: 'france' }) as Goal)
  // Overseas regions have a single department, so they get no region goal of their own.
  const regions: Goal[] = ref.regions
    .map((r) => ({
      id: `region-${r.code}`,
      title: { key: 'goalRegionDeps', region: r.name } as GoalTitle,
      group: 'region' as const,
      items: ref.departements.filter((d) => d.region === r.code).map((d) => ({ kind: 'departement' as const, code: d.code })),
    }))
    .filter((g) => g.items.length > 1)
  return [...france.filter((g) => g.items.length), ...regions]
}

interface FirstVisit {
  commune: string
  date: string | null
}

export function goalProgress(ref: RefData, goals: Goal[], visits: FirstVisit[]): GoalProgress[] {
  // For each place: visited or not, and the earliest known date it was first visited.
  const seen = new Map<string, string | null>()
  const mark = (key: string, date: string | null) => {
    const current = seen.get(key)
    if (current === undefined || (date && (current === null || date < current))) seen.set(key, date)
  }
  for (const v of visits) {
    const c = ref.commune.get(v.commune)
    if (!c) continue
    mark(`commune:${c.code}`, v.date)
    mark(`departement:${c.departement}`, v.date)
    const region = ref.departement.get(c.departement)?.region
    if (region) mark(`region:${region}`, v.date)
  }

  return goals.map((goal) => {
    const missing = goal.items.filter((i) => !seen.has(`${i.kind}:${i.code}`))
    const reached = missing.length === 0
    let reachedOn: string | null = null
    if (reached) {
      const dates = goal.items.map((i) => seen.get(`${i.kind}:${i.code}`) ?? null)
      if (dates.every(Boolean)) reachedOn = (dates as string[]).reduce((a, b) => (b > a ? b : a))
    }
    return { ...goal, done: goal.items.length - missing.length, total: goal.items.length, missing, reached, reachedOn }
  })
}
