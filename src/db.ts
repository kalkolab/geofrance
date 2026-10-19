import Dexie, { liveQuery, type Table } from 'dexie'
import { useEffect, useState } from 'react'

export type VisitSource = 'manual' | 'csv' | 'timeline' | 'photo'

export interface Visit {
  id?: number
  commune: string // INSEE code
  date: string | null // YYYY-MM-DD, null when unknown
  source: VisitSource
  note?: string
  createdAt: string
}

class GeoFranceDB extends Dexie {
  visits!: Table<Visit, number>

  constructor() {
    super('geofrance')
    this.version(1).stores({ visits: '++id, commune, date, source' })
  }
}

export const db = new GeoFranceDB()

export function useVisits(): Visit[] | undefined {
  const [visits, setVisits] = useState<Visit[]>()
  useEffect(() => {
    const sub = liveQuery(() => db.visits.toArray()).subscribe({ next: setVisits, error: console.error })
    return () => sub.unsubscribe()
  }, [])
  return visits
}

export function addVisit(commune: string, date: string | null, note?: string, source: VisitSource = 'manual') {
  return db.visits.add({ commune, date, source, note: note || undefined, createdAt: new Date().toISOString() })
}

export const EXPORT_FORMAT = 'geofrance-visits'

export async function exportVisits(): Promise<Blob> {
  const visits = await db.visits.toArray()
  const body = { format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), visits }
  return new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' })
}

// Restores an export, skipping visits that are already stored.
export async function importVisits(text: string): Promise<number> {
  const body = JSON.parse(text)
  if (body?.format !== EXPORT_FORMAT || !Array.isArray(body.visits)) throw new Error('Not a GeoFrance export file')
  const existing = new Set((await db.visits.toArray()).map(visitKey))
  const fresh: Visit[] = body.visits
    .filter((v: Visit) => typeof v.commune === 'string' && !existing.has(visitKey(v)))
    .map(({ id: _id, ...v }: Visit) => v)
  await db.visits.bulkAdd(fresh)
  return fresh.length
}

const visitKey = (v: Visit) => `${v.commune}|${v.date ?? ''}|${v.source}`
