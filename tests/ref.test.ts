import { describe, expect, it } from 'vitest'
import { normalize, parseRef, searchCommunes } from '../src/lib/ref'
import { computeStats } from '../src/lib/stats'

const geo = parseRef({
  regions: [
    ['11', 'Île-de-France'],
    ['94', 'Corse'],
  ],
  departements: [
    ['75', 'Paris', '11'],
    ['92', 'Hauts-de-Seine', '11'],
    ['2A', 'Corse-du-Sud', '94'],
  ],
  communes: [
    ['75056', 'Paris', '75', ['75001', '75002'], 2100000],
    ['92012', 'Boulogne-Billancourt', '92', ['92100'], 120000],
    ['92064', 'Saint-Cloud', '92', ['92210'], 30000],
    ['2A004', 'Ajaccio', '2A', ['20000', '20090'], 73000],
    ['2A041', 'Bonifacio', '2A', ['20169'], 3000],
  ],
})

describe('search', () => {
  it('ignores accents, case, hyphens and saint abbreviations', () => {
    expect(normalize("Saint-Étienne-de-l'Olm")).toBe('st etienne de l olm')
    expect(searchCommunes(geo, 'st cloud').map((c) => c.code)).toEqual(['92064'])
    expect(searchCommunes(geo, 'saint-cloud').map((c) => c.code)).toEqual(['92064'])
  })

  it('matches word starts inside names', () => {
    expect(searchCommunes(geo, 'billan').map((c) => c.code)).toEqual(['92012'])
  })

  it('searches postcodes by prefix', () => {
    expect(searchCommunes(geo, '200').map((c) => c.code)).toEqual(['2A004'])
    expect(searchCommunes(geo, '75002').map((c) => c.code)).toEqual(['75056'])
  })
})

describe('stats', () => {
  it('derives departments and regions from visited communes', () => {
    const stats = computeStats(geo, ['75056', '92012', '92064', 'unknown', '75056'])
    expect(stats.communes).toEqual({ visited: 3, total: 5 })
    expect(stats.departements).toEqual({ visited: 2, total: 3 })
    expect(stats.regions).toEqual({ visited: 1, total: 2 })
    expect(stats.communesByDepartement.get('92')).toBe(2)
    expect(stats.departementShareByRegion.get('11')).toBe(1)
    expect(stats.departementShareByRegion.get('94')).toBe(0)
    expect(stats.byRegion.map((r) => r.code)).toEqual(['11', '94'])
    expect(stats.byRegion[0].communes).toEqual({ visited: 3, total: 3 })
  })
})
