import { useState } from 'react'
import { deleteVisits, exportVisits, importVisits, type Visit } from '../db'
import { LANGUAGES, getLang, setLang, useT, type Lang } from '../i18n'
import type { RefData } from '../lib/ref'
import { CsvImport } from './CsvImport'
import { AccountSection } from './SyncButton'
import { TimelineImport } from './TimelineImport'

interface Props {
  geo: RefData
  visited: Set<string>
  visits: Visit[]
}

export function SettingsView({ geo, visited, visits }: Props) {
  const visitCount = visits.length
  const [message, setMessage] = useState('')
  const t = useT()

  async function download() {
    const url = URL.createObjectURL(await exportVisits())
    const a = document.createElement('a')
    a.href = url
    a.download = `geofrance-visits-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function restore(file: File | undefined) {
    if (!file) return
    try {
      const added = await importVisits(await file.text())
      setMessage(t('imported', { count: added }))
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  async function deleteAll() {
    if (confirm(t('confirmDeleteAll', { count: visitCount }))) {
      await deleteVisits(visits)
      setMessage(t('allDeleted'))
    }
  }

  return (
    <div className="page">
      <section>
        <h2>{t('language')}</h2>
        <div className="languages" role="group" aria-label={t('language')}>
          {LANGUAGES.map((l) => (
            <button key={l.code} lang={l.code} className={getLang() === l.code ? 'active' : ''} onClick={() => setLang(l.code as Lang)}>
              {l.name}
            </button>
          ))}
        </div>
      </section>
      <AccountSection />
      <section>
        <h2>{t('yourData')}</h2>
        <p className="muted">{t('yourDataHelp', { count: visitCount })}</p>
        <div className="actions start">
          <button onClick={download}>{t('exportVisits')}</button>
          <label className="button">
            {t('importVisits')}
            <input type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
          </label>
          <button className="danger" onClick={deleteAll} disabled={!visitCount}>
            {t('deleteAll')}
          </button>
        </div>
        {message && <p role="status">{message}</p>}
      </section>
      <TimelineImport visits={visits} />
      <CsvImport geo={geo} visited={visited} />
      <section>
        <h2>{t('comingNext')}</h2>
        <p className="muted">{t('comingNextBody')}</p>
      </section>
      <section>
        <h2>{t('about')}</h2>
        <p className="muted">{t('aboutBody')}</p>
      </section>
    </div>
  )
}
