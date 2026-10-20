import { useMemo, useState } from 'react'
import { addVisit } from '../db'
import { useT } from '../i18n'
import { searchCommunes, type Commune, type RefData } from '../lib/ref'

interface Props {
  geo: RefData
  initial?: Commune
  onDone(): void
}

const today = () => new Date().toISOString().slice(0, 10)

export function AddVisit({ geo, initial, onDone }: Props) {
  const [query, setQuery] = useState('')
  const [commune, setCommune] = useState<Commune | undefined>(initial)
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [kept, setKept] = useState<string>()
  const results = useMemo(() => searchCommunes(geo, query), [geo, query])
  const t = useT()

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!commune) return
    if (await addVisit(commune.code, date || null, note.trim())) onDone()
    else setKept(t('alreadyEarlier', { name: commune.name }))
  }

  return (
    <form className="panel add-visit" onSubmit={save}>
      <h2>{t('addAVisit')}</h2>
      {commune ? (
        <div className="chosen">
          <span>
            <strong>{commune.name}</strong> {placeLabel(geo, commune)}
          </span>
          <button type="button" className="link" onClick={() => setCommune(undefined)}>
            {t('change')}
          </button>
        </div>
      ) : (
        <>
          <input
            autoFocus
            type="search"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('searchLabel')}
          />
          {results.length > 0 && (
            <ul className="results">
              {results.map((c) => (
                <li key={c.code}>
                  <button type="button" onClick={() => setCommune(c)}>
                    <strong>{c.name}</strong> <span className="muted">{placeLabel(geo, c)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <label className="row">
        <span>{t('dateOptional')}</span>
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        {date && (
          <button type="button" className="link" onClick={() => setDate('')}>
            {t('clear')}
          </button>
        )}
      </label>
      <input type="text" placeholder={t('noteOptional')} value={note} onChange={(e) => setNote(e.target.value)} />
      {kept && <p role="status">{kept}</p>}
      <div className="actions">
        <button type="button" onClick={onDone}>
          {t('cancel')}
        </button>
        <button type="submit" className="primary" disabled={!commune}>
          {t('saveVisit')}
        </button>
      </div>
    </form>
  )
}

export function placeLabel(geo: RefData, c: Commune) {
  const dep = geo.departement.get(c.departement)
  return `${dep?.name ?? ''} (${c.departement})${c.postcodes[0] ? ' · ' + c.postcodes[0] : ''}`
}
