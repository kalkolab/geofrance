import { useState } from 'react'
import { db, exportVisits, importVisits, type Visit } from '../db'
import type { RefData } from '../lib/ref'
import { CsvImport } from './CsvImport'
import { TimelineImport } from './TimelineImport'

interface Props {
  geo: RefData
  visited: Set<string>
  visits: Visit[]
}

export function SettingsView({ geo, visited, visits }: Props) {
  const visitCount = visits.length
  const [message, setMessage] = useState('')

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
      setMessage(`Imported ${added} visit${added === 1 ? '' : 's'}.`)
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  async function deleteAll() {
    if (confirm(`Delete all ${visitCount} visits from this device? This cannot be undone.`)) {
      await db.visits.clear()
      setMessage('All visits deleted.')
    }
  }

  return (
    <div className="page">
      <section>
        <h2>Your data</h2>
        <p className="muted">
          Your {visitCount} visits are stored only in this browser. Export them to keep a copy or move them to another
          device.
        </p>
        <div className="actions start">
          <button onClick={download}>Export visits</button>
          <label className="button">
            Import visits
            <input type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
          </label>
          <button className="danger" onClick={deleteAll} disabled={!visitCount}>
            Delete all
          </button>
        </div>
        {message && <p role="status">{message}</p>}
      </section>
      <TimelineImport visits={visits} />
      <CsvImport geo={geo} visited={visited} />
      <section>
        <h2>Coming next</h2>
        <p className="muted">Google Photos import, and Google sign-in with Drive backup to share visits between devices.</p>
      </section>
      <section>
        <h2>About</h2>
        <p className="muted">
          Mainland France including Corsica: 13 regions, 96 departments and about 34,750 communes. Codes and names from
          INSEE (COG), boundaries from IGN ADMIN EXPRESS via france-geojson, under the Licence Ouverte.
        </p>
      </section>
    </div>
  )
}
