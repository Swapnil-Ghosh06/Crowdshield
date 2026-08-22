export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface Announcement {
  en: string
  hi: string
}

export interface RiskEvent {
  zone_id: string
  zone_name: string
  timestamp: string
  density_per_sqm: number
  flow_speed_mps: number
  risk_score: number
  risk_level: RiskLevel
  eta_minutes: number | null
  recommendations: string[]
  announcement: Announcement
}

export type InterventionState = 'idle' | 'confirmed' | 'acknowledged'

export interface Intervention {
  id: string
  zone_id: string
  zone_name: string
  action: string
  label: string
  timestamp: string
  state: InterventionState
}

export interface ZoneDefinition {
  id: string
  name: string
  lat: number
  lng: number
  coords: [number, number]
}
