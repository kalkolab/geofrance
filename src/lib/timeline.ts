// Reads Google Maps Timeline exports and returns the places where you stopped.
//
// Supported files:
// - Timeline.json exported from the Maps app on Android ("semanticSegments")
// - location-history.json exported from the Maps app on iPhone (an array of segments, "geo:lat,lon")
// - Google Takeout "Semantic Location History" monthly files ("timelineObjects" with "placeVisit")
// - Google Takeout Records.json (raw "locations"); stops are detected from points that stay put

import { t } from '../i18n'

export interface Stop {
  lat: number
  lon: number
  date: string | null // local date of arrival, YYYY-MM-DD
  label?: string
}

export type TimelineFormat = 'android' | 'ios' | 'takeout-semantic' | 'takeout-records'

export interface TimelineResult {
  format: TimelineFormat
  stops: Stop[]
}

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

// "48.8566°, 2.3522°" (Android) or "geo:48.8566,2.3522" (iPhone)
export function parseLatLng(text: unknown): [lat: number, lon: number] | null {
  if (typeof text !== 'string') return null
  const m = text.match(/(-?\d+(?:\.\d+)?)°?\s*,\s*(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const lat = Number(m[1]), lon = Number(m[2])
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null
}

// Keeps the local date written in the timestamp ("2024-05-01T23:30:00+02:00" is 1 May).
function dateOf(time: unknown): string | null {
  if (typeof time === 'string' && /^\d{4}-\d{2}-\d{2}/.test(time)) return time.slice(0, 10)
  const ms = typeof time === 'string' || typeof time === 'number' ? Number(time) : NaN
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null
}

const fromE7 = (v: unknown) => (typeof v === 'number' ? v / 1e7 : NaN)

function segmentStop(segment: unknown): Stop | null {
  if (!isObject(segment) || !isObject(segment.visit)) return null
  const candidate = segment.visit.topCandidate
  if (!isObject(candidate)) return null
  const location = isObject(candidate.placeLocation) ? candidate.placeLocation.latLng : candidate.placeLocation
  const point = parseLatLng(location)
  if (!point) return null
  return { lat: point[0], lon: point[1], date: dateOf(segment.startTime) }
}

function placeVisitStop(object: unknown): Stop | null {
  if (!isObject(object) || !isObject(object.placeVisit)) return null
  const { location, duration } = object.placeVisit
  if (!isObject(location)) return null
  const lat = fromE7(location.latitudeE7), lon = fromE7(location.longitudeE7)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const start = isObject(duration) ? (duration.startTimestamp ?? duration.startTimestampMs) : undefined
  const label = typeof location.name === 'string' ? location.name : undefined
  return { lat, lon, date: dateOf(start), label }
}

const STAY_METERS = 250
const STAY_MINUTES = 20

function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number) {
  const k = Math.PI / 180
  const x = (bLon - aLon) * k * Math.cos(((aLat + bLat) / 2) * k)
  const y = (bLat - aLat) * k
  return Math.sqrt(x * x + y * y) * 6371e3
}

// Raw points become a stop when they stay within STAY_METERS of where they started for STAY_MINUTES.
export function detectStops(points: { lat: number; lon: number; time: number }[]): Stop[] {
  const sorted = [...points].sort((a, b) => a.time - b.time)
  const stops: Stop[] = []
  let i = 0
  while (i < sorted.length) {
    const first = sorted[i]
    let j = i + 1
    while (j < sorted.length && distanceMeters(first.lat, first.lon, sorted[j].lat, sorted[j].lon) <= STAY_METERS) j++
    const last = sorted[j - 1]
    if (last.time - first.time >= STAY_MINUTES * 60e3) {
      stops.push({ lat: first.lat, lon: first.lon, date: new Date(first.time).toISOString().slice(0, 10) })
      i = j
    } else i++
  }
  return stops
}

function recordPoints(locations: unknown[]) {
  const points: { lat: number; lon: number; time: number }[] = []
  for (const l of locations) {
    if (!isObject(l)) continue
    const lat = fromE7(l.latitudeE7), lon = fromE7(l.longitudeE7)
    const time = typeof l.timestamp === 'string' ? Date.parse(l.timestamp) : Number(l.timestampMs)
    if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(time)) points.push({ lat, lon, time })
  }
  return points
}

export function parseTimeline(data: unknown): TimelineResult {
  if (isObject(data) && Array.isArray(data.semanticSegments)) {
    return { format: 'android', stops: data.semanticSegments.map(segmentStop).filter((s) => s !== null) }
  }
  if (Array.isArray(data) && data.some((s) => isObject(s) && ('visit' in s || 'activity' in s || 'timelinePath' in s))) {
    return { format: 'ios', stops: data.map(segmentStop).filter((s) => s !== null) }
  }
  if (isObject(data) && Array.isArray(data.timelineObjects)) {
    return { format: 'takeout-semantic', stops: data.timelineObjects.map(placeVisitStop).filter((s) => s !== null) }
  }
  if (isObject(data) && Array.isArray(data.locations)) {
    return { format: 'takeout-records', stops: detectStops(recordPoints(data.locations)) }
  }
  throw new Error(t('errNotTimeline'))
}
