import { describe, expect, it } from 'vitest'
import { mergeVisits, signature, SYNC_FORMAT, type SyncedVisit, type SyncFile } from '../src/lib/sync'

const visit = (uid: string, commune: string, date: string | null = null, source: SyncedVisit['source'] = 'manual'): SyncedVisit => ({
  uid,
  commune,
  date,
  source,
  createdAt: `2024-01-01T00:00:0${uid.length}Z`,
})
const file = (visits: SyncedVisit[], deleted: SyncFile['deleted'] = []): SyncFile => ({ format: SYNC_FORMAT, version: 1, updatedAt: '', visits, deleted })
const uids = (r: { visits: SyncedVisit[] }) => r.visits.map((v) => v.uid).sort()

describe('mergeVisits', () => {
  it('starts the Drive file from this device when there is none', () => {
    const r = mergeVisits([visit('a', '75056')], [], null)
    expect(uids(r)).toEqual(['a'])
    expect(r.deleted).toEqual([])
  })

  it('combines visits added on phone and desktop', () => {
    const r = mergeVisits([visit('a', '75056')], [], file([visit('b', '69123')]))
    expect(uids(r)).toEqual(['a', 'b'])
  })

  it('applies deletions made on either device', () => {
    const tomb = { uid: 'b', deletedAt: '2024-02-01T00:00:00Z' }
    expect(uids(mergeVisits([visit('a', '75056'), visit('b', '69123')], [], file([visit('a', '75056')], [tomb])))).toEqual(['a'])
    expect(uids(mergeVisits([visit('a', '75056')], [tomb], file([visit('a', '75056'), visit('b', '69123')])))).toEqual(['a'])
  })

  it('collapses the same import made on two devices to one copy, the same on both', () => {
    const phone = mergeVisits([visit('x2', '13055', '2024-05-01', 'timeline')], [], file([visit('x1', '13055', '2024-05-01', 'timeline')]), 'now')
    expect(uids(phone)).toEqual(['x1'])
    expect(phone.deleted).toEqual([{ uid: 'x2', deletedAt: 'now' }])
    // The desktop still has x2 locally; after syncing with the phone's file it drops it too.
    const desktop = mergeVisits([visit('x2', '13055', '2024-05-01', 'timeline')], [], file(phone.visits, phone.deleted))
    expect(uids(desktop)).toEqual(['x1'])
  })

  it('keeps separate visits to the same commune on different days', () => {
    const r = mergeVisits([visit('a', '75056', '2024-01-01'), visit('b', '75056', '2024-01-02')], [], null)
    expect(uids(r)).toEqual(['a', 'b'])
  })

  it('gives the same signature regardless of order', () => {
    expect(signature([{ uid: 'b' }, { uid: 'a' }], [{ uid: 'z' }])).toBe(signature([{ uid: 'a' }, { uid: 'b' }], [{ uid: 'z' }]))
  })
})
