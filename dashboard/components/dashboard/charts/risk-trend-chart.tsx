'use client'

import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'

const ZONE_COLORS = ['oklch(0.7 0.18 220)', 'oklch(0.7 0.18 145)', 'oklch(0.75 0.2 50)', 'oklch(0.7 0.22 30)', 'oklch(0.7 0.2 300)']

export function RiskTrendChart() {
  const { history } = useCrowdShield()
  const [isLoaded, setIsLoaded] = useState(false)
  useEffect(() => { const timer = setTimeout(() => setIsLoaded(true), 300); return () => clearTimeout(timer) }, [])

  const chartData = useMemo(() => {
    const maxLen = Math.max(0, ...ZONES.map((zone) => (history.get(zone.id) ?? []).length))
    if (!maxLen) return []
    return Array.from({ length: maxLen }, (_, index) => {
      const point: Record<string, number | string> = {}
      let tickTime = ''
      ZONES.forEach((zone) => {
        const values = history.get(zone.id) ?? []
        const offset = values.length - maxLen + index
        if (offset >= 0 && values[offset]) {
          point[zone.id] = Number(values[offset].risk_score.toFixed(2))
          if (!tickTime && values[offset].timestamp) tickTime = new Date(values[offset].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }
      })
      return { time: tickTime || `T-${maxLen - index}`, ...point }
    })
  }, [history])

  return <div className="bg-card border border-border rounded-xl p-5 h-[380px] animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center justify-between mb-6"><div><h3 className="text-base font-semibold text-foreground">Risk Score Trend</h3><p className="text-sm text-muted-foreground mt-0.5">Live risk scores per zone · threshold at <span className="text-destructive font-mono font-bold">0.70</span></p></div><div className="flex flex-wrap items-center gap-3 text-xs">{ZONES.map((zone, index) => <div key={zone.id} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: ZONE_COLORS[index] }} /><span className="text-muted-foreground">{zone.name}</span></div>)}</div></div>
    <div className={`h-[280px] transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>{chartData.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground animate-pulse">Aggregating telemetry…</div> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><defs>{ZONES.map((zone, index) => <linearGradient key={zone.id} id={`grad_${zone.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ZONE_COLORS[index]} stopOpacity={0.3} /><stop offset="100%" stopColor={ZONE_COLORS[index]} stopOpacity={0} /></linearGradient>)}</defs><CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.005 260)" vertical={false} /><XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }} dy={10} /><YAxis domain={[0, 1]} axisLine={false} tickLine={false} tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }} tickFormatter={(value) => value.toFixed(1)} dx={-10} /><Tooltip contentStyle={{ backgroundColor: 'oklch(0.12 0.005 260)', border: '1px solid oklch(0.22 0.005 260)', borderRadius: '8px', fontSize: '12px' }} labelStyle={{ color: 'oklch(0.95 0 0)', fontWeight: 600 }} formatter={(value: number) => [value.toFixed(2), 'Risk']} /><ReferenceLine y={0.7} stroke="oklch(0.637 0.237 25.331)" strokeDasharray="4 4" strokeWidth={2} label={{ value: 'Stampede threshold 0.70', fill: 'oklch(0.637 0.237 25.331)', fontSize: 11, fontWeight: 700, position: 'insideTopRight' }} />{ZONES.map((zone, index) => <Area key={zone.id} type="monotone" dataKey={zone.id} name={zone.name} stroke={ZONE_COLORS[index]} strokeWidth={2} fill={`url(#grad_${zone.id})`} dot={false} connectNulls />)}</AreaChart></ResponsiveContainer>}</div>
  </div>
}
