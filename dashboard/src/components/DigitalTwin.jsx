import { riskColor, COLORS } from '../hooks/useRiskEvents'

const SHAPES = [
  ['gate_1','South Entrance', 310,380,240,80, 'bottom'],
  ['gate_2','North Gate',     310,60, 240,80, 'top'],
  ['gate_3','East Pavilion',  640,180,160,140,'right'],
  ['gate_4','West Exit',      60, 180,160,140,'left'],
  ['gate_5','Main Arena',     240,180,380,140, null],
]

const GATE_LINES = {
  bottom: ([x,y,w,h]) => [[x,y+h],[x+w,y+h]],
  top:    ([x,y,w,h]) => [[x,y],[x+w,y]],
  right:  ([x,y,w,h]) => [[x+w,y],[x+w,y+h]],
  left:   ([x,y,w,h]) => [[x,y],[x,y+h]],
}

export default function DigitalTwin({ events }) {
  const criticalCount = [...events.values()].filter(e=>e.risk_level==='high'||e.risk_level==='critical').length
  const avgDensity = events.size
    ? ([...events.values()].reduce((a,e)=>a+e.density_per_sqm,0)/events.size).toFixed(1)
    : '—'

  return (
    <section className="twin">
      <div className="section-head" style={{width:'100%',maxWidth:900}}>
        <div>
          <h1>Venue Digital Twin</h1>
          <p>Real-time zone status · South Delhi Stadium</p>
        </div>
      </div>
      <div className="legend">
        {[['low',COLORS.low],['medium',COLORS.medium],['high',COLORS.high],
          ['critical',COLORS.critical],['none',COLORS.none]].map(([label,color])=>(
          <span key={label}>
            <i style={{background:color}}/>
            {label==='none'?'NO DATA':label.toUpperCase()}
          </span>
        ))}
      </div>
      <div className="twin-card">
        <svg viewBox="0 0 860 520" role="img" aria-label="South Delhi Stadium digital twin">
          <rect width="860" height="520" fill="#080e1f"/>
          {[...Array(14)].map((_,i)=>(
            <path key={`h${i}`} d={`M0 ${i*40}H860`} stroke="rgba(255,255,255,.03)"/>
          ))}
          {[...Array(22)].map((_,i)=>(
            <path key={`v${i}`} d={`M${i*40} 0V520`} stroke="rgba(255,255,255,.03)"/>
          ))}
          <rect x="40" y="40" width="780" height="440" rx="20"
            fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1.5"/>
          <text x="430" y="30" textAnchor="middle"
            fill="rgba(255,255,255,.25)" fontSize="13">South Delhi Stadium</text>

          {SHAPES.map(([id, name, x, y, w, h, edge]) => {
            const e = events.get(id)
            const c = riskColor(e)
            const isCritical = e?.risk_level === 'critical'
            const hasClose = e?.recommendations?.some(r => r.includes('close_gate'))
            const hasOpen  = e?.recommendations?.some(r => r.includes('open_gate')) && !hasClose
            const gateLine = edge ? GATE_LINES[edge]([x,y,w,h]) : null

            return (
              <g key={id}>
                {isCritical && (
                  <rect x={x-4} y={y-4} width={w+8} height={h+8} rx="13"
                    fill="none" stroke={c} strokeWidth="3">
                    <animate attributeName="opacity"
                      values="0.8;0.1;0.8" dur="1.5s" repeatCount="indefinite"/>
                  </rect>
                )}
                <rect x={x} y={y} width={w} height={h} rx="10"
                  fill={`${c}2e`} stroke={c} strokeWidth="1.5"/>
                <text x={x+w/2} y={y+h/2-14} textAnchor="middle"
                  fill="white" fontSize="13" fontWeight="600">{name}</text>
                <text x={x+w/2} y={y+h/2+10} textAnchor="middle"
                  fill={c} fontSize="20" fontWeight="700">
                  {e?.risk_score?.toFixed(2) ?? '—'}
                </text>
                <text x={x+w/2} y={y+h/2+26} textAnchor="middle"
                  fill="rgba(255,255,255,.35)" fontSize="10">{id}</text>

                {gateLine && (hasClose || hasOpen) && (
                  <g>
                    <line
                      x1={gateLine[0][0]} y1={gateLine[0][1]}
                      x2={gateLine[1][0]} y2={gateLine[1][1]}
                      stroke={hasClose ? '#ef4444' : '#22c55e'}
                      strokeWidth="6" strokeLinecap="round"/>
                    <text
                      x={(gateLine[0][0]+gateLine[1][0])/2}
                      y={edge==='top' ? gateLine[0][1]-6 : gateLine[0][1]+14}
                      textAnchor="middle"
                      fill={hasClose ? '#ef4444' : '#22c55e'}
                      fontSize="9" fontWeight="700">
                      {hasClose ? 'CLOSED' : 'OPEN'}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="stats" style={{marginTop:16}}>
        <div className="stat" style={{'--stat':COLORS.low}}>
          <b>5</b><span>Zones Monitored</span>
        </div>
        <div className="stat" style={{'--stat':criticalCount>0?COLORS.critical:COLORS.low}}>
          <b style={{color:criticalCount>0?COLORS.critical:COLORS.low}}>{criticalCount}</b>
          <span>Active Alerts</span>
        </div>
        <div className="stat" style={{'--stat':COLORS.medium}}>
          <b>{avgDensity}</b><span>Avg Density (p/m²)</span>
        </div>
      </div>
    </section>
  )
}
