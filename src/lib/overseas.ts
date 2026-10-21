// The five overseas departments are drawn in boxes under mainland France, as on most maps of France.
// Data keeps their real coordinates (for the geocoder and imports); only what is drawn is moved,
// and taps or hovers inside a box are moved back before looking up the place.

import type { Geometry, Position } from './geo'

type Box = [west: number, south: number, east: number, north: number]

// Web Mercator y, in degrees so it scales like longitude.
const toY = (lat: number) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI
const fromY = (y: number) => (Math.atan(Math.exp((y * Math.PI) / 180)) * 360) / Math.PI - 90

// Real extent of each department, a little wider than its outline.
const REAL: { code: string; box: Box }[] = [
  { code: '971', box: [-61.85, 15.8, -60.95, 16.55] }, // Guadeloupe
  { code: '972', box: [-61.25, 14.36, -60.78, 14.9] }, // Martinique
  { code: '973', box: [-54.65, 2.08, -51.57, 5.78] }, // Guyane
  { code: '974', box: [55.19, -21.42, 55.87, -20.84] }, // La Réunion
  { code: '976', box: [44.99, -13.03, 45.33, -12.61] }, // Mayotte
]

// Five boxes in a row south of the Pyrenees, clear of Corsica.
const ROW = { west: -5.2, east: 7.8, south: 40.1, north: 41.95, gap: 0.25 }
const PADDING = 0.88 // share of the box the department fills

export interface Inset {
  code: string
  frame: Box // the box drawn on the map
  real: Box
  scale: number
  realCenter: [number, number] // [lon, mercator y]
  frameCenter: [number, number]
}

const width = (ROW.east - ROW.west - ROW.gap * (REAL.length - 1)) / REAL.length

export const INSETS: Inset[] = REAL.map(({ code, box }, i) => {
  const west = ROW.west + i * (width + ROW.gap)
  const frame: Box = [west, ROW.south, west + width, ROW.north]
  const [fy0, fy1, ry0, ry1] = [toY(frame[1]), toY(frame[3]), toY(box[1]), toY(box[3])]
  const scale = PADDING * Math.min((frame[2] - frame[0]) / (box[2] - box[0]), (fy1 - fy0) / (ry1 - ry0))
  return {
    code,
    frame,
    real: box,
    scale,
    realCenter: [(box[0] + box[2]) / 2, (ry0 + ry1) / 2],
    frameCenter: [(frame[0] + frame[2]) / 2, (fy0 + fy1) / 2],
  }
})

// Everything the map shows, boxes included: [west, south, east, north].
export const DISPLAY_BOUNDS: Box = [-5.3, ROW.south - 0.1, 9.6, 51.15]

const inside = ([lon, lat]: Position, box: Box) => lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3]
// Every overseas department lies far outside mainland longitudes, so most points skip the search.
const mainland = (lon: number) => lon > -10 && lon < 15

export function toDisplay(point: Position): Position {
  if (mainland(point[0])) return point
  const inset = INSETS.find((i) => inside(point, i.real))
  if (!inset) return point
  const x = inset.frameCenter[0] + (point[0] - inset.realCenter[0]) * inset.scale
  const y = inset.frameCenter[1] + (toY(point[1]) - inset.realCenter[1]) * inset.scale
  return [x, fromY(y)]
}

// A tap or hover on the map, back to where it really is.
export function fromDisplay(point: Position): Position {
  const inset = INSETS.find((i) => inside(point, i.frame))
  if (!inset) return point
  const lon = inset.realCenter[0] + (point[0] - inset.frameCenter[0]) / inset.scale
  const y = inset.realCenter[1] + (toY(point[1]) - inset.frameCenter[1]) / inset.scale
  return [lon, fromY(y)]
}

const moveCoords = (coords: unknown): unknown =>
  typeof (coords as number[])[0] === 'number' ? toDisplay(coords as Position) : (coords as unknown[]).map(moveCoords)

export function displayGeometry<G extends Geometry | GeoJSON.Geometry>(geometry: G): G {
  if (!('coordinates' in geometry)) return geometry
  return { ...geometry, coordinates: moveCoords(geometry.coordinates) } as G
}

export function displayCollection<C extends { features: { geometry: Geometry | GeoJSON.Geometry }[] }>(fc: C): C {
  return { ...fc, features: fc.features.map((f) => ({ ...f, geometry: displayGeometry(f.geometry) })) }
}

// The boxes' outlines, as a layer for the map.
export const insetFrames: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: INSETS.map(({ code, frame: [w, s, e, n] }) => ({
    type: 'Feature',
    properties: { code },
    geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
  })),
}
