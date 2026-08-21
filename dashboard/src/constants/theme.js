export const RISK_COLORS = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
  none: '#334155',
}

export function getRiskColor(levelOrEvent) {
  if (!levelOrEvent) return RISK_COLORS.none
  const key = typeof levelOrEvent === 'string'
    ? levelOrEvent.toLowerCase()
    : levelOrEvent.risk_level?.toLowerCase()
  return RISK_COLORS[key] ?? RISK_COLORS.none
}
