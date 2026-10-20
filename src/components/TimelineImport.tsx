import { useState } from 'react'
import { saveVisits, type Visit } from '../db'
import type { GeocodeMessage, GeocodeRequest } from '../geocode.worker'
import type { Stop } from '../lib/timeline'
import { readTimelineFiles } from '../lib/timelineFiles'
import { planVisits, type VisitPlan } from '../lib/visitPlan'
import { formatDate, formatNumber, rich, t as translate, useT } from '../i18n'

type State =
  | { step: 'idle' }
  | { step: 'reading' }
  | { step: 'checking'; done: number; total: number }
  | { step: 'preview'; plan: VisitPlan }
  | { step: 'done'; communes: number; earlier: number }
  | { step: 'error'; message: string }

function geocodeInWorker(stops: Stop[], onProgress: (done: number) => void): Promise<(string | null)[]> {
  const worker = new Worker(new URL('../geocode.worker.ts', import.meta.url), { type: 'module' })
  return new Promise<(string | null)[]>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<GeocodeMessage>) => {
      if (e.data.kind === 'progress') onProgress(e.data.done)
      else if (e.data.kind === 'done') resolve(e.data.communes)
      else reject(new Error(e.data.message))
    }
    worker.onerror = (e) => reject(new Error(e.message || translate('errCheckPlaces')))
    worker.postMessage({ points: stops.map((s) => [s.lon, s.lat]) } satisfies GeocodeRequest)
  }).finally(() => worker.terminate())
}

export function TimelineImport({ visits }: { visits: Visit[] }) {
  const [state, setState] = useState<State>({ step: 'idle' })
  const t = useT()
  const communes = (count: number) => t('communesCount', { count })
  const newCommunes = (count: number) => t('newCommunesCount', { count })
  const stops = (count: number) => t('stopsCount', { count })

  async function read(files: File[]) {
    if (!files.length) return
    try {
      setState({ step: 'reading' })
      const { stops } = await readTimelineFiles(files)
      setState({ step: 'checking', done: 0, total: stops.length })
      const communes = await geocodeInWorker(stops, (done) => setState({ step: 'checking', done, total: stops.length }))
      setState({ step: 'preview', plan: planVisits(stops, communes, visits) })
    } catch (e) {
      setState({ step: 'error', message: (e as Error).message })
    }
  }

  async function save(plan: VisitPlan) {
    await saveVisits(plan.visits.map((v) => ({ ...v, source: 'timeline' as const })))
    setState({ step: 'done', communes: plan.newCommunes, earlier: plan.earlier })
  }

  const busy = state.step === 'reading' || state.step === 'checking' || state.step === 'preview'

  return (
    <section>
      <h2>{t('timelineTitle')}</h2>
      <p className="muted">{rich(t('timelineHelp'))}</p>
      {!busy && (
        <label className="button">
          {t('timelineChoose')}
          <input
            type="file"
            accept=".json,.zip,application/json,application/zip"
            multiple
            hidden
            onChange={(e) => {
              read([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
        </label>
      )}
      {state.step === 'reading' && <p role="status">{t('timelineReading')}</p>}
      {state.step === 'checking' && (
        <div role="status">
          <p>
            {t('timelineChecking', { stops: stops(state.total), done: formatNumber(state.done) })}
          </p>
          <div className="bar">
            <div style={{ width: `${state.total ? (100 * state.done) / state.total : 0}%` }} />
          </div>
        </div>
      )}
      {state.step === 'error' && <p role="status">{state.message}</p>}
      {state.step === 'done' && (
        <p role="status">
          {state.earlier > 0
            ? t('timelineAddedEarlier', { communes: newCommunes(state.communes), earlier: communes(state.earlier) })
            : t('timelineAdded', { communes: newCommunes(state.communes) })}
        </p>
      )}
      {state.step === 'preview' && (
        <div className="import-preview">
          <p>
            {state.plan.firstDate && state.plan.lastDate
              ? t('timelineFoundRange', {
                  stops: stops(state.plan.stops),
                  from: formatDate(state.plan.firstDate),
                  to: formatDate(state.plan.lastDate),
                })
              : t('timelineFound', { stops: stops(state.plan.stops) })}{' '}
            {state.plan.earlier > 0
              ? t('timelineToAddEarlier', { communes: newCommunes(state.plan.newCommunes), earlier: communes(state.plan.earlier) })
              : t('timelineToAdd', { communes: newCommunes(state.plan.newCommunes) })}{' '}
            {t('timelineOnlyFirst')}
          </p>
          <ul className="muted">
            {state.plan.outside > 0 && <li>{t('timelineOutside', { stops: stops(state.plan.outside) })}</li>}
            {state.plan.duplicates > 0 && <li>{t('timelineDuplicates', { stops: stops(state.plan.duplicates) })}</li>}
          </ul>
          <div className="actions start">
            <button onClick={() => setState({ step: 'idle' })}>{t('cancel')}</button>
            {state.plan.visits.length > 0 && (
              <button className="primary" onClick={() => save(state.plan)}>
                {t('addCommunes', { count: state.plan.visits.length })}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
