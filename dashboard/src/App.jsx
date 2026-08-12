import React, { useState, useEffect } from 'react';
import { useRiskEvents } from './hooks/useRiskEvents';
import { ConnectionStatusBadge } from './components/ConnectionStatusBadge';
import { DemoControlsBar } from './components/DemoControlsBar';
import { AnimatedTabBar } from './components/ui/animated-tab-bar';
import { LiveMapPage } from './pages/LiveMapPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DigitalTwinPage } from './pages/DigitalTwinPage';
import { PlusCircle, Sparkles, ShieldCheck } from 'lucide-react';

/* ─── Tab definitions ────────────────────────────────────── */

const MapIcon = () => (
  <svg className="icon" viewBox="0 0 24 24">
    <path d="M9 20L3 17V4l6 3M9 20l6-3M9 20V7M15 17l6 3V7l-6-3M15 17V4M9 7l6-3" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg className="icon" viewBox="0 0 24 24">
    <path d="M3 3v18h18" />
    <path d="M7 16l4-4 4 4 4-6" />
  </svg>
);

const DigitalTwinIcon = () => (
  <svg className="icon" viewBox="0 0 24 24">
    <rect x="4" y="4" width="6" height="6" rx="1" />
    <rect x="14" y="4" width="6" height="6" rx="1" />
    <rect x="4" y="14" width="6" height="6" rx="1" />
    <rect x="14" y="14" width="6" height="6" rx="1" />
    <path d="M10 7h4M7 10v4M17 10v4M10 17h4" />
  </svg>
);

const TAB_ITEMS = [
  { icon: <MapIcon />,          color: '#BF897F', label: 'Live Map'      },
  { icon: <AnalyticsIcon />,    color: '#707B6D', label: 'Analytics'     },
  { icon: <DigitalTwinIcon />,  color: '#A67269', label: 'Digital Twin'  },
];

const TAB_LABELS = ['Live Map', 'Analytics', 'Digital Twin'];

/* ─── App ────────────────────────────────────────────────── */
export default function App() {
  const {
    events, history, connectionStatus, totalEvents,
    lastEvent, reconnectCount, simulateEvent, reconnect,
  } = useRiskEvents('ws://localhost:8000/ws/risk-events');

  const [activeTab,     setActiveTab]     = useState(0);
  const [autoSimulate,  setAutoSimulate]  = useState(false);

  // Auto-simulation (DEV only)
  useEffect(() => {
    if (!import.meta.env.DEV || !autoSimulate) return;
    const interval = setInterval(() => simulateEvent(), 3000);
    return () => clearInterval(interval);
  }, [autoSimulate, simulateEvent]);

  const zoneList = Array.from(events.values());

  const getHighestRisk = () => {
    if (!zoneList.length) return 'None';
    if (zoneList.some((z) => z.risk_level === 'critical')) return 'CRITICAL';
    if (zoneList.some((z) => z.risk_level === 'high'))     return 'HIGH';
    if (zoneList.some((z) => z.risk_level === 'medium'))   return 'MEDIUM';
    return 'LOW';
  };

  const highestRisk = getHighestRisk();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>

      {/* ═══════════════════════════════════════════════════════
          TOP HEADER BAR
      ═══════════════════════════════════════════════════════ */}
      <header
        style={{
          background:   '#FFFFFF',
          borderBottom: '1px solid var(--card-border)',
          boxShadow:    '0 1px 12px rgba(58,61,58,0.06)',
          position:     'sticky',
          top:          0,
          zIndex:       50,
        }}
      >
        <div
          className="max-w-7xl mx-auto px-5 sm:px-8"
          style={{ height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
        >
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
              style={{ background: 'var(--cs-salmon-light)', color: 'var(--cs-salmon)' }}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold text-primary tracking-tight leading-none">
                  CrowdShield
                </span>
                <span
                  className="badge badge-salmon"
                  style={{ fontSize: 10, padding: '2px 8px' }}
                >
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-muted leading-none mt-0.5" style={{ fontFamily: 'Google Sans, sans-serif' }}>
                Real-time crowd risk telemetry
              </p>
            </div>
          </div>

          {/* Right side — tab label + connection badge */}
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Current tab label (hidden on very small) */}
            <span
              className="hidden sm:block text-sm font-semibold text-secondary"
              style={{ whiteSpace: 'nowrap' }}
            >
              {TAB_LABELS[activeTab]}
            </span>

            <ConnectionStatusBadge
              status={connectionStatus}
              reconnectCount={reconnectCount}
              onReconnect={reconnect}
            />

            {/* DEV simulate buttons */}
            {import.meta.env.DEV && (
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => simulateEvent()}
                  className="btn-primary"
                  style={{ padding: '7px 12px', fontSize: 12 }}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Simulate
                </button>
                <button
                  onClick={() => setAutoSimulate(!autoSimulate)}
                  className="btn-ghost"
                  style={{
                    padding:     '7px 12px',
                    fontSize:    12,
                    background:  autoSimulate ? 'var(--cs-salmon-light)' : undefined,
                    color:       autoSimulate ? 'var(--cs-salmon-dark)' : undefined,
                    borderColor: autoSimulate ? 'var(--cs-sandstone)'   : undefined,
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {autoSimulate ? 'Auto ON' : 'Auto'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════
          ANIMATED TAB BAR NAV
      ═══════════════════════════════════════════════════════ */}
      <nav
        className="sticky top-[68px] z-40"
        style={{
          background:   'var(--page-bg)',
          borderBottom: '1px solid var(--card-border)',
          padding:      '12px 0',
        }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center justify-between gap-4">
          {/* AnimatedTabBar — centred, fixed width */}
          <div className="flex-1 flex justify-center">
            <div style={{ width: '100%', maxWidth: 360 }}>
              <AnimatedTabBar
                items={TAB_ITEMS}
                defaultIndex={activeTab}
                onTabChange={setActiveTab}
              />
            </div>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════
          DEMO CONTROLS BAR
      ═══════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-5">
        <DemoControlsBar />
      </div>

      {/* ═══════════════════════════════════════════════════════
          MAIN CONTENT — PAGE SWITCH
      ═══════════════════════════════════════════════════════ */}
      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-5 pb-12">
        {activeTab === 0 && (
          <LiveMapPage
            events={events}
            connectionStatus={connectionStatus}
            totalEvents={totalEvents}
            lastEvent={lastEvent}
            reconnectCount={reconnectCount}
            highestRisk={highestRisk}
            simulateEvent={simulateEvent}
          />
        )}
        {activeTab === 1 && (
          <AnalyticsPage
            history={history}
            events={events}
            lastEvent={lastEvent}
          />
        )}
        {activeTab === 2 && (
          <DigitalTwinPage events={events} />
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════ */}
      <footer
        className="text-center text-xs text-muted py-5"
        style={{
          borderTop:    '1px solid var(--card-border)',
          fontFamily:   'Google Sans, monospace',
          background:   '#FFFFFF',
        }}
      >
        CrowdShield Risk Monitoring &nbsp;·&nbsp; React, Vite, Tailwind CSS, Leaflet &amp; Recharts &nbsp;·&nbsp; Auto-reconnect: 3s
      </footer>
    </div>
  );
}
