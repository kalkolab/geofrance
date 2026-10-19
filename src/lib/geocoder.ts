import { findShape, nearestShape, toShapes, type FeatureCollection, type Shape } from './geo'

export interface Location {
  departement: string
  commune: string | null // null when the point falls in a gap between simplified commune shapes
}

export interface GeoSource {
  departements(): Promise<FeatureCollection>
  communes(departement: string): Promise<FeatureCollection>
}

// How far outside the simplified boundaries a point may be and still count (coasts, harbours).
const COAST_KM = 2

// Finds the department first, then loads only that department's communes.
export class Geocoder {
  private deps?: Promise<Shape[]>
  private communes = new Map<string, Promise<Shape[]>>()

  constructor(private source: GeoSource) {}

  async locate(lon: number, lat: number): Promise<Location | null> {
    this.deps ??= this.source.departements().then(toShapes)
    const deps = await this.deps
    const departement = findShape(deps, lon, lat) ?? nearestShape(deps, lon, lat, COAST_KM)
    if (!departement) return null
    let shapes = this.communes.get(departement)
    if (!shapes) {
      shapes = this.source.communes(departement).then(toShapes)
      this.communes.set(departement, shapes)
    }
    const communes = await shapes
    return { departement, commune: findShape(communes, lon, lat) ?? nearestShape(communes, lon, lat, COAST_KM) }
  }
}
