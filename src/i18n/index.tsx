// The app's languages. Place names stay in French; everything else follows the chosen language.

import { Fragment, useSyncExternalStore, type ReactNode } from 'react'
import { en, type Messages, type Plural } from './en'
import { fr } from './fr'
import { ru } from './ru'
import { uk } from './uk'

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'uk', name: 'Українська' },
  { code: 'ru', name: 'Русский' },
] as const

export type Lang = (typeof LANGUAGES)[number]['code']
export type MessageKey = keyof Messages
type Params = Record<string, string | number>

const MESSAGES: Record<Lang, Messages> = { en, fr, uk, ru }
const STORAGE_KEY = 'geofrance.language'
const isLang = (code: unknown): code is Lang => LANGUAGES.some((l) => l.code === code)

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLang(saved)) return saved
  } catch {
    // private browsing: fall back to the browser's languages
  }
  for (const tag of typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]) {
    const code = tag.slice(0, 2).toLowerCase()
    if (isLang(code)) return code
  }
  return 'en'
}

let lang: Lang = initialLang()
const listeners = new Set<() => void>()
if (typeof document !== 'undefined') document.documentElement.lang = lang

export const getLang = () => lang

export function setLang(next: Lang) {
  lang = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // not remembered, but still applied
  }
  if (typeof document !== 'undefined') document.documentElement.lang = next
  listeners.forEach((l) => l())
}

export const formatNumber = (n: number) => n.toLocaleString(lang)

export const formatDate = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })

// Translates a message in the current language. Plural messages take their form from `count`.
export function t(key: MessageKey, params: Params = {}): string {
  const message: string | Plural = MESSAGES[lang][key] ?? en[key]
  let text: string
  if (typeof message === 'string') text = message
  else {
    const count = Number(params.count ?? 0)
    const form = new Intl.PluralRules(lang).select(count) as keyof Plural
    text = message[form] ?? message.other
  }
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    if (value === undefined) return match
    return typeof value === 'number' ? formatNumber(value) : value
  })
}

// Re-renders the calling component when the language changes, and returns `t`.
export function useT() {
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getLang,
  )
  return t
}

// Renders **bold** and `code` inside a translated message.
export function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) =>
    part.startsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : part.startsWith('`') ? (
      <code key={i}>{part.slice(1, -1)}</code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}
