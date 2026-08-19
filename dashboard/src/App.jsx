import { useState } from 'react'
import { useRiskEvents, riskColor, COLORS } from './hooks/useRiskEvents'
import MapView from './components/MapView'
import TrendView from './components/TrendView'
import DigitalTwin from './components/DigitalTwin'

function Header({ tab, setTab, status, count }) {
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <svg className="brand-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"/>
          </svg>
          <b>CrowdShield</b>
          <span className="dot-sep">•</span>
          <span>Command Center</span>
        </div>
        <nav style={{display:'flex',gap:6}}>
          {[['map','⌖ Live Map'],['analytics','◒ Analytics'],['twin','▦ Digital Twin']].map(([id,label]) => (
            <button key={id} className={tab===id?'tab active':'tab'} onClick={()=>setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="connection">
          <i className={`status-dot ${status}`}/>
          <strong>{status==='connected'?'LIVE':status==='connecting'?'CONNECTING...':'OFFLINE'}</strong>
          <small>{status==='connected'?'ws://localhost:8000':`${count.toLocaleString()} events`}</small>
        </div>
      </header>
      <DemoBar />
    </>
  )
}

function DemoBar() {
  const [running, setRunning] = useState(false)
  const trigger = async (scenario) => {
    setRunning(true)
    try {
      await fetch(`http://localhost:8000/demo/scenario?scenario=${scenario}`, { method: 'POST' })
    } finally {
      setTimeout(() => setRunning(false), 3000)
    }
  }
  return (
    <div className="demo-bar">
      <span>Demo Scenarios:</span>
      <button className="scenario before" onClick={()=>trigger('before')}>▶ Before CrowdShield</button>
      <button className="scenario after" onClick={()=>trigger('after')}>▶ After CrowdShield</button>
      {running && <span className="demo-note">● Demo running...</span>}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('map')
  const [auto, setAuto] = useState(false)
  const {
    events, history, connectionStatus, totalEventsReceived,
    simulateEvent, startAutoSimulate, stopAutoSimulate
  } = useRiskEvents()

  return (
    <div className="app-shell">
      <Header tab={tab} setTab={setTab} status={connectionStatus} count={totalEventsReceived}/>
      <div className="main-content">
        {tab==='map' && <MapView events={events}/>}
        {tab==='analytics' && <TrendView events={events} history={history}/>}
        {tab==='twin' && <DigitalTwin events={events}/>}
      </div>
      {import.meta.env.DEV && (
        <div className="dev-tools">
          <b>DEV TOOLS</b>
          <button onClick={simulateEvent}>Simulate Event</button>
          <button className={auto?'stop':''} onClick={()=>{
            auto ? stopAutoSimulate() : startAutoSimulate()
            setAuto(!auto)
          }}>{auto?'Stop Stream':'Auto-Simulate'}</button>
        </div>
      )}
    </div>
  )
}
