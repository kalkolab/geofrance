// Google sign-in (Google Identity Services, browser-only token flow) and the Drive app data folder.
// The app only asks for drive.appdata: a hidden folder for this app, which cannot see your other files.

import type { SyncFile } from './lib/sync'
import { t } from './i18n'

export const CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid email'
const FILE_NAME = 'geofrance-visits.json'

interface TokenResponse {
  access_token: string
  expires_in: string | number
  error?: string
  error_description?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            login_hint?: string
            callback: (r: TokenResponse) => void
            error_callback?: (e: { type: string; message?: string }) => void
          }): { requestAccessToken(options?: { prompt?: string }): void }
          revoke(token: string, done?: () => void): void
        }
      }
    }
  }
}

export class AuthError extends Error {}

export interface Token {
  value: string
  expiresAt: number
}

// The sign-in popup must open straight from a tap, so the script is loaded ahead of time.
let gis: Promise<void> | undefined
export function loadGoogle(): Promise<void> {
  gis ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      gis = undefined
      reject(new Error(t('errGoogleLoad')))
    }
    document.head.appendChild(script)
  })
  return gis
}

// Call from a click handler. Without a prompt, Google only asks again when it needs to.
export function requestToken(loginHint?: string): Promise<Token> {
  const oauth2 = window.google?.accounts.oauth2
  if (!CLIENT_ID) return Promise.reject(new Error(t('errGoogleNotConfigured')))
  if (!oauth2) return Promise.reject(new Error(t('errGoogleLoading')))
  return new Promise((resolve, reject) => {
    oauth2
      .initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        login_hint: loginHint,
        callback: (r) =>
          r.error
            ? reject(new Error(r.error_description || r.error))
            : resolve({ value: r.access_token, expiresAt: Date.now() + (Number(r.expires_in) - 60) * 1000 }),
        error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? t('errSignInCancelled') : e.message || e.type)),
      })
      .requestAccessToken({ prompt: loginHint ? '' : 'select_account' })
  })
}

export function revokeToken(token: Token) {
  window.google?.accounts.oauth2.revoke(token.value)
}

async function call(token: Token, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token.value}` } })
  if (res.status === 401 || res.status === 403) throw new AuthError(t('errSignInExpired'))
  if (!res.ok) throw new Error(t('errDrive', { status: String(res.status) }))
  return res
}

export async function userEmail(token: Token): Promise<string> {
  const info = await (await call(token, 'https://openidconnect.googleapis.com/v1/userinfo')).json()
  return info.email
}

export async function readSyncFile(token: Token): Promise<{ id: string; data: SyncFile } | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}'`)
  const list = await (
    await call(token, `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)&orderBy=modifiedTime desc`)
  ).json()
  const id: string | undefined = list.files?.[0]?.id
  if (!id) return null
  const data = await (await call(token, `https://www.googleapis.com/drive/v3/files/${id}?alt=media`)).json()
  return { id, data }
}

export async function writeSyncFile(token: Token, id: string | null, data: SyncFile): Promise<string> {
  const body = JSON.stringify(data)
  if (id) {
    await call(token, `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    return id
  }
  const boundary = 'geofrance' + Math.random().toString(36).slice(2)
  const metadata = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' })
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`
  const res = await call(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  })
  return (await res.json()).id
}
