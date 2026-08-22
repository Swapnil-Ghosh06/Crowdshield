import type { RiskLevel } from './types'

export const RISK_COLORS: Record<RiskLevel | 'none', string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
  none: '#64748b',
}

export const RISK_BADGE_CLASSES: Record<RiskLevel | 'none', string> = {
  low: 'bg-success/10 text-success border border-success/20',
  medium: 'bg-warning/10 text-warning border border-warning/20',
  high: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  critical: 'bg-destructive/10 text-destructive-foreground border border-destructive/30',
  none: 'bg-secondary text-muted-foreground border border-border',
}

export const RISK_CARD_CLASSES: Record<RiskLevel | 'none', string> = {
  low: 'border-success/30',
  medium: 'border-warning/30',
  high: 'border-orange-500/40',
  critical: 'border-destructive/50',
  none: 'border-border',
}

export function getRiskColor(level: RiskLevel | string | undefined): string {
  if (!level) return RISK_COLORS.none
  return RISK_COLORS[level.toLowerCase() as RiskLevel] ?? RISK_COLORS.none
}
