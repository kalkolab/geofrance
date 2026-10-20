import { describe, expect, it } from 'vitest'
import { firstVisits, isEarlier } from '../src/lib/firstVisit'

const v = (uid: string, commune: string, date: string | null, createdAt = '2024-01-01') => ({ uid, commune, date, createdAt })

describe('first visit per commune', () => {
  it('prefers the earliest date, then any date over none, then the first recorded', () => {
    expect(isEarlier(v('a', 'x', '2020-01-01'), v('b', 'x', '2021-01-01'))).toBe(true)
    expect(isEarlier(v('a', 'x', '2021-01-01'), v('b', 'x', null))).toBe(true)
    expect(isEarlier(v('a', 'x', null), v('b', 'x', '2021-01-01'))).toBe(false)
    expect(isEarlier(v('a', 'x', null, '2024-02-01'), v('b', 'x', null, '2024-01-01'))).toBe(false)
  })

  it('splits visits into the first per commune and the rest', () => {
    const { first, extra } = firstVisits([v('a', 'x', '2022-01-01'), v('b', 'x', '2020-01-01'), v('c', 'y', null), v('d', 'x', null)])
    expect([...first.values()].map((f) => f.uid)).toEqual(['b', 'c'])
    expect(extra.map((e) => e.uid).sort()).toEqual(['a', 'd'])
  })
})
