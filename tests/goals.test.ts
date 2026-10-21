import { describe, expect, it } from 'vitest'
import { goalProgress, goalsFor } from '../src/lib/goals'
import { parseRef } from '../src/lib/ref'

const ref = parseRef({
  regions: [
    ['53', 'Bretagne', '35238'],
    ['94', 'Corse', '2A004'],
  ],
  departements: [
    ['35', 'Ille-et-Vilaine', '53', '35238'],
    ['29', 'Finistère', '53', '29232'],
    ['2A', 'Corse-du-Sud', '94', '2A004'],
  ],
  communes: [
    ['35238', 'Rennes', '35', ['35000'], 220000],
    ['35288', 'Saint-Malo', '35', ['35400'], 47000],
    ['29232', 'Quimper', '29', ['29000'], 63000],
    ['2A004', 'Ajaccio', '2A', ['20000'], 72000],
  ],
})

const byId = (visits: { commune: string; date: string | null }[]) =>
  new Map(goalProgress(ref, goalsFor(ref), visits).map((g) => [g.id, g]))

describe('goals', () => {
  it('lists France-wide goals and one per region', () => {
    expect(goalsFor(ref).map((g) => g.id)).toEqual(['regions', 'departements', 'prefectures', 'capitals', 'cities10', 'cities50', 'region-53', 'region-94'])
  })

  it('counts a department or region once any commune in it is visited', () => {
    const g = byId([{ commune: '35288', date: '2023-05-01' }])
    expect(g.get('regions')).toMatchObject({ done: 1, total: 2, reached: false })
    expect(g.get('prefectures')).toMatchObject({ done: 0, total: 3 })
    expect(g.get('region-53')!.missing).toEqual([{ kind: 'departement', code: '29' }])
  })

  it('dates a reached goal by the visit that completed it', () => {
    const g = byId([
      { commune: '35288', date: '2023-05-01' },
      { commune: '29232', date: '2021-08-10' },
      { commune: '35238', date: '2019-02-02' }, // an earlier first visit to Ille-et-Vilaine
    ])
    expect(g.get('region-53')).toMatchObject({ reached: true, reachedOn: '2021-08-10' })
  })

  it('reaches a goal without a date when a place was visited on an unknown date', () => {
    const g = byId([{ commune: '2A004', date: null }])
    expect(g.get('region-94')).toMatchObject({ reached: true, reachedOn: null })
  })
})
