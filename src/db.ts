import Dexie, { liveQuery, type Table } from 'dexie'
import { useEffect, useState } from 'react'

export type VisitSource = 'manual' | 'csv' | 'timeline' | 'photo'

export interface Visit {
  id?: number
  uid?: string // stable id shared across devices, set automatically when a visit is created
  commune: string // INSEE code
  date: string | null // YYYY-MM-DD, null when unknown
  source: VisitSource
  note?: string
  createdAt: string
}

// A deleted visit, remembered so the deletion also reaches your other devices.
export interface Tombstone {
  uid: string
  deletedAt: string
}

class GeoFranceDB extends Dexie {
  visits!: Table<Visit, number>
  deleted!: Table<Tombstone, string>

  constructor() {
    super('geofrance')
    this.version(1).stores({ visits: '++id, commune, date, source' })
    this.version(2)
      .stores({ visits: '++id, uid, commune, date, source', deleted: 'uid' })
      .upgrade((tx) =>
        tx
          .table('visits')
          .toCollection()
          .modify((v: Visit) => {
            v.uid ??= crypto.randomUUID()
          }),
      )
    this.visits.hook('creating', (_key, visit) => {
      visit.uid ??= crypto.randomUUID()
    })
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

export function deleteVisits(visits: Visit[]) {
  const deletedAt = new Date().toISOString()
  return db.transaction('rw', db.visits, db.deleted, async () => {
    await db.deleted.bulkPut(visits.filter((v) => v.uid).map((v) => ({ uid: v.uid!, deletedAt })))
    await db.visits.bulkDelete(visits.map((v) => v.id!))
  })
}

export const EXPORT_FORMAT = 'geofrance-visits'

export async function exportVisits(): Promise<Blob> {
  const visits = await db.visits.toArray()
  const body = { format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), visits }
  return new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' })
}

// Restores an export, skipping visits that are already stored.
export async function importVisits(text: string): Promise<number> {
  if (!text.trimStart().startsWith('{')) {
    throw new Error('This is not a GeoFrance export file. For a CSV of places, use "Import places from a CSV file" below.')
  }
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
