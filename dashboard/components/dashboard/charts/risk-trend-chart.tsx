'use client'

import { useEffect, useMemo, useState } from 'react'
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

const ZONE_COLORS = [
  '#38bdf8', // South Entrance (Sky Blue)
  '#34d399', // West Entrance (Emerald)
  '#fbbf24', // North Entrance (Amber)
  '#a78bfa', // East Entrance (Purple)
]

export function RiskTrendChart() {
  const { history } = useCrowdShield()
  const [isLoaded, setIsLoaded] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 300)
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
    <div className="bg-card border border-border rounded-xl p-5 h-[380px] animate-in fade-in duration-500 flex flex-col justify-between">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Risk Trend by Gate</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time threat index per sector · Early warning trigger threshold at{' '}
            <span className="text-destructive font-mono font-bold">0.70</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {ZONES.map((zone, index) => (
            <div key={zone.id} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: ZONE_COLORS[index] }}
              />
              <span className="text-muted-foreground font-medium">{zone.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        className={`flex-1 min-h-[260px] transition-opacity duration-500 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground animate-pulse">
            Buffering telemetry data…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
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
                    <stop offset="0%" stopColor={ZONE_COLORS[index]} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={ZONE_COLORS[index]} stopOpacity={0.0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8899a6', fontSize: 10 }}
                dy={8}
              />
              <YAxis
                domain={[0, 1]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8899a6', fontSize: 10 }}
                tickFormatter={(val) => val.toFixed(1)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0c1926',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
                labelStyle={{ color: '#fff', fontWeight: 600 }}
                formatter={(value: number) => [`${(value * 100).toFixed(0)}%`, 'Risk Level']}
              />
              <ReferenceLine
                y={0.7}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'Stampede Threshold (0.70)',
                  fill: '#ef4444',
                  fontSize: 10,
                  fontWeight: 700,
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
                  strokeWidth={2}
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
    </div>
  )
}
