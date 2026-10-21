// Checks the generated data in public/data (run `npm run build:geo` first).
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Geocoder } from '../src/lib/geocoder'
import { parseRef } from '../src/lib/ref'

const dir = 'public/data'
const read = (path: string) => JSON.parse(readFileSync(`${dir}/${path}`, 'utf8'))

describe.skipIf(!existsSync(`${dir}/ref.json`))('generated data', () => {
  const geo = parseRef(read('ref.json'))
  const geocoder = new Geocoder({
    departements: async () => read('departements.geojson'),
    communes: async (dep) => read(`communes/${dep}.geojson`),
  })

  it('covers mainland France, Corsica and the five overseas departments', () => {
    expect(geo.regions).toHaveLength(18)
    expect(geo.departements).toHaveLength(101)
    expect(geo.communes.length).toBeGreaterThan(34000)
    expect(geo.departement.has('2A') && geo.departement.has('2B')).toBe(true)
    expect(geo.departements.filter((d) => d.code.startsWith('97')).map((d) => d.code)).toEqual(['971', '972', '973', '974', '976'])
  })

  it.each([
    ['Notre-Dame, Paris', 2.3499, 48.853, '75', '75056'],
    ['Vieux-Port, Marseille', 5.3698, 43.2951, '13', '13055'],
    ['Place Bellecour, Lyon', 4.8323, 45.7578, '69', '69123'],
    ['Ajaccio', 8.7369, 41.9192, '2A', '2A004'],
    ['Bastia', 9.4509, 42.6977, '2B', '2B033'],
    ['Strasbourg cathedral', 7.7508, 48.5818, '67', '67482'],
    ['Brest', -4.4861, 48.3904, '29', '29019'],
    ['Pointe-à-Pitre', -61.5331, 16.2411, '971', '97120'],
    ['Fort-de-France', -61.0588, 14.6161, '972', '97209'],
    ['Cayenne', -52.3135, 4.9224, '973', '97302'],
    ['Saint-Denis, La Réunion', 55.4481, -20.8789, '974', '97411'],
    ['Mamoudzou', 45.2279, -12.7806, '976', '97611'],
  ])('locates %s', async (_name, lon, lat, dep, commune) => {
    expect(await geocoder.locate(lon, lat)).toEqual({ departement: dep, commune })
  })

  it('returns null outside France', async () => {
    expect(await geocoder.locate(-0.1276, 51.5072)).toBe(null) // London
    expect(await geocoder.locate(4.3517, 50.8503)).toBe(null) // Brussels
    expect(await geocoder.locate(-63.0501, 18.0708)).toBe(null) // Saint-Martin, a collectivity, not a department
  })
})
