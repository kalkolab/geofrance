import { describe, expect, it } from 'vitest'
import { detectStops, parseLatLng, parseTimeline } from '../src/lib/timeline'
import { planVisits } from '../src/lib/visitPlan'

describe('timeline formats', () => {
  it('reads the Android on-device export', () => {
    const data = {
      semanticSegments: [
        {
          startTime: '2024-05-01T23:30:00.000+02:00',
          endTime: '2024-05-02T08:00:00.000+02:00',
          visit: { hierarchyLevel: 0, probability: 0.9, topCandidate: { placeId: 'x', placeLocation: { latLng: '48.8566°, 2.3522°' } } },
        },
        { startTime: '2024-05-02T08:00:00.000+02:00', activity: { start: { latLng: '48.85°, 2.35°' } } },
        { startTime: '2024-05-02T08:00:00.000+02:00', timelinePath: [{ point: '48.85°, 2.35°', time: '…' }] },
      ],
      rawSignals: [],
    }
    expect(parseTimeline(data)).toEqual({ format: 'android', stops: [{ lat: 48.8566, lon: 2.3522, date: '2024-05-01' }] })
  })

  it('reads the iPhone export', () => {
    const data = [
      { startTime: '2023-07-14T10:00:00.000+02:00', visit: { topCandidate: { placeLocation: 'geo:43.296400,5.370000' } } },
      { startTime: '2023-07-14T12:00:00.000+02:00', activity: { start: 'geo:43.29,5.37' } },
    ]
    expect(parseTimeline(data).stops).toEqual([{ lat: 43.2964, lon: 5.37, date: '2023-07-14' }])
  })

  it('reads Takeout semantic location history', () => {
    const data = {
      timelineObjects: [
        { placeVisit: { location: { latitudeE7: 457640000, longitudeE7: 48357000, name: 'Place Bellecour' }, duration: { startTimestamp: '2019-03-02T09:00:00Z' } } },
        { placeVisit: { location: { latitudeE7: 451828000, longitudeE7: 57207000 }, duration: { startTimestampMs: '1551520800000' } } },
        { activitySegment: { startLocation: { latitudeE7: 1, longitudeE7: 2 } } },
      ],
    }
    expect(parseTimeline(data)).toEqual({
      format: 'takeout-semantic',
      stops: [
        { lat: 45.764, lon: 4.8357, date: '2019-03-02', label: 'Place Bellecour' },
        { lat: 45.1828, lon: 5.7207, date: '2019-03-02', label: undefined },
      ],
    })
  })

  it('finds stops in raw Takeout records', () => {
    const t0 = Date.parse('2020-08-01T10:00:00Z')
    const at = (min: number, lat: number, lon: number) => ({ latitudeE7: lat * 1e7, longitudeE7: lon * 1e7, timestamp: new Date(t0 + min * 60e3).toISOString() })
    const locations = [
      at(0, 48.8566, 2.3522), at(10, 48.8567, 2.3523), at(30, 48.8565, 2.3521), // 30 min in Paris: a stop
      at(40, 48.9, 2.4), at(45, 49.0, 2.5), // driving
      at(60, 49.2621, 4.0275), at(70, 49.2622, 4.0276), // 10 min in Reims: not a stop
    ]
    expect(parseTimeline({ locations })).toEqual({ format: 'takeout-records', stops: [{ lat: 48.8566, lon: 2.3522, date: '2020-08-01' }] })
  })

  it('rejects other JSON', () => {
    expect(() => parseTimeline({ format: 'geofrance-visits' })).toThrow(/Timeline/)
  })

  it('parses coordinates in both notations', () => {
    expect(parseLatLng('-33.8688°, 151.2093°')).toEqual([-33.8688, 151.2093])
    expect(parseLatLng('geo:48.1,-1.6')).toEqual([48.1, -1.6])
    expect(parseLatLng('nowhere')).toBe(null)
  })

  it('detectStops ignores points that keep moving', () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({ lat: 45 + i * 0.01, lon: 5, time: i * 10 * 60e3 }))
    expect(detectStops(pts)).toEqual([])
  })
})

describe('planVisits', () => {
  it('keeps one visit per commune and day and skips what is known', () => {
    const stops = [
      { lat: 0, lon: 0, date: '2024-05-01' },
      { lat: 0, lon: 0, date: '2024-05-01' }, // same commune, same day
      { lat: 0, lon: 0, date: '2024-05-03' },
      { lat: 0, lon: 0, date: '2024-04-20' },
      { lat: 0, lon: 0, date: '2024-06-01' }, // outside France
    ]
    const existing = [{ commune: '13055', date: '2024-04-20', source: 'manual' as const, createdAt: '' }]
    const plan = planVisits(stops, ['75056', '75056', '75056', '13055', null], existing)
    expect(plan.visits).toEqual([
      { commune: '75056', date: '2024-05-01' },
      { commune: '75056', date: '2024-05-03' },
    ])
    expect(plan).toMatchObject({ newCommunes: 1, stops: 5, outside: 1, duplicates: 2, firstDate: '2024-05-01', lastDate: '2024-05-03' })
  })
})
