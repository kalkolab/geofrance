import Dexie, { liveQuery, type Table } from 'dexie'
import { useEffect, useState } from 'react'
import { firstVisits, isEarlier } from './lib/firstVisit'
import { t } from './i18n'

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

export type NewVisit = Pick<Visit, 'commune' | 'date' | 'source'> & { note?: string; createdAt?: string }

// Stores visits, keeping only the first one per commune: a visit replaces the one already stored
// only when it is earlier. Returns how many were stored.
export function saveVisits(candidates: NewVisit[]): Promise<number> {
  const createdAt = new Date().toISOString()
  return db.transaction('rw', db.visits, db.deleted, async () => {
    const { first } = firstVisits(await db.visits.toArray())
    const fresh = firstVisits(candidates.map((v) => ({ ...v, note: v.note || undefined, createdAt: v.createdAt ?? createdAt })))
    const add: Visit[] = []
    const replaced: Visit[] = []
    for (const v of fresh.first.values()) {
      const current = first.get(v.commune)
      if (current && !isEarlier(v, current)) continue
      if (current) replaced.push(current)
      add.push(v)
    }
    await deleteVisits(replaced)
    await db.visits.bulkAdd(add)
    return add.length
  })
}

export const addVisit = (commune: string, date: string | null, note?: string, source: VisitSource = 'manual') =>
  saveVisits([{ commune, date, note, source }])

// Removes visits stored before only the first visit per commune was kept.
export async function keepFirstVisits() {
  const { extra } = firstVisits(await db.visits.toArray())
  if (extra.length) await deleteVisits(extra)
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

// Restores an export, keeping only the first visit to each commune.
export async function importVisits(text: string): Promise<number> {
  if (!text.trimStart().startsWith('{')) {
    throw new Error(t('errNotExportCsv', { csv: t('csvTitle') }))
  }
  const body = JSON.parse(text)
  if (body?.format !== EXPORT_FORMAT || !Array.isArray(body.visits)) throw new Error(t('errNotExport'))
  return saveVisits(
    body.visits
      .filter((v: Visit) => typeof v.commune === 'string')
      .map(({ commune, date, source, note, createdAt }: Visit) => ({ commune, date: date ?? null, source, note, createdAt })),
  )
}
