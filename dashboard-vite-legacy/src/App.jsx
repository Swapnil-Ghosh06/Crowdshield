import React, { useState, useEffect } from 'react';
import { useRiskEvents } from './hooks/useRiskEvents';
import { ConnectionStatusBadge } from './components/ConnectionStatusBadge';
import { LiveMapPage } from './pages/LiveMapPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DigitalTwinPage } from './pages/DigitalTwinPage';
import { ShieldCheck, Map, TrendingUp, Layers } from 'lucide-react';

/* ─── Tab definitions ────────────────────────────────────── */
const TABS = [
  { label: 'Live Map', Icon: Map },
  { label: 'Analytics', Icon: TrendingUp },
  { label: 'Digital Twin', Icon: Layers },
];

/* ─── App ────────────────────────────────────────────────── */
export default function App() {
  const {
    events, history, connectionStatus, totalEvents,
    lastEvent, reconnectCount, simulateEvent, reconnect,
  } = useRiskEvents('ws://localhost:8000/ws/risk-events');

  const [activeTab, setActiveTab] = useState(0);
  const [autoSimulate, setAutoSimulate] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV || !autoSimulate) return;
    const id = setInterval(() => simulateEvent(), 3000);
    return () => clearInterval(id);
  }, [autoSimulate, simulateEvent]);

  const zoneList = Array.from(events.values());
  const getHighestRisk = () => {
    if (!zoneList.length) return 'None';
    if (zoneList.some(z => z.risk_level === 'critical')) return 'CRITICAL';
    if (zoneList.some(z => z.risk_level === 'high')) return 'HIGH';
    if (zoneList.some(z => z.risk_level === 'medium')) return 'MEDIUM';
    return 'LOW';
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ════════════════════════════════════════════════════════
          HEADER
      ════════════════════════════════════════════════════════ */}
      <header style={{
        background: '#FFFFFF',
        borderBottom: '1px solid var(--card-border)',
        boxShadow: '0 2px 12px rgba(58,61,58,0.06)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 32px',
          height: 70,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}>

          {/* ── Brand ───────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: 'var(--cs-salmon-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(191,137,127,0.22)',
            }}>
              <ShieldCheck size={18} color="var(--cs-salmon)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 17,
                  color: 'var(--cs-pewter)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}>CrowdShield</span>
                <span style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 700,
                  fontSize: 9,
                  color: 'var(--cs-salmon-dark)',
                  background: 'var(--cs-salmon-light)',
                  border: '1px solid rgba(191,137,127,0.28)',
                  borderRadius: 99,
                  padding: '2px 7px',
                  letterSpacing: '0.04em',
                }}>PRO V1.0</span>
              </div>
              <p style={{
                fontFamily: 'Google Sans, sans-serif',
                fontSize: 11,
                color: 'var(--cs-slate-light)',
                marginTop: 3,
                lineHeight: 1,
              }}>Real-Time Crowd Risk &amp; Stampede Intelligence</p>
            </div>
          </div>

          {/* ── Centre Nav Tabs ──────────────────────────────── */}
          <nav style={{ display: 'flex', gap: 4, background: 'var(--cs-pearl-dark)', borderRadius: 14, padding: 4, border: '1px solid var(--card-border)' }}>
            {TABS.map(({ label, Icon }, i) => {
              const active = activeTab === i;
              return (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '8px 18px',
                    borderRadius: 10,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: active ? 700 : 500,
                    fontSize: 13,
                    color: active ? 'var(--cs-pewter)' : 'var(--cs-slate)',
                    background: active ? '#FFFFFF' : 'transparent',
                    boxShadow: active ? '0 2px 8px rgba(58,61,58,0.10)' : 'none',
                    transition: 'all 0.18s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon size={14} color={active ? 'var(--cs-salmon)' : 'var(--cs-slate-light)'} />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* ── Right side ───────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <ConnectionStatusBadge
              status={connectionStatus}
              reconnectCount={reconnectCount}
              onReconnect={reconnect}
            />

            {import.meta.env.DEV && (
              <>
                <button
                  onClick={() => simulateEvent()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    background: 'var(--cs-salmon)',
                    color: 'white',
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 700,
                    fontSize: 12,
                    border: 'none',
                    borderRadius: 9,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(191,137,127,0.35)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--cs-salmon-dark)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--cs-salmon)'}
                >
                  ⊕ Simulate
                </button>
                <button
                  onClick={() => setAutoSimulate(!autoSimulate)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    background: autoSimulate ? 'var(--cs-salmon-light)' : 'transparent',
                    color: autoSimulate ? 'var(--cs-salmon-dark)' : 'var(--cs-slate)',
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 600,
                    fontSize: 12,
                    border: `1px solid ${autoSimulate ? 'var(--cs-sandstone)' : 'var(--card-border)'}`,
                    borderRadius: 9,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  ✦ {autoSimulate ? 'Auto ON' : 'Auto'}
                </button>
              </>
            )}
          </div>

        </div>
      </header>


      {/* ════════════════════════════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════════════════════════════ */}
      <main style={{ maxWidth: 1280, width: '100%', margin: '0 auto', padding: '20px 32px 48px', flex: 1 }}>
        {activeTab === 0 && (
          <LiveMapPage
            events={events}
            connectionStatus={connectionStatus}
            totalEvents={totalEvents}
            lastEvent={lastEvent}
            reconnectCount={reconnectCount}
            highestRisk={getHighestRisk()}
            simulateEvent={simulateEvent}
          />
        )}
        {activeTab === 1 && (
          <AnalyticsPage history={history} events={events} lastEvent={lastEvent} />
        )}
        {activeTab === 2 && (
          <DigitalTwinPage events={events} />
        )}
      </main>

      {/* ════════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════════ */}
      <footer style={{
        borderTop: '1px solid var(--card-border)',
        background: '#FFFFFF',
        padding: '14px 32px',
        textAlign: 'center',
        fontFamily: 'Google Sans, monospace',
        fontSize: 11,
        color: 'var(--cs-slate-light)',
        letterSpacing: '0.01em',
      }}>
        CrowdShield Risk Monitoring &nbsp;·&nbsp; React, Vite, Tailwind CSS v4, Leaflet &amp; Recharts &nbsp;·&nbsp; Auto-reconnect 3s
      </footer>
    </div>
  );
}
