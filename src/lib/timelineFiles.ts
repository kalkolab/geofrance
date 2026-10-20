import { strFromU8, unzip } from 'fflate'
import { parseTimeline, type Stop, type TimelineFormat } from './timeline'
import { t } from '../i18n'

export interface TimelineFiles {
  stops: Stop[]
  formats: Set<TimelineFormat>
  files: number // Timeline files found and read
}

const unzipJson = (data: Uint8Array) =>
  new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(data, { filter: (f) => f.name.toLowerCase().endsWith('.json') }, (err, out) => (err ? reject(err) : resolve(out))),
  )

// Reads Timeline .json files and Google Takeout .zip archives; other JSON files in an archive are ignored.
export async function readTimelineFiles(files: File[]): Promise<TimelineFiles> {
  const result: TimelineFiles = { stops: [], formats: new Set(), files: 0 }
  const add = (text: string, strict: boolean) => {
    let parsed
    try {
      parsed = parseTimeline(JSON.parse(text))
    } catch (e) {
      if (strict) throw e
      return
    }
    result.stops.push(...parsed.stops)
    result.formats.add(parsed.format)
    result.files++
  }
  for (const file of files) {
    if (file.name.toLowerCase().endsWith('.zip')) {
      const entries = await unzipJson(new Uint8Array(await file.arrayBuffer()))
      for (const data of Object.values(entries)) add(strFromU8(data), false)
    } else {
      try {
        add(await file.text(), true)
      } catch (e) {
        throw new Error(e instanceof SyntaxError ? t('errNotJson', { file: file.name }) : `${file.name}: ${(e as Error).message}`)
      }
    }
  }
  if (!result.files) throw new Error(t('errNoTimeline'))
  return result
}
