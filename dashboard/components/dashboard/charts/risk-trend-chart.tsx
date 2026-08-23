'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { Activity, ShieldAlert } from 'lucide-react'

const ZONE_COLORS = [
  '#38bdf8', // South Entrance (Sky Blue)
  '#00d68f', // West Entrance (CrowdShield Signature Emerald)
  '#fbbf24', // North Entrance (Amber)
  '#a78bfa', // East Entrance (Purple)
]

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    color: string
    dataKey: string
  }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="bg-popover/95 backdrop-blur-md border border-border rounded-lg p-2.5 shadow-xl text-xs font-mono text-popover-foreground">
      <div className="text-muted-foreground text-[10px] pb-1.5 mb-1.5 border-b border-border flex items-center justify-between gap-4">
        <span>TIME: {label}</span>
        <span className="text-[9px] uppercase tracking-wider text-accent font-bold">Realtime Telemetry</span>
      </div>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-muted-foreground text-[11px]">{item.name}:</span>
            </div>
            <span
              className="font-bold text-[11px]"
              style={{
                color:
                  item.value >= 0.7
                    ? '#ef4444'
                    : item.value >= 0.5
                    ? '#f59e0b'
                    : '#00d68f',
              }}
            >
              {(item.value * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RiskTrendChart() {
  const { history } = useCrowdShield()
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 250)
    return () => clearTimeout(timer)
  }, [])

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
          if (!tickTime && values[offset].timestamp) {
            try {
              const d = new Date(values[offset].timestamp)
              if (!isNaN(d.getTime())) {
                tickTime = d.toISOString().slice(11, 19)
              }
            } catch {
              tickTime = ''
            }
          }
        }
      })
      return { time: tickTime || `T-${maxLen - index}`, ...point }
    })
  }, [history])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="bg-card border border-border rounded-xl p-4 lg:p-5 flex flex-col justify-between select-none"
    >
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-accent">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3
              className="text-sm font-semibold text-foreground tracking-tight"
              style={{ fontFamily: "'Ysabeau SC', sans-serif" }}
            >
              Tactical Risk Trajectory
            </h3>
            <p className="text-[11px] text-muted-foreground font-mono">
              Real-time threat index per gate · Danger threshold at{' '}
              <span className="text-destructive font-bold">0.70</span>
            </p>
          </div>
        </div>

        {/* Minimalist Legend */}
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-mono">
          {ZONES.map((zone, index) => (
            <div key={zone.id} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: ZONE_COLORS[index] }}
              />
              <span className="text-muted-foreground">{zone.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Telemetry Area */}
      <div className="h-[250px] w-full mt-2">
        {!isLoaded || chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs font-mono text-muted-foreground animate-pulse">
            Connecting real-time sensor streams…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
            >
              <defs>
                {ZONES.map((zone, index) => (
                  <linearGradient
                    key={zone.id}
                    id={`grad_${zone.id}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={ZONE_COLORS[index]} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={ZONE_COLORS[index]} stopOpacity={0.0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(37,41,34,0.08)" vertical={false} />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8899a6', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                dy={6}
              />
              <YAxis
                domain={[0, 1]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8899a6', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={0.7}
                stroke="#ef4444"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{
                  value: '0.70 DANGER',
                  fill: '#ef4444',
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: 'JetBrains Mono, monospace',
                  position: 'insideTopRight',
                }}
              />
              {ZONES.map((zone, index) => (
                <Area
                  key={zone.id}
                  type="monotone"
                  dataKey={zone.id}
                  name={zone.name}
                  stroke={ZONE_COLORS[index]}
                  strokeWidth={1.75}
                  fill={`url(#grad_${zone.id})`}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  )
}
