import { useState } from 'react'
import { geocoder } from '../data'
import { saveVisits } from '../db'
import { rich, useT } from '../i18n'
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

export function CsvImport({ geo, visited }: Props) {
  const [state, setState] = useState<State>({ step: 'idle' })
  const t = useT()
  const places = (count: number) => t('placesCount', { count })
  const communes = (count: number) => t('communesCount', { count })
  const rows = (count: number) => t('rowsCount', { count })

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
      <h2>{t('csvTitle')}</h2>
      <p className="muted">{rich(t('csvHelp'))}</p>
      {state.step !== 'preview' && state.step !== 'checking' && (
        <label className="button">
          {t('csvChoose')}
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
      {state.step === 'checking' && <p role="status">{t('csvChecking', { places: places(state.count) })}</p>}
      {state.step === 'error' && <p role="status">{state.message}</p>}
      {state.step === 'done' && <p role="status">{t('csvAdded', { communes: t('newCommunesCount', { count: state.added }) })}</p>}
      {state.step === 'preview' && (
        <div className="import-preview">
          <p>
            {rich(
              t('csvRead', {
                file: state.file,
                places: places(state.csv.points.length),
                communes: t('newCommunesCount', { count: state.plan.communes.length }),
              }),
            )}
          </p>
          <ul className="muted">
            {state.plan.outside > 0 && <li>{t('csvOutside', { places: places(state.plan.outside) })}</li>}
            {state.plan.alreadyVisited > 0 && (
              <li>{t('csvAlready', { communes: communes(state.plan.alreadyVisited) })}</li>
            )}
            {state.csv.notBeen > 0 && <li>{t('csvNotBeen', { rows: rows(state.csv.notBeen) })}</li>}
            {state.csv.invalid.length > 0 && (
              <li>
                {t('csvInvalid', {
                  rows: rows(state.csv.invalid.length),
                  lines: state.csv.invalid.slice(0, 5).join(', ') + (state.csv.invalid.length > 5 ? '…' : ''),
                })}
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
            <button onClick={() => setState({ step: 'idle' })}>{t('cancel')}</button>
            {state.plan.communes.length > 0 && (
              <button className="primary" onClick={() => save(state.plan)}>
                {t('addCommunes', { count: state.plan.communes.length })}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
