// Finds the commune of many points off the main thread, so large Timeline files keep the screen responsive.

import { geocoder } from './data'

export type GeocodeRequest = { points: [lon: number, lat: number][] }
export type GeocodeMessage = { kind: 'progress'; done: number } | { kind: 'done'; communes: (string | null)[] } | { kind: 'error'; message: string }

const post = (message: GeocodeMessage) => self.postMessage(message)

self.onmessage = async (e: MessageEvent<GeocodeRequest>) => {
  try {
    const cache = new Map<string, string | null>() // people stop at the same places again and again
    const communes: (string | null)[] = []
    for (const [lon, lat] of e.data.points) {
      const key = `${lon.toFixed(4)},${lat.toFixed(4)}`
      if (!cache.has(key)) cache.set(key, (await geocoder.locate(lon, lat))?.commune ?? null)
      communes.push(cache.get(key)!)
      if (communes.length % 500 === 0) post({ kind: 'progress', done: communes.length })
    }
    post({ kind: 'done', communes })
  } catch (err) {
    post({ kind: 'error', message: (err as Error).message })
  }
}
