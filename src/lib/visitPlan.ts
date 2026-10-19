import type { Visit } from '../db'
import type { Stop } from './timeline'

export interface VisitPlan {
  visits: { commune: string; date: string | null }[] // one per commune and day, not stored yet
  newCommunes: number // communes that have no visit at all yet
  stops: number
  outside: number // stops outside mainland France
  duplicates: number // commune and day already recorded
  firstDate: string | null
  lastDate: string | null
}

// Combines stops with the communes they fall in (same order, null when outside France).
export function planVisits(stops: Stop[], communes: (string | null)[], existing: Visit[]): VisitPlan {
  const known = new Set(existing.map((v) => `${v.commune}|${v.date ?? ''}`))
  const visitedCommunes = new Set(existing.map((v) => v.commune))
  const visits: VisitPlan['visits'] = []
  const fresh = new Set<string>()
  let outside = 0, duplicates = 0
  let firstDate: string | null = null, lastDate: string | null = null
  stops.forEach((stop, i) => {
    const commune = communes[i]
    if (!commune) {
      outside++
      return
    }
    const key = `${commune}|${stop.date ?? ''}`
    if (known.has(key)) {
      duplicates++
      return
    }
    known.add(key)
    visits.push({ commune, date: stop.date })
    if (!visitedCommunes.has(commune)) fresh.add(commune)
    if (stop.date && (!firstDate || stop.date < firstDate)) firstDate = stop.date
    if (stop.date && (!lastDate || stop.date > lastDate)) lastDate = stop.date
  })
  return { visits, newCommunes: fresh.size, stops: stops.length, outside, duplicates, firstDate, lastDate }
}
