// Keeps this device's visits in step with the copy in your Google Drive.
// Browsers only hand out a Google token for about an hour and only after a tap, so after opening the
// app you tap "Sync" once; while the token lasts, changes sync by themselves.

import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { db } from './db'
import { AuthError, CLIENT_ID, loadGoogle, readSyncFile, requestToken, revokeToken, userEmail, writeSyncFile, type Token } from './google'
import { mergeVisits, signature, SYNC_FORMAT, type SyncedVisit } from './lib/sync'
import { t } from './i18n'

export type SyncStatus = 'unconfigured' | 'signed-out' | 'needs-tap' | 'syncing' | 'synced' | 'error'

export interface SyncState {
  status: SyncStatus
  email?: string
  lastSync?: string
  error?: string
}

const ACCOUNT_KEY = 'geofrance.googleAccount'
const AUTO_SYNC_DELAY = 2000

function storedAccount(): string | undefined {
  try {
    return localStorage.getItem(ACCOUNT_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function storeAccount(email: string | null) {
  try {
    if (email) localStorage.setItem(ACCOUNT_KEY, email)
    else localStorage.removeItem(ACCOUNT_KEY)
  } catch {
    // private browsing: the account is simply not remembered
  }
}

class SyncManager {
  private state: SyncState
  private listeners = new Set<() => void>()
  private token?: Token
  private fileId: string | null = null
  private syncedSignature?: string
  private localSignature?: string
  private running?: Promise<void>
  private again = false
  private timer?: ReturnType<typeof setTimeout>

  constructor() {
    const email = storedAccount()
    this.state = { status: !CLIENT_ID ? 'unconfigured' : email ? 'needs-tap' : 'signed-out', email }
    if (!CLIENT_ID || typeof window === 'undefined') return
    loadGoogle().catch(() => {})
    liveQuery(async () => signature(await db.visits.toArray(), await db.deleted.toArray())).subscribe({
      next: (sig) => {
        this.localSignature = sig
        this.scheduleAutoSync()
      },
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.hasToken()) this.sync()
    })
  }

  getState = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  private hasToken() {
    return !!this.token && this.token.expiresAt > Date.now()
  }

  private scheduleAutoSync() {
    if (!this.hasToken() || this.localSignature === this.syncedSignature) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.sync(), AUTO_SYNC_DELAY)
  }

  // Call from a tap: signs in if needed, then syncs.
  syncNow = () => {
    if (this.hasToken()) return this.sync()
    return requestToken(this.state.email)
      .then(async (token) => {
        this.token = token
        const email = await userEmail(token)
        storeAccount(email)
        this.set({ email })
        await this.sync()
      })
      .catch((e: Error) => this.set({ status: this.state.email ? 'needs-tap' : 'signed-out', error: e.message }))
  }

  signOut = () => {
    if (this.token) revokeToken(this.token)
    this.token = undefined
    this.fileId = null
    storeAccount(null)
    this.set({ status: 'signed-out', email: undefined, lastSync: undefined, error: undefined })
  }

  sync(): Promise<void> {
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = this.run().finally(() => {
      this.running = undefined
      if (this.again) {
        this.again = false
        this.sync()
      }
    })
    return this.running
  }

  private async run() {
    const token = this.token
    if (!token) return
    this.set({ status: 'syncing', error: undefined })
    try {
      const remote = await readSyncFile(token)
      if (remote && remote.data.format !== SYNC_FORMAT) throw new Error(t('errSyncFile'))
      this.fileId = remote?.id ?? this.fileId

      const [localVisits, localDeleted] = await Promise.all([db.visits.toArray(), db.deleted.toArray()])
      const local = localVisits.map(({ id: _id, ...v }) => v as SyncedVisit)
      const merged = mergeVisits(local, localDeleted, remote?.data ?? null)
      const mergedSignature = signature(merged.visits, merged.deleted)

      this.syncedSignature = mergedSignature // so the local writes below do not trigger another sync

      // Bring this device in line with the merged state.
      const keep = new Set(merged.visits.map((v) => v.uid))
      const have = new Set(local.map((v) => v.uid))
      await db.transaction('rw', db.visits, db.deleted, async () => {
        await db.visits.bulkDelete(localVisits.filter((v) => !keep.has(v.uid!)).map((v) => v.id!))
        await db.visits.bulkAdd(merged.visits.filter((v) => !have.has(v.uid)))
        await db.deleted.bulkPut(merged.deleted)
      })

      const remoteSignature = remote ? signature(remote.data.visits, remote.data.deleted) : undefined
      if (mergedSignature !== remoteSignature) {
        this.fileId = await writeSyncFile(token, this.fileId, {
          format: SYNC_FORMAT,
          version: 1,
          updatedAt: new Date().toISOString(),
          ...merged,
        })
      }
      this.set({ status: 'synced', lastSync: new Date().toISOString() })
    } catch (e) {
      this.syncedSignature = undefined
      if (e instanceof AuthError) {
        this.token = undefined
        this.set({ status: 'needs-tap', error: undefined })
      } else this.set({ status: 'error', error: (e as Error).message })
    }
  }
}

export const sync = new SyncManager()

export const useSync = () => useSyncExternalStore(sync.subscribe, sync.getState)
