import type { CsvPoint } from './csv'
import type { Geocoder } from './geocoder'

export interface ImportPlan {
  communes: { code: string; places: string[] }[] // communes not visited yet, in file order
  alreadyVisited: number // communes found that are already in your visits
  outside: number // points outside France
}

// Turns points into the communes they fall in, without saving anything.
export async function planImport(points: CsvPoint[], geocoder: Geocoder, visited: Set<string>): Promise<ImportPlan> {
  const found = new Map<string, string[]>()
  let outside = 0
  for (const p of points) {
    const code = (await geocoder.locate(p.lon, p.lat))?.commune
    if (!code) {
      outside++
      continue
    }
    if (!found.has(code)) found.set(code, [])
    if (p.label) found.get(code)!.push(p.label)
  }
  const communes = [...found].filter(([code]) => !visited.has(code)).map(([code, places]) => ({ code, places }))
  return { communes, alreadyVisited: found.size - communes.length, outside }
}
