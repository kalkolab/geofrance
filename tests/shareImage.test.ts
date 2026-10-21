import { describe, expect, it } from 'vitest'
import { regionColor } from '../src/lib/shareImage'

const colors = { unvisited: 'none', departement: 'd', commune: 'c', regionSteps: ['s1', 's2', 's3', 's4', 's5'], border: 'b', regionBorder: 'r' }

describe('regionColor', () => {
  it('uses the same steps as the regions map', () => {
    expect(regionColor(0, colors)).toBe('none')
    expect(regionColor(0.1, colors)).toBe('s1')
    expect(regionColor(0.2, colors)).toBe('s2')
    expect(regionColor(0.5, colors)).toBe('s3')
    expect(regionColor(0.79, colors)).toBe('s4')
    expect(regionColor(1, colors)).toBe('s5')
  })
})
