// Builds the reference data the app loads from public/data:
//   ref.json                 regions, departments and communes of mainland France (incl. Corsica)
//                            and the five overseas departments (Guadeloupe, Martinique, Guyane,
//                            La Réunion, Mayotte); the other overseas collectivities are not departments
//   regions.geojson          region boundaries
//   departements.geojson     department boundaries
//   communes/<dep>.geojson   commune boundaries, one file per department
//
// Codes and names: INSEE COG via @etalab/decoupage-administratif (current year).
// Boundaries: IGN ADMIN EXPRESS 2018, simplified, from gregoiredavid/france-geojson.
// Boundaries of communes merged since 2018 are reassigned to the commune they now belong to.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const SOURCE = 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/5d34ee6d0140c29f785fdb047d9329f1aab58833'
const CACHE = '.cache/geo'
const OUT = 'public/data'
const DECIMALS = 4 // about 10 m, plenty for city-level lookups

async function fetchCached(name) {
  const path = `${CACHE}/${name.replaceAll('/', '_')}`
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    const res = await fetch(`${SOURCE}/${name}`)
    if (!res.ok) throw new Error(`Download failed: ${name} (${res.status})`)
    const text = await res.text()
    await mkdir(CACHE, { recursive: true })
    await writeFile(path, text)
    return JSON.parse(text)
  }
}

const factor = 10 ** DECIMALS
const round = (coords) =>
  typeof coords[0] === 'number' ? coords.map((n) => Math.round(n * factor) / factor) : coords.map(round)

const polygonsOf = (geometry) => {
  if (geometry?.type === 'Polygon') return [geometry.coordinates]
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates
  return [] // a few source features have no geometry
}

const feature = (properties, polygons) => ({
  type: 'Feature',
  properties,
  geometry:
    polygons.length === 1
      ? { type: 'Polygon', coordinates: round(polygons[0]) }
      : { type: 'MultiPolygon', coordinates: round(polygons) },
})

const collection = (features) => JSON.stringify({ type: 'FeatureCollection', features })

const cogRegions = require('@etalab/decoupage-administratif/data/regions.json')
const cogDeps = require('@etalab/decoupage-administratif/data/departements.json')
const cogCommunes = require('@etalab/decoupage-administratif/data/communes.json')

const ZONES = new Set(['metro', 'drom'])
const regions = cogRegions.filter((r) => ZONES.has(r.zone))
const deps = cogDeps.filter((d) => ZONES.has(d.zone))
const communes = cogCommunes.filter((c) => c.type === 'commune-actuelle' && ZONES.has(c.zone))
const communeByCode = new Map(communes.map((c) => [c.code, c]))
// Delegated/associated communes and municipal arrondissements point to the commune they belong to.
const parentOf = new Map(
  cogCommunes.filter((c) => c.type !== 'commune-actuelle').map((c) => [c.code, c.chefLieu ?? c.commune]),
)

await mkdir(`${OUT}/communes`, { recursive: true })

// Overseas departments come in one folder each; each is also its own region.
const OVERSEAS = { 971: 'guadeloupe', 972: 'martinique', 973: 'guyane', 974: 'la-reunion', 976: 'mayotte' }
const overseas = await Promise.all(
  Object.entries(OVERSEAS).map(async ([code, slug]) => ({
    code,
    departement: await fetchCached(`departements/${code}-${slug}/departement-${code}-${slug}.geojson`),
    communes: await fetchCached(`departements/${code}-${slug}/communes-${code}-${slug}.geojson`),
  })),
)
// The overseas department outlines are full detail; simplify them like the mainland ones.
function simplify(ring, tolerance) {
  if (ring.length < 5) return ring
  // A ring starts and ends on the same point, so also anchor the point farthest from it.
  const far0 = ring.reduce((best, p, i) => (Math.hypot(p[0] - ring[0][0], p[1] - ring[0][1]) > Math.hypot(ring[best][0] - ring[0][0], ring[best][1] - ring[0][1]) ? i : best), 0)
  const keep = new Uint8Array(ring.length)
  keep[0] = keep[far0] = keep[ring.length - 1] = 1
  const stack = [[0, far0], [far0, ring.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const [ax, ay] = ring[a], [bx, by] = ring[b]
    const dx = bx - ax, dy = by - ay
    const length = Math.hypot(dx, dy) || 1
    let far = -1, farthest = tolerance
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (ring[i][0] - ax) - dx * (ring[i][1] - ay)) / length
      if (d > farthest) (far = i), (farthest = d)
    }
    if (far >= 0) {
      keep[far] = 1
      stack.push([a, far], [far, b])
    }
  }
  const out = ring.filter((_, i) => keep[i])
  return out.length >= 4 ? out : ring
}
const overseasPolygons = (code) => {
  const shape = overseas.find((o) => o.code === code).departement
  return (shape.features ?? [shape])
    .flatMap((f) => polygonsOf(f.geometry))
    .map((polygon) => polygon.map((ring) => simplify(ring, 0.002)))
}

const regionShapes = await fetchCached('regions-version-simplifiee.geojson')
const regionNames = new Map(regions.map((r) => [r.code, r.nom]))
await writeFile(
  `${OUT}/regions.geojson`,
  collection(
    regionShapes.features
      .filter((f) => regionNames.has(f.properties.code))
      .map((f) => feature({ code: f.properties.code, name: regionNames.get(f.properties.code) }, polygonsOf(f.geometry)))
      .concat(
        deps
          .filter((d) => OVERSEAS[d.code])
          .map((d) => feature({ code: d.region, name: regionNames.get(d.region) }, overseasPolygons(d.code))),
      ),
  ),
)

const depShapes = await fetchCached('departements-version-simplifiee.geojson')
const depByCode = new Map(deps.map((d) => [d.code, d]))
await writeFile(
  `${OUT}/departements.geojson`,
  collection(
    depShapes.features
      .filter((f) => depByCode.has(f.properties.code))
      .map((f) => {
        const d = depByCode.get(f.properties.code)
        return feature({ code: d.code, name: d.nom, region: d.region }, polygonsOf(f.geometry))
      })
      .concat(
        deps.filter((d) => OVERSEAS[d.code]).map((d) => feature({ code: d.code, name: d.nom, region: d.region }, overseasPolygons(d.code))),
      ),
  ),
)

const communeShapes = await fetchCached('communes-version-simplifiee.geojson')
const polygonsByCommune = new Map()
let reassigned = 0
const unmatched = []
for (const f of [...communeShapes.features, ...overseas.flatMap((o) => o.communes.features)]) {
  let code = f.properties.code
  if (!communeByCode.has(code)) {
    code = parentOf.get(code)
    if (!code || !communeByCode.has(code)) {
      unmatched.push(f.properties.code)
      continue
    }
    reassigned++
  }
  if (!polygonsOf(f.geometry).length) continue
  if (!polygonsByCommune.has(code)) polygonsByCommune.set(code, [])
  polygonsByCommune.get(code).push(...polygonsOf(f.geometry))
}

const featuresByDep = new Map(deps.map((d) => [d.code, []]))
for (const [code, polygons] of polygonsByCommune) {
  featuresByDep.get(communeByCode.get(code).departement).push(feature({ code }, polygons))
}
for (const [dep, features] of featuresByDep) {
  await writeFile(`${OUT}/communes/${dep}.geojson`, collection(features))
}

// A point inside each commune that goals point to on the map: prefectures, regional capitals and
// the largest cities. The average of the largest ring's corners is close enough for a marker.
const center = (polygons) => {
  const ring = polygons.reduce((a, b) => (b[0].length > a[0].length ? b : a))[0]
  const sum = ring.reduce(([x, y], [lon, lat]) => [x + lon, y + lat], [0, 0])
  return round([sum[0] / ring.length, sum[1] / ring.length])
}
const goalPlaces = new Set([
  ...deps.map((d) => d.chefLieu),
  ...regions.map((r) => r.chefLieu),
  ...[...communes].sort((a, b) => (b.population ?? 0) - (a.population ?? 0)).slice(0, 50).map((c) => c.code),
])

await writeFile(
  `${OUT}/ref.json`,
  JSON.stringify({
    version: 3,
    regions: regions.map((r) => [r.code, r.nom, r.chefLieu]),
    departements: deps.map((d) => [d.code, d.nom, d.region, d.chefLieu]),
    communes: communes.map((c) => [c.code, c.nom, c.departement, c.codesPostaux ?? [], c.population ?? 0]),
    points: [...goalPlaces].filter((code) => polygonsByCommune.has(code)).map((code) => [code, ...center(polygonsByCommune.get(code))]),
  }),
)

const missing = communes.filter((c) => !polygonsByCommune.has(c.code)).map((c) => c.code)
console.log(
  `ref: ${regions.length} regions, ${deps.length} departments, ${communes.length} communes\n` +
    `boundaries: ${polygonsByCommune.size} communes (${reassigned} merged shapes reassigned, ` +
    `${unmatched.length} unmatched shapes dropped, ${missing.length} communes without a shape)`,
)
