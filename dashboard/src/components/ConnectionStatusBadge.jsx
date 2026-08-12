import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

/**
 * ConnectionStatusBadge — light-themed connection indicator.
 */
export function ConnectionStatusBadge({ status, reconnectCount, onReconnect }) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          pill:   'bg-[#E8F5EE] border-[#B8DFC8] text-[#4A9B6F]',
          dot:    'bg-[#4A9B6F] shadow-[0_0_8px_rgba(74,155,111,0.5)]',
          icon:   <CheckCircle2 className="w-3.5 h-3.5" />,
          label:  'Connected',
          sub:    'ws://localhost:8000',
        };
      case 'connecting':
        return {
          pill:   'bg-[#FDF0DC] border-[#E9C886] text-[#C08B3A]',
          dot:    'bg-[#C08B3A] animate-pulse',
          icon:   <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
          label:  'Connecting…',
          sub:    'Attempting connection',
        };
      case 'disconnected':
      default:
        return {
          pill:   'bg-[#FCE0E0] border-[#E8A8A8] text-[#B02828]',
          dot:    'bg-[#B02828] shadow-[0_0_8px_rgba(176,40,40,0.45)]',
          icon:   <AlertTriangle className="w-3.5 h-3.5" />,
          label:  'Disconnected',
          sub:    'Auto-reconnect in 3s',
        };
    }
  };

  const cfg = getStatusConfig();

  return (
    <div className="flex items-center gap-2.5">
      {/* Status pill */}
      <div className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-semibold tracking-wide transition-all duration-300 ${cfg.pill}`}>
        {/* Live dot */}
        <span className="relative flex h-2 w-2 shrink-0">
          <span className={`inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
        </span>
        {cfg.icon}
        <span>{cfg.label}</span>
        <span className="opacity-60 border-l border-current pl-2 font-normal text-[10px]" style={{ fontFamily: 'Google Sans, monospace' }}>
          {cfg.sub}
        </span>
      </div>

      {/* Retry button — only when disconnected */}
      {status === 'disconnected' && (
        <button
          onClick={onReconnect}
          className="btn-ghost text-xs"
          title="Retry connection"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      )}

      {/* Reconnect counter */}
      {reconnectCount > 0 && (
        <span className="badge badge-slate" style={{ fontFamily: 'Google Sans, monospace' }}>
          ×{reconnectCount} retries
        </span>
      )}
    </div>
  );
}
