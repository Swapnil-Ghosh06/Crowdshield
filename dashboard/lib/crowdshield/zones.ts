import type { ZoneDefinition } from './types'

export const ZONES: ZoneDefinition[] = [
  { id: 'gate_1', name: 'South Entrance', lat: 28.6139, lng: 77.2090, coords: [28.6139, 77.2090] },
  { id: 'gate_2', name: 'West Entrance',  lat: 28.6155, lng: 77.2085, coords: [28.6155, 77.2085] },
  { id: 'gate_3', name: 'North Entrance', lat: 28.6162, lng: 77.2090, coords: [28.6162, 77.2090] },
  { id: 'gate_4', name: 'East Entrance',  lat: 28.6147, lng: 77.2105, coords: [28.6147, 77.2105] },
]

export const ZONE_MAP = Object.fromEntries(ZONES.map(z => [z.id, z]))
