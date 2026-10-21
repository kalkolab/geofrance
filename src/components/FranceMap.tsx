import { Map as MapLibre, NavigationControl, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { geocoder, loadCommunes, loadDepartements, loadRegions } from '../data'
import { useT } from '../i18n'
import type { Location } from '../lib/geocoder'
import type { GoalItem } from '../lib/goals'
import type { RefData } from '../lib/ref'
import type { Stats } from '../lib/stats'

setWorkerUrl(workerUrl)

export type Level = 'departements' | 'regions'

export const COLORS = {
  unvisited: '#e3e6ea',
  departement: '#6baed6',
  commune: '#08519c',
  regionSteps: ['#dbe9f6', '#9ecae1', '#6baed6', '#3182bd', '#08519c'],
  border: '#ffffff',
  regionBorder: '#4a5560',
  selection: '#e8590c',
  goal: '#d6336c',
  hover: '#1d232a',
}

const FRANCE: [number, number, number, number] = [-5.3, 41.3, 9.6, 51.15]
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

const STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f4f1ea' } }],
}

const asGeoJSON = (fc: unknown) => fc as GeoJSON.FeatureCollection

// Only devices with a real pointer get the hover label; on a phone a tap opens the place panel instead.
const canHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

interface Hover extends Location {
  x: number
  y: number
}

interface Props {
  geo: RefData
  stats: Stats
  visited: Set<string>
  level: Level
  selected: { departement: string; commune: string | null } | null
  highlight: GoalItem[] | null // places still to visit for the goal shown on the map
  onPick(lon: number, lat: number): void
}

export function FranceMap({ geo, stats, visited, level, selected, highlight, onPick }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const [ready, setReady] = useState(false)
  const [hover, setHover] = useState<Hover | null>(null)

  useEffect(() => {
    const map = new MapLibre({
      container: container.current!,
      style: STYLE,
      bounds: FRANCE,
      fitBoundsOptions: { padding: 12 },
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: { compact: true, customAttribution: 'Boundaries: IGN ADMIN EXPRESS, INSEE COG' },
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.on('click', (e) => onPickRef.current(e.lngLat.lng, e.lngLat.lat))
    if (canHover) {
      let latest = 0
      map.on('mousemove', (e) => {
        const call = ++latest
        const { x, y } = e.point
        geocoder.locate(e.lngLat.lng, e.lngLat.lat).then(
          (place) => call === latest && setHover(place && { ...place, x, y }),
          () => {},
        )
      })
      map.on('mouseout', () => {
        latest++
        setHover(null)
      })
    }
    map.on('load', async () => {
      const [regions, deps] = await Promise.all([loadRegions(), loadDepartements()])
      map.addSource('regions', { type: 'geojson', data: asGeoJSON(regions), promoteId: 'code' })
      map.addSource('departements', { type: 'geojson', data: asGeoJSON(deps), promoteId: 'code' })
      map.addSource('visited-communes', { type: 'geojson', data: EMPTY })
      map.addSource('selection', { type: 'geojson', data: EMPTY })
      map.addSource('hover', { type: 'geojson', data: EMPTY })
      map.addSource('goal-places', { type: 'geojson', data: EMPTY })
      const share = ['coalesce', ['feature-state', 'share'], 0]
      const [s1, s2, s3, s4, s5] = COLORS.regionSteps
      map.addLayer({
        id: 'regions-fill',
        type: 'fill',
        source: 'regions',
        paint: {
          'fill-color': ['step', share, COLORS.unvisited, 0.0001, s1, 0.2, s2, 0.4, s3, 0.6, s4, 0.8, s5] as never,
        },
      })
      map.addLayer({
        id: 'departements-fill',
        type: 'fill',
        source: 'departements',
        paint: {
          'fill-color': ['case', ['boolean', ['feature-state', 'visited'], false], COLORS.departement, COLORS.unvisited],
        },
      })
      map.addLayer({
        id: 'communes-fill',
        type: 'fill',
        source: 'visited-communes',
        paint: { 'fill-color': COLORS.commune, 'fill-opacity': 0.85 },
      })
      map.addLayer({
        id: 'departements-line',
        type: 'line',
        source: 'departements',
        paint: { 'line-color': COLORS.border, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 9, 1.5] },
      })
      map.addLayer({
        id: 'regions-line',
        type: 'line',
        source: 'regions',
        paint: { 'line-color': COLORS.regionBorder, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 9, 2.5] },
      })
      const missing = ['case', ['boolean', ['feature-state', 'missing'], false], 1, 0] as never
      map.addLayer({
        id: 'departements-goal',
        type: 'line',
        source: 'departements',
        paint: { 'line-color': COLORS.goal, 'line-width': 2.5, 'line-opacity': missing },
      })
      map.addLayer({
        id: 'regions-goal',
        type: 'line',
        source: 'regions',
        paint: { 'line-color': COLORS.goal, 'line-width': 3, 'line-opacity': missing },
      })
      map.addLayer({
        id: 'goal-places',
        type: 'circle',
        source: 'goal-places',
        paint: {
          'circle-color': COLORS.goal,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 10, 7],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      })
      map.addLayer({
        id: 'hover-line',
        type: 'line',
        source: 'hover',
        paint: { 'line-color': COLORS.hover, 'line-width': 1.5, 'line-opacity': 0.8 },
      })
      map.addLayer({
        id: 'selection-line',
        type: 'line',
        source: 'selection',
        paint: { 'line-color': COLORS.selection, 'line-width': 2.5 },
      })
      setReady(true)
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const byRegion = level === 'regions'
    map.setLayoutProperty('regions-fill', 'visibility', byRegion ? 'visible' : 'none')
    map.setLayoutProperty('departements-fill', 'visibility', byRegion ? 'none' : 'visible')
    map.setLayoutProperty('communes-fill', 'visibility', byRegion ? 'none' : 'visible')
    map.setPaintProperty('departements-line', 'line-opacity', byRegion ? 0.5 : 1)
  }, [ready, level])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    for (const d of geo.departements) {
      map.setFeatureState({ source: 'departements', id: d.code }, { visited: stats.communesByDepartement.has(d.code) })
    }
    for (const r of geo.regions) {
      map.setFeatureState({ source: 'regions', id: r.code }, { share: stats.departementShareByRegion.get(r.code) ?? 0 })
    }
  }, [ready, geo, stats])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    let cancelled = false
    const deps = [...new Set([...visited].map((code) => geo.commune.get(code)?.departement).filter(Boolean))]
    Promise.all(deps.map((d) => loadCommunes(d!))).then((files) => {
      if (cancelled) return
      const features = files.flatMap((fc) => fc.features.filter((f) => visited.has(f.properties.code)))
      ;(map.getSource('visited-communes') as GeoJSONSource).setData(asGeoJSON({ type: 'FeatureCollection', features }))
    }, console.error)
    return () => {
      cancelled = true
    }
  }, [ready, geo, visited])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const source = map.getSource('selection') as GeoJSONSource
    if (!selected) {
      source.setData(EMPTY)
      return
    }
    let cancelled = false
    const shape = selected.commune
      ? loadCommunes(selected.departement).then((fc) => fc.features.filter((f) => f.properties.code === selected.commune))
      : loadDepartements().then((fc) => fc.features.filter((f) => f.properties.code === selected.departement))
    shape.then((features) => {
      if (!cancelled) source.setData(asGeoJSON({ type: 'FeatureCollection', features }))
    }, console.error)
    return () => {
      cancelled = true
    }
  }, [ready, selected])

  // Mark the places a goal still needs: outlines for departments and regions, dots for communes.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const items = highlight ?? []
    const codes = (kind: GoalItem['kind']) => new Set(items.filter((i) => i.kind === kind).map((i) => i.code))
    const deps = codes('departement')
    const regions = codes('region')
    for (const d of geo.departements) map.setFeatureState({ source: 'departements', id: d.code }, { missing: deps.has(d.code) })
    for (const r of geo.regions) map.setFeatureState({ source: 'regions', id: r.code }, { missing: regions.has(r.code) })
    const features = [...codes('commune')].flatMap((code) => {
      const point = geo.point.get(code)
      return point ? [{ type: 'Feature' as const, properties: { code }, geometry: { type: 'Point' as const, coordinates: point } }] : []
    })
    ;(map.getSource('goal-places') as GeoJSONSource).setData({ type: 'FeatureCollection', features })
  }, [ready, geo, highlight])

  // Outline the commune (or, in the regions view, the region) under the pointer.
  const byRegion = level === 'regions'
  const hoverRegion = hover && geo.departement.get(hover.departement)?.region
  const hoverKey = hover && (byRegion ? hoverRegion : hover.commune ?? `dep:${hover.departement}`)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const source = map.getSource('hover') as GeoJSONSource
    if (!hover) {
      source.setData(EMPTY)
      return
    }
    let cancelled = false
    const shape = byRegion
      ? loadRegions().then((fc) => fc.features.filter((f) => f.properties.code === hoverRegion))
      : hover.commune
        ? loadCommunes(hover.departement).then((fc) => fc.features.filter((f) => f.properties.code === hover.commune))
        : loadDepartements().then((fc) => fc.features.filter((f) => f.properties.code === hover.departement))
    shape.then((features) => {
      if (!cancelled) source.setData(asGeoJSON({ type: 'FeatureCollection', features }))
    }, console.error)
    return () => {
      cancelled = true
    }
  }, [ready, hoverKey])

  return (
    <>
      <div ref={container} className="map" />
      {hover && <HoverLabel geo={geo} hover={hover} visited={visited} showRegion={byRegion} />}
    </>
  )
}

function HoverLabel({ geo, hover, visited, showRegion }: { geo: RefData; hover: Hover; visited: Set<string>; showRegion: boolean }) {
  const t = useT()
  const dep = geo.departement.get(hover.departement)
  const commune = hover.commune ? geo.commune.get(hover.commune) : undefined
  const region = dep && geo.region.get(dep.region)
  const postcodes = commune?.postcodes ?? []
  return (
    <div className="hover-label" style={{ left: hover.x, top: hover.y }}>
      {commune && (
        <div>
          <strong>{commune.name}</strong>
          {postcodes.length > 0 && ` ${postcodes[0]}${postcodes.length > 1 ? '…' : ''}`}
          {visited.has(commune.code) && <span className="tag">{t('hoverVisited')}</span>}
        </div>
      )}
      {dep && (
        <div className={commune ? 'muted' : undefined}>
          {dep.name} ({dep.code})
        </div>
      )}
      {showRegion && region && <div className="muted">{region.name}</div>}
    </div>
  )
}
