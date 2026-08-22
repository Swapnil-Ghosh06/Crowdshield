import React from 'react';
import { MapView } from '../components/MapView';
import { StatCard } from '../components/StatCard';
import { ZoneCard } from '../components/ZoneCard';
import { RawEventStream } from '../components/RawEventStream';
import { Activity, Radio, Layers, ShieldAlert, Info } from 'lucide-react';

export function LiveMapPage({ events, connectionStatus, totalEvents, lastEvent, highestRisk, simulateEvent }) {
  const zoneList = Array.from(events.values());

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* ── Stat Cards Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Telemetry Link"
          value={connectionStatus.toUpperCase()}
          subtext="ws://localhost:8000"
          icon={Activity}
          color={connectionStatus === 'connected' ? 'emerald' : connectionStatus === 'connecting' ? 'amber' : 'rose'}
          badge="Live Feed"
        />
        <StatCard
          title="Events Processed"
          value={totalEvents}
          subtext="WebSocket payload stream"
          icon={Radio}
          color="blue"
          badge="3s Interval"
        />
        <StatCard
          title="Monitored Gates"
          value={events.size}
          subtext="Active sensor zones"
          icon={Layers}
          color="slate"
        />
        <StatCard
          title="Maximum Threat"
          value={highestRisk}
          subtext="Real-time alert status"
          icon={ShieldAlert}
          color={highestRisk === 'CRITICAL' ? 'rose' : highestRisk === 'HIGH' ? 'amber' : 'emerald'}
        />
      </div>

      {/* ── Map ── */}
      <div className="h-[calc(100vh-280px)] min-h-[580px]">
        <MapView events={events} />
      </div>

      {/* ── Zone Telemetry Cards ── */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            Live Zone Telemetry &amp; Actuators
          </h2>
          <span className="badge badge-slate font-mono">
            {zoneList.length} Zone{zoneList.length !== 1 ? 's' : ''} Active
          </span>
        </div>

        {zoneList.length === 0 ? (
          <div className="cs-card p-10 text-center space-y-3 border-dashed border-2 border-slate-200">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Info className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Waiting for Stream Telemetry</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Connecting to WebSocket backend at <code className="font-mono text-blue-600 font-semibold">ws://localhost:8000/ws/risk-events</code>.
            </p>
            {import.meta.env.DEV && (
              <button onClick={simulateEvent} className="btn-primary mx-auto mt-2 text-xs">
                Inject Test Event
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
