import { Map as MapLibre, NavigationControl, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { loadCommunes, loadDepartements, loadRegions } from '../data'
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
}

const FRANCE: [number, number, number, number] = [-5.3, 41.3, 9.6, 51.15]
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

const STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f4f1ea' } }],
}

const asGeoJSON = (fc: unknown) => fc as GeoJSON.FeatureCollection

interface Props {
  geo: RefData
  stats: Stats
  visited: Set<string>
  level: Level
  selected: { departement: string; commune: string | null } | null
  onPick(lon: number, lat: number): void
}

export function FranceMap({ geo, stats, visited, level, selected, onPick }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const [ready, setReady] = useState(false)

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
    map.on('load', async () => {
      const [regions, deps] = await Promise.all([loadRegions(), loadDepartements()])
      map.addSource('regions', { type: 'geojson', data: asGeoJSON(regions), promoteId: 'code' })
      map.addSource('departements', { type: 'geojson', data: asGeoJSON(deps), promoteId: 'code' })
      map.addSource('visited-communes', { type: 'geojson', data: EMPTY })
      map.addSource('selection', { type: 'geojson', data: EMPTY })
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

  return <div ref={container} className="map" />
}
