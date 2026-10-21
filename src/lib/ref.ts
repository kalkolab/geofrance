// Reference lists of regions, departments and communes: mainland France with Corsica, and the
// five overseas departments (971 Guadeloupe, 972 Martinique, 973 Guyane, 974 La Réunion, 976 Mayotte).

export const isOverseas = (departement: string) => departement.startsWith('97')

export interface Region {
  code: string
  name: string
  capital?: string // commune code of the regional capital
}

export interface Departement {
  code: string
  name: string
  region: string
  prefecture?: string // commune code
}

export interface Commune {
  code: string
  name: string
  departement: string
  postcodes: string[]
  population: number
  search: string
}

export interface RefData {
  regions: Region[]
  departements: Departement[]
  communes: Commune[]
  region: Map<string, Region>
  departement: Map<string, Departement>
  commune: Map<string, Commune>
  point: Map<string, [number, number]> // [lon, lat] for prefectures, regional capitals and large cities
}

export interface RawRef {
  regions: [string, string, string?][]
  departements: [string, string, string, string?][]
  communes: [string, string, string, string[], number][]
  points?: [string, number, number][]
}

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-'’]/g, ' ')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bsainte\b/g, 'ste')
    .replace(/\s+/g, ' ')
    .trim()

export function parseRef(raw: RawRef): RefData {
  const regions = raw.regions.map(([code, name, capital]) => ({ code, name, capital }))
  const departements = raw.departements.map(([code, name, region, prefecture]) => ({ code, name, region, prefecture }))
  const communes = raw.communes.map(([code, name, departement, postcodes, population]) => ({
    code,
    name,
    departement,
    postcodes,
    population,
    search: normalize(name),
  }))
  return {
    regions,
    departements,
    communes,
    region: new Map(regions.map((r) => [r.code, r])),
    departement: new Map(departements.map((d) => [d.code, d])),
    commune: new Map(communes.map((c) => [c.code, c])),
    point: new Map((raw.points ?? []).map(([code, lon, lat]) => [code, [lon, lat]])),
  }
}

// Name or postcode search: names starting with the query first, then larger communes first.
export function searchCommunes(ref: RefData, query: string, limit = 20): Commune[] {
  const q = normalize(query)
  if (!q) return []
  if (/^\d{2,5}$/.test(q)) {
    return ref.communes
      .filter((c) => c.postcodes.some((p) => p.startsWith(q)))
      .sort((a, b) => b.population - a.population)
      .slice(0, limit)
  }
  const scored: [number, Commune][] = []
  for (const c of ref.communes) {
    const rank = c.search === q ? 0 : c.search.startsWith(q) ? 1 : c.search.includes(' ' + q) ? 2 : c.search.includes(q) ? 3 : -1
    if (rank >= 0) scored.push([rank, c])
  }
  return scored
    .sort((a, b) => a[0] - b[0] || b[1].population - a[1].population)
    .slice(0, limit)
    .map(([, c]) => c)
}
