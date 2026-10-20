import type { Visit } from '../db'
import { firstVisits } from './firstVisit'
import type { Stop } from './timeline'

export interface VisitPlan {
  visits: { commune: string; date: string | null }[] // the first stop in each commune, when it is new or earlier than what is stored
  newCommunes: number // communes that have no visit at all yet
  earlier: number // communes already visited, where the file has an earlier first visit
  stops: number
  outside: number // stops outside mainland France
  duplicates: number // stops that add nothing: not the first in their commune
  firstDate: string | null
  lastDate: string | null
}

// Combines stops with the communes they fall in (same order, null when outside France).
// Only the first visit to each commune is kept.
export function planVisits(stops: Stop[], communes: (string | null)[], existing: Visit[]): VisitPlan {
  const stored = firstVisits(existing).first
  const firstStop = new Map<string, string | null>()
  let outside = 0
  let firstDate: string | null = null, lastDate: string | null = null
  stops.forEach((stop, i) => {
    const commune = communes[i]
    if (!commune) {
      outside++
      return
    }
    const date = firstStop.get(commune)
    if (!firstStop.has(commune) || (stop.date && (date === null || stop.date < date!))) firstStop.set(commune, stop.date)
    if (stop.date && (!firstDate || stop.date < firstDate)) firstDate = stop.date
    if (stop.date && (!lastDate || stop.date > lastDate)) lastDate = stop.date
  })
  const visits: VisitPlan['visits'] = []
  let newCommunes = 0, earlier = 0
  for (const [commune, date] of firstStop) {
    const current = stored.get(commune)
    if (!current) newCommunes++
    else if (date && (current.date === null || date < current.date)) earlier++
    else continue
    visits.push({ commune, date })
  }
  return { visits, newCommunes, earlier, stops: stops.length, outside, duplicates: stops.length - outside - visits.length, firstDate, lastDate }
}
