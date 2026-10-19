// Reads a CSV of places with latitude and longitude columns, such as an export from a travel map app.

export interface CsvPoint {
  line: number
  lat: number
  lon: number
  label: string
}

export interface CsvResult {
  points: CsvPoint[]
  notBeen: number // rows whose "been" column says something else (for example a wishlist)
  invalid: number[] // line numbers without usable coordinates
}

const LAT = ['lat', 'latitude']
const LON = ['lon', 'lng', 'long', 'longitude']
const LABEL = ['city', 'name', 'place', 'title']

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      cells.push(cell.trim())
      cell = ''
    } else cell += ch
  }
  cells.push(cell.trim())
  return cells
}

const detectDelimiter = (header: string) =>
  [';', ',', '\t'].reduce((best, d) => (header.split(d).length > header.split(best).length ? d : best), ',')

const parseNumber = (s: string) => (/^-?\d+([.,]\d+)?$/.test(s) ? Number(s.replace(',', '.')) : NaN)

export function parseCsv(text: string): CsvResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  const delimiter = detectDelimiter(lines[0] ?? '')
  const header = splitLine(lines[0] ?? '', delimiter).map((h) => h.toLowerCase())
  const find = (names: string[]) => header.findIndex((h) => names.includes(h))
  const lat = find(LAT)
  const lon = find(LON)
  if (lat < 0 || lon < 0) throw new Error('The CSV needs a header row with "lat" and "lon" columns')
  const label = find(LABEL)
  const been = header.indexOf('been')

  const result: CsvResult = { points: [], notBeen: 0, invalid: [] }
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cells = splitLine(lines[i], delimiter)
    if (been >= 0 && cells[been] && !cells[been].toLowerCase().split(/[,|]/).map((t) => t.trim()).includes('been')) {
      result.notBeen++
      continue
    }
    const point = { line: i + 1, lat: parseNumber(cells[lat] ?? ''), lon: parseNumber(cells[lon] ?? ''), label: cells[label] ?? '' }
    if (Number.isFinite(point.lat) && Number.isFinite(point.lon) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180) {
      result.points.push(point)
    } else result.invalid.push(i + 1)
  }
  return result
}
