import type { FeatureCollection } from './lib/geo'
import { Geocoder } from './lib/geocoder'
import { parseRef, type RawRef, type RefData } from './lib/ref'

const url = (path: string) => `${import.meta.env.BASE_URL}data/${path}`

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(url(path))
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`)
  return res.json()
}

export interface RegionProps {
  code: string
  name: string
}

export interface DepartementProps {
  code: string
  name: string
  region: string
}

const once = <T,>(load: () => Promise<T>) => {
  let value: Promise<T> | undefined
  return () => (value ??= load())
}

export const loadRef = once(async (): Promise<RefData> => parseRef(await getJson<RawRef>('ref.json')))
export const loadRegions = once(() => getJson<FeatureCollection<RegionProps>>('regions.geojson'))
export const loadDepartements = once(() => getJson<FeatureCollection<DepartementProps>>('departements.geojson'))

const communeFiles = new Map<string, Promise<FeatureCollection>>()
export function loadCommunes(departement: string): Promise<FeatureCollection> {
  let file = communeFiles.get(departement)
  if (!file) {
    file = getJson<FeatureCollection>(`communes/${departement}.geojson`)
    communeFiles.set(departement, file)
    file.catch(() => communeFiles.delete(departement))
  }
  return file
}

export const geocoder = new Geocoder({ departements: loadDepartements, communes: loadCommunes })
