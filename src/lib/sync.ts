// Merging visits between devices through one file in Google Drive.
// Visits are only ever added or deleted, never edited, so a merge is: everything either side has,
// minus everything either side deleted, keeping only the first visit to each commune (the same
// one on every device); the others become deletions so they don't come back.

import type { Tombstone, Visit } from '../db'
import { firstVisits } from './firstVisit'

export const SYNC_FORMAT = 'geofrance-sync'

export type SyncedVisit = Omit<Visit, 'id'> & { uid: string }

export interface SyncFile {
  format: typeof SYNC_FORMAT
  version: 1
  updatedAt: string
  visits: SyncedVisit[]
  deleted: Tombstone[]
}

export function mergeVisits(
  local: SyncedVisit[],
  localDeleted: Tombstone[],
  remote: SyncFile | null,
  now = new Date().toISOString(),
): { visits: SyncedVisit[]; deleted: Tombstone[] } {
  const deleted = new Map<string, Tombstone>()
  for (const t of [...(remote?.deleted ?? []), ...localDeleted]) if (!deleted.has(t.uid)) deleted.set(t.uid, t)

  const byUid = new Map<string, SyncedVisit>()
  for (const v of [...(remote?.visits ?? []), ...local]) if (!deleted.has(v.uid) && !byUid.has(v.uid)) byUid.set(v.uid, v)

  const { first, extra } = firstVisits([...byUid.values()])
  for (const v of extra) deleted.set(v.uid, { uid: v.uid, deletedAt: now })

  const visits = [...first.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || (a.uid < b.uid ? -1 : 1))
  return { visits, deleted: [...deleted.values()].sort((a, b) => (a.uid < b.uid ? -1 : 1)) }
}

// Two states with the same signature need no upload.
export const signature = (visits: { uid?: string }[], deleted: { uid: string }[]) =>
  `${visits.map((v) => v.uid).sort().join(',')}|${deleted.map((t) => t.uid).sort().join(',')}`
