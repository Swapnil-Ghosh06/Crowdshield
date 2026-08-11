import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

export function ConnectionStatusBadge({ status, reconnectCount, onReconnect }) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-400 shadow-[0_0_10px_#34d399]',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          label: 'CONNECTED',
          subtext: 'ws://localhost:8000/ws/risk-events'
        };
      case 'connecting':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-400 animate-ping shadow-[0_0_10px_#fbbf24]',
          icon: <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />,
          label: 'CONNECTING...',
          subtext: 'Attempting connection'
        };
      case 'disconnected':
      default:
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-500 shadow-[0_0_10px_#f43f5e]',
          icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
          label: 'DISCONNECTED',
          subtext: 'Auto-reconnect in 3s'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold tracking-wider transition-all duration-300 ${config.bg}`}>
        <span className="relative flex h-2.5 w-2.5">
          <span className={`inline-flex rounded-full h-2.5 w-2.5 ${config.dot}`} />
        </span>
        <div className="flex items-center gap-1.5">
          {config.icon}
          <span>{config.label}</span>
        </div>
        <span className="text-[10px] opacity-65 border-l border-current/20 pl-2 font-mono">
          {config.subtext}
        </span>
      </div>

      {status === 'disconnected' && (
        <button
          onClick={onReconnect}
          className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
          title="Retry Connection Now"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      )}

      {reconnectCount > 0 && (
        <span className="text-[11px] text-slate-400 font-mono bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
          Retries: {reconnectCount}
        </span>
      )}
    </div>
  );
}
