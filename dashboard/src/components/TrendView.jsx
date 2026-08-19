import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer
} from 'recharts'
import { riskColor, COLORS } from '../hooks/useRiskEvents'

const ZONE_NAMES = {
  gate_1:'South Entrance', gate_2:'North Gate',
  gate_3:'East Pavilion', gate_4:'West Exit', gate_5:'Main Arena'
}

export default function TrendView({ events, history }) {
  const [visible, setVisible] = useState(new Set(['gate_1','gate_2','gate_3','gate_4','gate_5']))

  const data = useMemo(() => {
    const rows = {}
    history.forEach((arr, id) => arr.forEach(x => {
      rows[x.timestamp] ??= { timestamp: x.timestamp }
      rows[x.timestamp][id] = x.risk_score
    }))
    return Object.values(rows).slice(-20)
  }, [history])

  const allScores = data.flatMap(x =>
    Object.entries(x).filter(([k])=>k!=='timestamp').map(([,v])=>+v)
  )
  const peak = allScores.length ? Math.max(...allScores) : 0
  const criticalCount = [...events.values()].filter(e=>e.risk_level==='high'||e.risk_level==='critical').length
  const peakColor = peak > .82 ? COLORS.critical : peak > .68 ? COLORS.high : peak > .42 ? COLORS.medium : COLORS.low

  const toggle = (id) => setVisible(v => {
    const n = new Set(v); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  return (
    <section className="analytics">
      <div className="section-head">
        <div>
          <h1>Risk Trend Analytics</h1>
          <p>Rolling 60-second window · updates every 3s</p>
        </div>
        <time>{new Date().toLocaleTimeString()}</time>
      </div>
      <div className="stats">
        <div className="stat" style={{'--stat':peakColor}}>
          <b style={{color:peakColor}}>{peak.toFixed(2)}</b>
          <span>Peak Risk</span>
        </div>
        <div className="stat" style={{'--stat':criticalCount>0?COLORS.critical:COLORS.low}}>
          <b style={{color:criticalCount>0?COLORS.critical:COLORS.low}}>{criticalCount}</b>
          <span>Critical Zones</span>
        </div>
        <div className="stat" style={{'--stat':COLORS.low}}>
          <b>{data.length}</b>
          <span>Data Points</span>
        </div>
      </div>
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,.05)" strokeDasharray="3 3"/>
            <XAxis dataKey="timestamp"
              tickFormatter={v => new Date(v).toLocaleTimeString([],{hour12:false})}
              tick={{fill:'#7c8db5',fontSize:11}} tickLine={false} axisLine={false}/>
            <YAxis domain={[0,1]} tick={{fill:'#7c8db5',fontSize:11}}
              tickLine={false} axisLine={false}
              tickFormatter={v=>v.toFixed(1)}/>
            <Tooltip contentStyle={{
              background:'#111827', border:'1px solid rgba(255,255,255,.1)',
              borderRadius:10, fontSize:12, color:'#eef2ff'
            }}/>
            <ReferenceLine y={0.7} stroke="#f97316" strokeDasharray="4 4"
              label={{value:'High Risk',position:'right',fill:'#f97316',fontSize:11}}/>
            {['gate_1','gate_2','gate_3','gate_4','gate_5'].map(id => (
              <Line key={id} type="monotone" dataKey={id}
                hide={!visible.has(id)}
                stroke={riskColor(events.get(id))}
                dot={false} strokeWidth={2} connectNulls/>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="toggles">
        {['gate_1','gate_2','gate_3','gate_4','gate_5'].map(id => (
          <button key={id}
            className={`zone-toggle${visible.has(id)?' active':''}`}
            onClick={()=>toggle(id)}>
            <i style={{background: riskColor(events.get(id))}}/>
            {ZONE_NAMES[id]}
          </button>
        ))}
      </div>
    </section>
  )
}
