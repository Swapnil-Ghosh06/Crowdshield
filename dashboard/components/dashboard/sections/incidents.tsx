'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'
import { Search, ArrowUpDown, Siren, AlertTriangle, Info, CheckCircle2 } from 'lucide-react'

type Filter = 'all' | RiskLevel
type SortField = 'time' | 'zone' | 'risk_score' | 'eta'
const ICONS = { critical: Siren, high: AlertTriangle, medium: Info, low: CheckCircle2 }

export function IncidentsSection() {
  const { history, interventions } = useCrowdShield()
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<SortField>('risk_score')
  const [ascending, setAscending] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const incidents = useMemo(
    () =>
      Array.from(history.values())
        .flat()
        .map((event, index) => ({
          ...event,
          id: `${event.zone_id}-${event.timestamp}-${index}`,
        })),
    [history]
  )

  const rows = useMemo(
    () =>
      incidents
        .filter(
          (row) =>
            (filter === 'all' || row.risk_level === filter) &&
            `${row.zone_name} ${row.zone_id}`.toLowerCase().includes(query.toLowerCase())
        )
        .sort((a, b) => {
          const value =
            sort === 'zone'
              ? a.zone_name.localeCompare(b.zone_name)
              : sort === 'time'
              ? +new Date(a.timestamp) - +new Date(b.timestamp)
              : sort === 'eta'
              ? (a.eta_minutes ?? Infinity) - (b.eta_minutes ?? Infinity)
              : a.risk_score - b.risk_score
          return ascending ? value : -value
        })
        .slice(0, 50),
    [incidents, filter, query, sort, ascending]
  )

  const toggleSort = (field: SortField) => {
    if (sort === field) setAscending((value) => !value)
    else {
      setSort(field)
      setAscending(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['all', 'critical', 'high', 'medium'] as Filter[]).map((level) => (
          <div key={level} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
              {level === 'all' ? 'Total Events' : `${level} Events`}
            </p>
            <p className="text-2xl font-bold text-foreground">
              {level === 'all'
                ? incidents.length
                : incidents.filter((item) => item.risk_level === level).length}
            </p>
            <span
              className={cn(
                'inline-flex mt-1.5 px-2 py-0.5 rounded text-xs font-bold uppercase',
                level === 'all' ? 'bg-secondary text-muted-foreground' : RISK_BADGE_CLASSES[level]
              )}
            >
              {level}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              aria-label="Search incidents"
              placeholder="Search zone name or ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-64 h-9 pl-9 pr-4 rounded-xl bg-secondary/80 border border-border text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'critical', 'high', 'medium', 'low'] as Filter[]).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all duration-200 cursor-pointer',
                  filter === item
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-foreground/80 hover:text-foreground hover:bg-secondary'
                )}
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-muted-foreground font-semibold" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          Showing {rows.length} of {incidents.length} events
        </span>
      </div>

      {interventions.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            <CheckCircle2 className="w-4 h-4 text-success" /> Intervention Log{' '}
            <span className="ml-auto text-xs font-semibold text-muted-foreground">
              {interventions.length} recorded
            </span>
          </h3>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {interventions.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-secondary/50 text-xs"
              >
                <span className="text-foreground font-semibold">
                  {item.zone_id} · {item.label}
                </span>
                <span className="text-muted-foreground font-medium">{item.state}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {['zone', 'risk_score', 'eta', 'time'].map((field) => (
                  <th
                    key={field}
                    onClick={() => toggleSort(field as SortField)}
                    className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    <span className="flex items-center gap-1">
                      {field.replace('_', ' ')}
                      <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                ))}
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  Density
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No events match the current filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const Icon = ICONS[row.risk_level]
                  const formattedTime = mounted && row.timestamp
                    ? new Date(row.timestamp).toLocaleTimeString()
                    : '—'

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border hover:bg-secondary/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-bold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>{row.zone_name}</p>
                        <p className="text-xs text-muted-foreground font-medium">{row.zone_id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold uppercase',
                            RISK_BADGE_CLASSES[row.risk_level]
                          )}
                          style={{ fontFamily: "'Montserrat', sans-serif" }}
                        >
                          <Icon className="w-3 h-3" />
                          {row.risk_level}
                        </span>
                        <span className="ml-2 font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                          {row.risk_score.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {row.eta_minutes != null ? `${row.eta_minutes}m` : '—'}
                      </td>
                      <td
                        className="px-4 py-3 text-xs text-muted-foreground font-medium"
                        suppressHydrationWarning
                      >
                        {formattedTime}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-semibold">
                        {row.density_per_sqm}/m²
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
