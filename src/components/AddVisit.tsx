import { useMemo, useState } from 'react'
import { addVisit } from '../db'
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
  const [date, setDate] = useState(today())
  const [dateUnknown, setDateUnknown] = useState(false)
  const [note, setNote] = useState('')
  const [kept, setKept] = useState<string>()
  const results = useMemo(() => searchCommunes(geo, query), [geo, query])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!commune) return
    if (await addVisit(commune.code, dateUnknown ? null : date, note.trim())) onDone()
    else setKept(`${commune.name} already has an earlier visit, which is kept. Only the first visit to each commune is stored.`)
  }

  return (
    <form className="panel add-visit" onSubmit={save}>
      <h2>Add a visit</h2>
      {commune ? (
        <div className="chosen">
          <span>
            <strong>{commune.name}</strong> {placeLabel(geo, commune)}
          </span>
          <button type="button" className="link" onClick={() => setCommune(undefined)}>
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            autoFocus
            type="search"
            placeholder="City name or postcode"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search a commune"
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
        <span>Date</span>
        <input type="date" value={date} max={today()} disabled={dateUnknown} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={dateUnknown} onChange={(e) => setDateUnknown(e.target.checked)} />
        Date unknown
      </label>
      <input type="text" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      {kept && <p role="status">{kept}</p>}
      <div className="actions">
        <button type="button" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={!commune || (!dateUnknown && !date)}>
          Save visit
        </button>
      </div>
    </form>
  )
}

export function placeLabel(geo: RefData, c: Commune) {
  const dep = geo.departement.get(c.departement)
  return `${dep?.name ?? ''} (${c.departement})${c.postcodes[0] ? ' · ' + c.postcodes[0] : ''}`
}
