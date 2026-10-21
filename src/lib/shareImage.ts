// Draws a picture of the visited map with its totals, to save or send to someone.
// Drawn on a plain 2D canvas from the boundary files, so it is the same whole-France view
// whatever the map is zoomed to, and in light colours whatever the device theme.

import { polygonsOf, type FeatureCollection, type Polygon } from './geo'

export const IMAGE_WIDTH = 1080
export const IMAGE_HEIGHT = 1350

export interface ShareColors {
  unvisited: string
  departement: string
  commune: string
  regionSteps: string[]
  border: string
  regionBorder: string
}

export interface ShareImageInput {
  level: 'departements' | 'regions'
  regions: FeatureCollection
  departements: FeatureCollection
  communes: FeatureCollection // visited communes only
  visitedDepartements: Set<string>
  regionShare: Map<string, number> // 0..1 of each region's departments visited
  colors: ShareColors
  title: string
  subtitle: string // the date
  totals: { value: string; label: string }[]
  goals: string // e.g. "3 of 18 goals reached"
  footer: string // the app's address
}

const BG = '#f4f1ea'
const TEXT = '#1d232a'
const MUTED = '#5d6874'
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

// Same bounds and Web Mercator projection as the map on screen.
const FRANCE = { west: -5.3, south: 41.3, east: 9.6, north: 51.15 }
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))

function projector(box: { x: number; y: number; w: number; h: number }) {
  const lon0 = (FRANCE.west * Math.PI) / 180
  const width = ((FRANCE.east - FRANCE.west) * Math.PI) / 180
  const top = mercY(FRANCE.north)
  const height = top - mercY(FRANCE.south)
  const scale = Math.min(box.w / width, box.h / height)
  const dx = box.x + (box.w - width * scale) / 2
  const dy = box.y + (box.h - height * scale) / 2
  return ([lon, lat]: number[]): [number, number] => [dx + ((lon * Math.PI) / 180 - lon0) * scale, dy + (top - mercY(lat)) * scale]
}

function pathOf(polygons: Polygon[], project: (p: number[]) => [number, number]) {
  const path = new Path2D()
  for (const polygon of polygons) {
    for (const ring of polygon) {
      ring.forEach((point, i) => {
        const [x, y] = project(point)
        if (i === 0) path.moveTo(x, y)
        else path.lineTo(x, y)
      })
      path.closePath()
    }
  }
  return path
}

export function regionColor(share: number, colors: ShareColors) {
  if (share <= 0) return colors.unvisited
  const steps = [0.2, 0.4, 0.6, 0.8]
  const i = steps.filter((s) => share >= s).length
  return colors.regionSteps[i]
}

export function drawShareImage(ctx: CanvasRenderingContext2D, input: ShareImageInput) {
  const { colors } = input
  const W = IMAGE_WIDTH
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, IMAGE_HEIGHT)

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = TEXT
  ctx.font = `700 64px ${FONT}`
  ctx.fillText(input.title, 64, 112, W - 128)
  ctx.fillStyle = MUTED
  ctx.font = `400 32px ${FONT}`
  ctx.fillText(input.subtitle, 64, 160, W - 128)

  const project = projector({ x: 40, y: 190, w: W - 80, h: 820 })
  const shape = (fc: FeatureCollection) => fc.features.map((f) => ({ code: f.properties.code, path: pathOf(polygonsOf(f.geometry), project) }))
  const regions = shape(input.regions)
  const departements = shape(input.departements)

  if (input.level === 'regions') {
    for (const r of regions) {
      ctx.fillStyle = regionColor(input.regionShare.get(r.code) ?? 0, colors)
      ctx.fill(r.path)
    }
  } else {
    for (const d of departements) {
      ctx.fillStyle = input.visitedDepartements.has(d.code) ? colors.departement : colors.unvisited
      ctx.fill(d.path)
    }
    ctx.fillStyle = colors.commune
    for (const c of shape(input.communes)) ctx.fill(c.path)
  }
  ctx.lineJoin = 'round'
  ctx.strokeStyle = colors.border
  ctx.lineWidth = 1.2
  ctx.globalAlpha = input.level === 'regions' ? 0.5 : 1
  for (const d of departements) ctx.stroke(d.path)
  ctx.globalAlpha = 1
  ctx.strokeStyle = colors.regionBorder
  ctx.lineWidth = 2
  for (const r of regions) ctx.stroke(r.path)

  // Totals in a row of equal columns under the map.
  const columns = input.totals.length
  const columnWidth = (W - 128) / columns
  input.totals.forEach((total, i) => {
    const x = 64 + i * columnWidth
    ctx.fillStyle = TEXT
    ctx.font = `700 72px ${FONT}`
    ctx.fillText(total.value, x, 1110, columnWidth - 16)
    ctx.fillStyle = MUTED
    ctx.font = `400 28px ${FONT}`
    ctx.fillText(total.label, x, 1152, columnWidth - 16)
  })

  ctx.fillStyle = TEXT
  ctx.font = `600 30px ${FONT}`
  ctx.fillText(input.goals, 64, 1220, W - 128)
  ctx.fillStyle = MUTED
  ctx.font = `400 26px ${FONT}`
  ctx.fillText(input.footer, 64, 1290, W - 128)
}
