import { describe, expect, it } from 'vitest'
import { fromDisplay, INSETS, toDisplay } from '../src/lib/overseas'

const inside = ([lon, lat]: number[], [w, s, e, n]: number[]) => lon >= w && lon <= e && lat >= s && lat <= n

describe('overseas insets', () => {
  it('leaves mainland points where they are', () => {
    expect(toDisplay([2.35, 48.85])).toEqual([2.35, 48.85])
    expect(fromDisplay([2.35, 48.85])).toEqual([2.35, 48.85])
  })

  it.each([
    ['971', -61.5331, 16.2411],
    ['972', -61.0588, 14.6161],
    ['973', -52.3135, 4.9224],
    ['974', 55.4481, -20.8789],
    ['976', 45.2279, -12.7806],
  ])('moves %s into its box and back', (code, lon, lat) => {
    const shown = toDisplay([lon, lat])
    expect(inside(shown, INSETS.find((i) => i.code === code)!.frame)).toBe(true)
    const [backLon, backLat] = fromDisplay(shown)
    expect(backLon).toBeCloseTo(lon, 6)
    expect(backLat).toBeCloseTo(lat, 6)
  })

  it('keeps the boxes apart and clear of the mainland', () => {
    for (const [i, a] of INSETS.entries()) {
      expect(a.frame[3]).toBeLessThan(42.3) // the southern tip of the Pyrenees
      for (const b of INSETS.slice(i + 1)) expect(a.frame[2] < b.frame[0] || b.frame[2] < a.frame[0]).toBe(true)
    }
  })
})
