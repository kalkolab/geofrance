import { useState } from 'react'
import { db, type Visit } from '../db'
import type { GeocodeMessage, GeocodeRequest } from '../geocode.worker'
import type { Stop } from '../lib/timeline'
import { readTimelineFiles } from '../lib/timelineFiles'
import { planVisits, type VisitPlan } from '../lib/visitPlan'
import { formatDate } from './PlacePanel'

type State =
  | { step: 'idle' }
  | { step: 'reading' }
  | { step: 'checking'; done: number; total: number }
  | { step: 'preview'; plan: VisitPlan }
  | { step: 'done'; added: number; communes: number }
  | { step: 'error'; message: string }

const n = (count: number, word: string) => `${count.toLocaleString('fr-FR')} ${word}${count === 1 ? '' : 's'}`

function geocodeInWorker(stops: Stop[], onProgress: (done: number) => void): Promise<(string | null)[]> {
  const worker = new Worker(new URL('../geocode.worker.ts', import.meta.url), { type: 'module' })
  return new Promise<(string | null)[]>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<GeocodeMessage>) => {
      if (e.data.kind === 'progress') onProgress(e.data.done)
      else if (e.data.kind === 'done') resolve(e.data.communes)
      else reject(new Error(e.data.message))
    }
    worker.onerror = (e) => reject(new Error(e.message || 'Could not check the places'))
    worker.postMessage({ points: stops.map((s) => [s.lon, s.lat]) } satisfies GeocodeRequest)
  }).finally(() => worker.terminate())
}

export function TimelineImport({ visits }: { visits: Visit[] }) {
  const [state, setState] = useState<State>({ step: 'idle' })

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
    const createdAt = new Date().toISOString()
    await db.visits.bulkAdd(plan.visits.map((v) => ({ ...v, source: 'timeline' as const, createdAt })))
    setState({ step: 'done', added: plan.visits.length, communes: plan.newCommunes })
  }

  const busy = state.step === 'reading' || state.step === 'checking' || state.step === 'preview'

  return (
    <section>
      <h2>Import Google Maps Timeline</h2>
      <p className="muted">
        On your Android phone, open the Settings app, then Location, Location services, Timeline, and{' '}
        <strong>Export Timeline data</strong>. On some phones it is instead in Google Maps: your profile picture, Your
        Timeline, the ⋮ menu, Location and privacy settings. On an iPhone, it is in Google Maps under Settings, Personal
        content, <strong>Export Timeline data</strong>. Choose the saved file here. Older Google Takeout Location
        History exports (.zip, or the .json files inside) work too. Only places where you stopped are counted, one visit
        per commune and day.
      </p>
      {!busy && (
        <label className="button">
          Choose Timeline file
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
      {state.step === 'reading' && <p role="status">Reading your Timeline…</p>}
      {state.step === 'checking' && (
        <div role="status">
          <p>
            Checking {n(state.total, 'stop')}… {state.done.toLocaleString('fr-FR')} done
          </p>
          <div className="bar">
            <div style={{ width: `${state.total ? (100 * state.done) / state.total : 0}%` }} />
          </div>
        </div>
      )}
      {state.step === 'error' && <p role="status">{state.message}</p>}
      {state.step === 'done' && (
        <p role="status">
          Added {n(state.added, 'visit')}, including {n(state.communes, 'new commune')}.
        </p>
      )}
      {state.step === 'preview' && (
        <div className="import-preview">
          <p>
            {n(state.plan.stops, 'stop')} found
            {state.plan.firstDate && state.plan.lastDate
              ? ` from ${formatDate(state.plan.firstDate)} to ${formatDate(state.plan.lastDate)}`
              : ''}
            . {n(state.plan.visits.length, 'visit')} to add, covering {n(state.plan.newCommunes, 'commune')} you had not
            recorded yet.
          </p>
          <ul className="muted">
            {state.plan.outside > 0 && <li>{n(state.plan.outside, 'stop')} outside mainland France, skipped</li>}
            {state.plan.duplicates > 0 && <li>{n(state.plan.duplicates, 'stop')} already recorded, skipped</li>}
          </ul>
          <div className="actions start">
            <button onClick={() => setState({ step: 'idle' })}>Cancel</button>
            {state.plan.visits.length > 0 && (
              <button className="primary" onClick={() => save(state.plan)}>
                Add {n(state.plan.visits.length, 'visit')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
