import React, { useState, useEffect } from 'react';
import { useRiskEvents } from './hooks/useRiskEvents';
import { ConnectionStatusBadge } from './components/ConnectionStatusBadge';
import { StatCard } from './components/StatCard';
import { ZoneCard } from './components/ZoneCard';
import { RawEventStream } from './components/RawEventStream';
import { MapView } from './components/MapView';
import { RiskSidebar } from './components/RiskSidebar';
import { TrendView } from './components/TrendView';
import { DigitalTwin } from './components/DigitalTwin';
import { DemoControlsBar } from './components/DemoControlsBar';
import { 
  Activity, 
  Radio, 
  Layers, 
  ShieldAlert, 
  PlusCircle, 
  Sparkles, 
  Server, 
  Info,
  Map as MapIcon,
  TrendingUp,
  Cpu
} from 'lucide-react';

export default function App() {
  const {
    events,
    history,
    connectionStatus,
    totalEvents,
    lastEvent,
    reconnectCount,
    simulateEvent,
    reconnect
  } = useRiskEvents('ws://localhost:8000/ws/risk-events');

  const [activeTab, setActiveTab] = useState('liveMap'); // 'liveMap' | 'analytics' | 'digitalTwin'
  const [autoSimulate, setAutoSimulate] = useState(false);

  // Auto simulation timer toggle for easy DEV testing
  useEffect(() => {
    let interval;
    if (import.meta.env.DEV && autoSimulate) {
      interval = setInterval(() => {
        simulateEvent();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoSimulate, simulateEvent]);

  // Convert Map entries to Array for rendering
  const zoneList = Array.from(events.values());

  // Compute highest risk level across active zones
  const getHighestRisk = () => {
    if (zoneList.length === 0) return 'None';
    if (zoneList.some((z) => z.risk_level === 'critical')) return 'CRITICAL';
    if (zoneList.some((z) => z.risk_level === 'high')) return 'HIGH';
    if (zoneList.some((z) => z.risk_level === 'medium')) return 'MEDIUM';
    return 'LOW';
  };

  const highestRisk = getHighestRisk();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Navigation / Header */}
        <header className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Radio className="w-6 h-6 animate-pulse text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  CrowdShield AI
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                    Risk Engine v1.0
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time Density & Flow Speed Risk Telemetry via WebSocket
                </p>
              </div>
            </div>
          </div>

          {/* Connection Status Component */}
          <div className="flex items-center gap-3">
            <ConnectionStatusBadge
              status={connectionStatus}
              reconnectCount={reconnectCount}
              onReconnect={reconnect}
            />
          </div>
        </header>

        {/* Requirements Banner & Status Summary */}
        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-950 border border-indigo-800 text-indigo-400 shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                WebSocket Status Verification
              </div>
              <div className="text-xs text-slate-300 mt-0.5 font-mono">
                Target: <span className="text-indigo-400 font-bold">ws://localhost:8000/ws/risk-events</span>
              </div>
            </div>
          </div>

          {/* Testing controls gated behind import.meta.env.DEV */}
          {import.meta.env.DEV && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => simulateEvent()}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Simulate Event
              </button>

              <button
                onClick={() => setAutoSimulate(!autoSimulate)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  autoSimulate
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                {autoSimulate ? 'Auto-Simulating...' : 'Auto-Simulate Stream'}
              </button>
            </div>
          )}
        </div>

        {/* Demo Controls Bar (Visible on all tabs below the main status bar) */}
        <DemoControlsBar />

        {/* Tab Navigation Bar ("Live Map" | "Analytics" | "Digital Twin") */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
          <button
            onClick={() => setActiveTab('liveMap')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'liveMap'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'bg-slate-900/60 hover:bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            Live Map
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'bg-slate-900/60 hover:bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Analytics
          </button>

          <button
            onClick={() => setActiveTab('digitalTwin')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'digitalTwin'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'bg-slate-900/60 hover:bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            <Cpu className="w-4 h-4" />
            Digital Twin
          </button>
        </div>

        {/* Main Content Area based on Active Tab */}
        {activeTab === 'liveMap' ? (
          /* Split Layout: Map (65%) & Sidebar (35%), full viewport height below status bar */
          <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-210px)] min-h-[580px]">
            {/* Map View: 65% width */}
            <div className="w-full lg:w-[65%] h-full">
              <MapView events={events} />
            </div>

            {/* Risk Sidebar: 35% width */}
            <div className="w-full lg:w-[35%] h-full">
              <RiskSidebar events={events} />
            </div>
          </div>
        ) : activeTab === 'analytics' ? (
          /* Analytics Trend View */
          <TrendView history={history} events={events} />
        ) : (
          /* Digital Twin View */
          <DigitalTwin events={events} />
        )}

        {/* Live Counters & Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Connection Status */}
          <StatCard
            title="Connection Status"
            value={connectionStatus.toUpperCase()}
            subtext="ws://localhost:8000"
            icon={Activity}
            color={
              connectionStatus === 'connected'
                ? 'emerald'
                : connectionStatus === 'connecting'
                ? 'amber'
                : 'rose'
            }
            badge={`Auto-reconnect 3s`}
          />

          {/* Live counter of events received */}
          <StatCard
            title="Events Received"
            value={totalEvents}
            subtext="Total valid WS payloads"
            icon={Radio}
            color="indigo"
            badge="LIVE COUNTER"
          />

          {/* Map size: Active Monitored Zones */}
          <StatCard
            title="Monitored Zones"
            value={events.size}
            subtext="Map state zone count"
            icon={Layers}
            color="cyan"
            badge="Map<zone_id, event>"
          />

          {/* Highest Risk Level */}
          <StatCard
            title="Highest Risk Alert"
            value={highestRisk}
            subtext="Current maximum threat"
            icon={ShieldAlert}
            color={
              highestRisk === 'CRITICAL'
                ? 'rose'
                : highestRisk === 'HIGH'
                ? 'amber'
                : 'emerald'
            }
          />
        </div>

        {/* Monitored Zones Grid Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Active Zone Telemetry Grid
              <span className="text-xs font-mono font-normal text-slate-400">
                (Stored in state Map by zone_id)
              </span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              {zoneList.length} zone(s) active
            </span>
          </div>

          {zoneList.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <Info className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-300">
                No Zone Events Received Yet
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                The hook is attempting to connect to <code className="text-indigo-300">ws://localhost:8000/ws/risk-events</code>.
                When events arrive, zone cards will automatically update here.
              </p>
              {import.meta.env.DEV && (
                <button
                  onClick={() => simulateEvent()}
                  className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" /> Trigger Test Event
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {zoneList.map((zoneEvent) => (
                <ZoneCard key={zoneEvent.zone_id} event={zoneEvent} />
              ))}
            </div>
          )}
        </div>

        {/* Live Payload Raw JSON View */}
        <RawEventStream lastEvent={lastEvent} />

        {/* Footer */}
        <footer className="text-center text-xs text-slate-500 font-mono py-4 border-t border-slate-900">
          CrowdShield Risk Monitoring • Built with React, Vite, Tailwind CSS, Leaflet & Recharts • Auto-reconnect: 3s
        </footer>
      </div>
    </div>
  );
}
