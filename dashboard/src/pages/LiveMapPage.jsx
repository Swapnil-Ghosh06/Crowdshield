import React from 'react';
import { MapView } from '../components/MapView';
import { RiskSidebar } from '../components/RiskSidebar';
import { StatCard } from '../components/StatCard';
import { ZoneCard } from '../components/ZoneCard';
import { RawEventStream } from '../components/RawEventStream';
import { Activity, Radio, Layers, ShieldAlert, Info } from 'lucide-react';

export function LiveMapPage({ events, connectionStatus, totalEvents, lastEvent, reconnectCount, highestRisk, simulateEvent }) {
  const zoneList = Array.from(events.values());

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* ── Stat Cards Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Connection"
          value={connectionStatus.toUpperCase()}
          subtext="ws://localhost:8000"
          icon={Activity}
          color={connectionStatus === 'connected' ? 'emerald' : connectionStatus === 'connecting' ? 'amber' : 'rose'}
          badge="Auto-reconnect 3s"
        />
        <StatCard
          title="Events Received"
          value={totalEvents}
          subtext="Total WebSocket payloads"
          icon={Radio}
          color="salmon"
          badge="LIVE"
        />
        <StatCard
          title="Monitored Zones"
          value={events.size}
          subtext="Active zone count"
          icon={Layers}
          color="slate"
        />
        <StatCard
          title="Highest Risk"
          value={highestRisk}
          subtext="Current maximum threat"
          icon={ShieldAlert}
          color={highestRisk === 'CRITICAL' ? 'rose' : highestRisk === 'HIGH' ? 'amber' : 'emerald'}
        />
      </div>

      {/* ── Map + Sidebar ── */}
      <div className="flex flex-col lg:flex-row gap-5 h-[calc(100vh-320px)] min-h-[560px]">
        <div className="w-full lg:w-[65%] h-full">
          <MapView events={events} />
        </div>
        <div className="w-full lg:w-[35%] h-full">
          <RiskSidebar events={events} />
        </div>
      </div>

      {/* ── Zone Grid ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <Layers className="w-5 h-5" style={{ color: 'var(--cs-salmon)' }} />
            Active Zone Telemetry
          </h2>
          <span className="badge badge-slate" style={{ fontFamily: 'Google Sans, monospace' }}>
            {zoneList.length} zone{zoneList.length !== 1 ? 's' : ''} active
          </span>
        </div>

        {zoneList.length === 0 ? (
          <div className="cs-card p-12 text-center space-y-3">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
              style={{ background: 'var(--cs-salmon-light)', color: 'var(--cs-salmon)' }}
            >
              <Info className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-primary">No Zone Events Yet</h3>
            <p className="text-sm text-secondary max-w-md mx-auto">
              Connecting to <code style={{ fontFamily: 'Google Sans, monospace', color: 'var(--cs-salmon)' }}>ws://localhost:8000/ws/risk-events</code>.
              Zone cards will appear automatically when events arrive.
            </p>
            {import.meta.env.DEV && (
              <button onClick={simulateEvent} className="btn-primary mx-auto mt-2">
                Trigger Test Event
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zoneList.map((zoneEvent) => (
              <ZoneCard key={zoneEvent.zone_id} event={zoneEvent} />
            ))}
          </div>
        )}
      </div>

      {/* ── Raw Event Stream ── */}
      <RawEventStream lastEvent={lastEvent} />
    </div>
  );
}
