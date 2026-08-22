import type { ZoneDefinition } from './types'

export const ZONES: ZoneDefinition[] = [
  { id: 'gate_1', name: 'South Entrance', lat: 28.6139, lng: 77.2090, coords: [28.6139, 77.2090] },
  { id: 'gate_2', name: 'North Gate',     lat: 28.6155, lng: 77.2090, coords: [28.6155, 77.2090] },
  { id: 'gate_3', name: 'East Pavilion',  lat: 28.6147, lng: 77.2105, coords: [28.6147, 77.2105] },
  { id: 'gate_4', name: 'West Exit',      lat: 28.6147, lng: 77.2075, coords: [28.6147, 77.2075] },
  { id: 'gate_5', name: 'Main Arena',     lat: 28.6147, lng: 77.2090, coords: [28.6147, 77.2090] },
]

export const ZONE_MAP = Object.fromEntries(ZONES.map(z => [z.id, z]))
