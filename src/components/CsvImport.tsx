import { useState } from 'react'
import { geocoder } from '../data'
import { saveVisits } from '../db'
import { parseCsv, type CsvResult } from '../lib/csv'
import { planImport, type ImportPlan } from '../lib/importPlan'
import type { RefData } from '../lib/ref'
import { placeLabel } from './AddVisit'

interface Props {
  geo: RefData
  visited: Set<string>
}

type State =
  | { step: 'idle' }
  | { step: 'checking'; count: number }
  | { step: 'preview'; file: string; csv: CsvResult; plan: ImportPlan }
  | { step: 'done'; added: number }
  | { step: 'error'; message: string }

const plural = (n: number, word: string) => `${n.toLocaleString('fr-FR')} ${word}${n === 1 ? '' : 's'}`

export function CsvImport({ geo, visited }: Props) {
  const [state, setState] = useState<State>({ step: 'idle' })

  async function read(file: File | undefined) {
    if (!file) return
    try {
      const csv = parseCsv(await file.text())
      setState({ step: 'checking', count: csv.points.length })
      const plan = await planImport(csv.points, geocoder, visited)
      setState({ step: 'preview', file: file.name, csv, plan })
    } catch (e) {
      setState({ step: 'error', message: (e as Error).message })
    }
  }

  async function save(plan: ImportPlan) {
    await saveVisits(
      plan.communes.map(({ code, places }) => ({
        commune: code,
        date: null,
        source: 'csv' as const,
        note: places.filter((p) => p !== geo.commune.get(code)?.name).join(', ') || undefined,
      })),
    )
    setState({ step: 'done', added: plan.communes.length })
  }

  return (
    <section>
      <h2>Import places from a CSV file</h2>
      <p className="muted">
        A file with a header row and <code>lat</code> and <code>lon</code> columns, separated by semicolons or commas.
        Each point in mainland France marks its commune as visited (date unknown). If there is a <code>been</code>{' '}
        column, only rows marked "been" are used.
      </p>
      {state.step !== 'preview' && state.step !== 'checking' && (
        <label className="button">
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            hidden
            onChange={(e) => {
              read(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      )}
      {state.step === 'checking' && <p role="status">Checking {plural(state.count, 'place')}…</p>}
      {state.step === 'error' && <p role="status">{state.message}</p>}
      {state.step === 'done' && <p role="status">Added {plural(state.added, 'commune')} to your visits.</p>}
      {state.step === 'preview' && (
        <div className="import-preview">
          <p>
            <strong>{state.file}</strong>: {plural(state.csv.points.length, 'place')} read,{' '}
            {plural(state.plan.communes.length, 'new commune')} to add.
          </p>
          <ul className="muted">
            {state.plan.outside > 0 && <li>{plural(state.plan.outside, 'place')} outside mainland France, skipped</li>}
            {state.plan.alreadyVisited > 0 && (
              <li>{plural(state.plan.alreadyVisited, 'commune')} already in your visits, skipped</li>
            )}
            {state.csv.notBeen > 0 && <li>{plural(state.csv.notBeen, 'row')} not marked "been", skipped</li>}
            {state.csv.invalid.length > 0 && (
              <li>
                {plural(state.csv.invalid.length, 'row')} without valid coordinates (line{' '}
                {state.csv.invalid.slice(0, 5).join(', ')}
                {state.csv.invalid.length > 5 ? '…' : ''})
              </li>
            )}
          </ul>
          {state.plan.communes.length > 0 && (
            <ul className="results compact">
              {state.plan.communes.map(({ code }) => {
                const c = geo.commune.get(code)!
                return (
                  <li key={code}>
                    <strong>{c.name}</strong> <span className="muted">{placeLabel(geo, c)}</span>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="actions start">
            <button onClick={() => setState({ step: 'idle' })}>Cancel</button>
            {state.plan.communes.length > 0 && (
              <button className="primary" onClick={() => save(state.plan)}>
                Add {plural(state.plan.communes.length, 'commune')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
