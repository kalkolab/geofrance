import { describe, expect, it } from 'vitest'
import { findShape, nearestShape, pointInPolygon, toShapes, type FeatureCollection } from '../src/lib/geo'

const square = (x: number, y: number, size: number) => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
]

const fc: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    // A square with a square hole in the middle.
    { type: 'Feature', properties: { code: 'donut' }, geometry: { type: 'Polygon', coordinates: [square(0, 0, 10), square(4, 4, 2)] } },
    // Two separate squares, like a commune with an island.
    { type: 'Feature', properties: { code: 'islands' }, geometry: { type: 'MultiPolygon', coordinates: [[square(20, 0, 2)], [square(30, 0, 2)]] } },
    // The hole of the donut is another commune.
    { type: 'Feature', properties: { code: 'hole' }, geometry: { type: 'Polygon', coordinates: [square(4, 4, 2)] } },
  ],
}

describe('point in polygon', () => {
  it('respects holes', () => {
    const donut = fc.features[0].geometry.coordinates as number[][][]
    expect(pointInPolygon(1, 1, donut)).toBe(true)
    expect(pointInPolygon(5, 5, donut)).toBe(false)
    expect(pointInPolygon(11, 5, donut)).toBe(false)
  })

  it('finds the shape containing a point', () => {
    const shapes = toShapes(fc)
    expect(findShape(shapes, 1, 9)).toBe('donut')
    expect(findShape(shapes, 5, 5)).toBe('hole')
    expect(findShape(shapes, 31, 1)).toBe('islands')
    expect(findShape(shapes, 25, 1)).toBe(null)
  })

  it('computes bounding boxes over all parts', () => {
    expect(toShapes(fc)[1].bbox).toEqual([20, 0, 32, 2])
  })
})

describe('nearest shape', () => {
  it('snaps points just outside a shape and ignores far ones', () => {
    const shapes = toShapes(fc)
    // 0.01° east of the donut at the equator is about 1.1 km.
    expect(nearestShape(shapes, 10.01, 5, 2)).toBe('donut')
    expect(nearestShape(shapes, 15, 5, 2)).toBe(null)
  })
})
