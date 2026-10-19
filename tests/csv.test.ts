import { describe, expect, it } from 'vitest'
import { parseCsv } from '../src/lib/csv'
import { planImport } from '../src/lib/importPlan'
import type { Geocoder } from '../src/lib/geocoder'

const sample = `lat;"lon";"country";"city";"been"
4.260087;73.38002;"Asia";"Kodhipparu Island";"been"
47.80067;13.04337;"Austria";"Salzburg";"been"
48.8566;2.3522;"France";"Paris";"been"
43.2965;5.3698;"France";"Marseille";"want"
45.764;4.8357;"France";"Lyon";"been"
oops;4.8;"France";"Nowhere";"been"
`

describe('csv', () => {
  it('reads semicolon files with mixed quoting and filters on the been column', () => {
    const r = parseCsv(sample)
    expect(r.points.map((p) => p.label)).toEqual(['Kodhipparu Island', 'Salzburg', 'Paris', 'Lyon'])
    expect(r.points[2]).toEqual({ line: 4, lat: 48.8566, lon: 2.3522, label: 'Paris' })
    expect(r.notBeen).toBe(1)
    expect(r.invalid).toEqual([7])
  })

  it('reads comma files with a BOM, Windows line ends and other column names', () => {
    const r = parseCsv('﻿Name,Latitude,Longitude\r\n"Brest, Finistère",48.39,-4.486\r\n')
    expect(r.points).toEqual([{ line: 2, lat: 48.39, lon: -4.486, label: 'Brest, Finistère' }])
  })

  it('rejects files without coordinates', () => {
    expect(() => parseCsv('city;country\nParis;France')).toThrow(/lat/)
  })

  it('groups points by commune and skips foreign and already visited ones', async () => {
    const fake = {
      locate: async (lon: number) =>
        lon === 2.3522 ? { departement: '75', commune: '75056' } : lon === 4.8357 ? { departement: '69', commune: '69123' } : null,
    } as unknown as Geocoder
    const points = parseCsv(sample).points
    const plan = await planImport([...points, { ...points[2], label: 'Louvre' }], fake, new Set(['69123']))
    expect(plan).toEqual({ communes: [{ code: '75056', places: ['Paris', 'Louvre'] }], alreadyVisited: 1, outside: 2 })
  })
})
