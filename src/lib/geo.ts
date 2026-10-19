// Point-in-polygon lookups over GeoJSON boundaries, used to turn a GPS point into a commune.

export type Position = number[]
export type Polygon = Position[][]

export interface Geometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: Polygon | Polygon[]
}

export interface Feature<P = { code: string }> {
  type: 'Feature'
  properties: P
  geometry: Geometry
}

export interface FeatureCollection<P = { code: string }> {
  type: 'FeatureCollection'
  features: Feature<P>[]
}

export interface Shape {
  code: string
  polygons: Polygon[]
  bbox: [minX: number, minY: number, maxX: number, maxY: number]
}

export function polygonsOf(geometry: Geometry): Polygon[] {
  return geometry.type === 'Polygon' ? [geometry.coordinates as Polygon] : (geometry.coordinates as Polygon[])
}

export function toShapes(fc: FeatureCollection<{ code: string }>): Shape[] {
  return fc.features.map((f) => {
    const polygons = polygonsOf(f.geometry)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const polygon of polygons) {
      for (const [x, y] of polygon[0]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    return { code: f.properties.code, polygons, bbox: [minX, minY, maxX, maxY] }
  })
}

export function pointInRing(x: number, y: number, ring: Position[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function pointInPolygon(x: number, y: number, polygon: Polygon): boolean {
  if (!pointInRing(x, y, polygon[0])) return false
  for (let h = 1; h < polygon.length; h++) if (pointInRing(x, y, polygon[h])) return false
  return true
}

export function findShape(shapes: Shape[], lon: number, lat: number): string | null {
  for (const s of shapes) {
    const [minX, minY, maxX, maxY] = s.bbox
    if (lon < minX || lon > maxX || lat < minY || lat > maxY) continue
    if (s.polygons.some((p) => pointInPolygon(lon, lat, p))) return s.code
  }
  return null
}

// Simplified boundaries cut corners, so a harbour or beach can fall just outside every shape.
// Falls back to the closest shape whose border is within maxKm.
export function nearestShape(shapes: Shape[], lon: number, lat: number, maxKm: number): string | null {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180)
  const ky = 110.57
  const px = lon * kx, py = lat * ky
  const margin = maxKm / ky
  let best: string | null = null
  let bestSq = maxKm * maxKm
  for (const s of shapes) {
    const [minX, minY, maxX, maxY] = s.bbox
    if (lon < minX - margin * 2 || lon > maxX + margin * 2 || lat < minY - margin || lat > maxY + margin) continue
    for (const polygon of s.polygons) {
      const ring = polygon[0]
      for (let i = 1; i < ring.length; i++) {
        const d = segmentDistanceSq(px, py, ring[i - 1][0] * kx, ring[i - 1][1] * ky, ring[i][0] * kx, ring[i][1] * ky)
        if (d < bestSq) {
          bestSq = d
          best = s.code
        }
      }
    }
  }
  return best
}

function segmentDistanceSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0
  const x = ax + t * dx - px, y = ay + t * dy - py
  return x * x + y * y
}
