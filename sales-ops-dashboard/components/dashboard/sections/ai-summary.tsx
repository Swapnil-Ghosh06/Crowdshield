'use client'

import { useMemo, useState } from 'react'
import { Brain, Download, FileText, Loader2, RefreshCw, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'

export function AISummarySection() {
  const { events, interventions, totalEvents } = useCrowdShield()
  const [summary, setSummary] = useState('')
  const [generatedAt, setGeneratedAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const zones = useMemo(() => Array.from(events.values()).sort((a, b) => b.risk_score - a.risk_score), [events])
  const critical = zones.filter((zone) => zone.risk_level === 'critical')
  const high = zones.filter((zone) => zone.risk_level === 'high')
  const snapshot = zones.map((zone) => `${zone.zone_name}: risk ${zone.risk_score.toFixed(2)}, ${zone.density_per_sqm}/m², flow ${zone.flow_speed_mps}m/s, ETA ${zone.eta_minutes}m`).join('\n')

  async function generate() {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/incident-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ snapshot, totalEvents, interventions: interventions.filter((item) => item.state !== 'idle').map((item) => item.label).join(', ') }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setSummary(data.text); setGeneratedAt(new Date().toLocaleTimeString())
    } catch (err) { setError(err instanceof Error ? err.message : 'Generation failed.') } finally { setLoading(false) }
  }
  function exportReport() {
    const blob = new Blob([`CrowdShield Incident Report\nGenerated: ${generatedAt}\n\n${summary}\n\nZONE SNAPSHOT\n${snapshot}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `crowdshield-report-${Date.now()}.txt`; link.click(); URL.revokeObjectURL(url)
  }
  const cards = [['Situation Report', 'AI incident briefing', FileText, 'text-accent'], ['Zone Analysis', `${zones.length} zones · ${critical.length} critical`, ShieldAlert, critical.length ? 'text-destructive' : 'text-success'], ['Intervention Log', `${interventions.filter((item) => item.state !== 'idle').length} actions confirmed`, CheckCircle2, 'text-success'], ['Risk Forecast', high.length ? `${high.length} zones trending high` : 'All zones stable', AlertTriangle, high.length ? 'text-warning' : 'text-muted-foreground']] as const

  return <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{cards.map(([label, sub, Icon, color], index) => <div key={label} className="bg-card border border-border rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}><div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p><Icon className={cn('w-4 h-4', color)} /></div><p className="text-sm text-foreground font-medium">{sub}</p></div>)}</div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="lg:col-span-2 space-y-4"><div className="bg-card border border-border rounded-xl p-5"><div className="flex items-center justify-between mb-4"><div><h3 className="text-base font-semibold text-foreground flex items-center gap-2"><Brain className="w-4 h-4 text-accent" />AI Incident Summary</h3><p className="text-sm text-muted-foreground mt-1">Generate a briefing from live venue telemetry.</p></div>{summary && <button onClick={exportReport} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-secondary border border-border hover:border-accent"><Download className="w-3 h-3" />Export</button>}</div><button onClick={generate} disabled={loading || !zones.length} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm disabled:bg-secondary disabled:text-muted-foreground">{loading ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing telemetry…</> : <><Brain className="w-4 h-4" />{summary ? 'Regenerate Summary' : 'Generate Incident Summary'}</>}</button></div>{error && <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">{error}</div>}{summary && <div className="bg-card border border-border rounded-xl p-5"><div className="flex justify-between mb-4"><h3 className="text-sm font-semibold">Incident Briefing</h3><span className="text-xs font-mono text-muted-foreground"><RefreshCw className="inline w-3 h-3 mr-1" />{generatedAt}</span></div><div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{summary.split('\n\n').map((paragraph, index) => <p key={index} className={cn(paragraph.includes('SEVERITY LEVEL') && 'border-t border-border pt-3 font-bold text-foreground')}>{paragraph}</p>)}</div></div>}</div><div className="bg-card border border-border rounded-xl p-5 h-fit"><div className="flex items-center justify-between mb-4"><h3 className="text-sm font-semibold">Live Zone Snapshot</h3><span className="text-xs font-mono text-muted-foreground">{zones.length} zones</span></div><div className="space-y-2">{zones.map((zone) => <div key={zone.zone_id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-secondary/50"><div><p className="text-xs font-medium">{zone.zone_name}</p><p className="text-[10px] font-mono text-muted-foreground">{zone.density_per_sqm}/m² · ETA {zone.eta_minutes}m</p></div><span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', RISK_BADGE_CLASSES[zone.risk_level as RiskLevel])}>{zone.risk_score.toFixed(2)}</span></div>)}</div></div></div>
  </div>
}
