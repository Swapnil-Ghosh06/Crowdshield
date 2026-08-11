import React, { useState } from 'react';
import { Terminal, Code, ChevronDown, ChevronUp } from 'lucide-react';

export function RawEventStream({ lastEvent }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!lastEvent) {
    return (
      <div className="glass-panel rounded-xl p-4 border border-slate-800 text-center text-xs text-slate-500 font-mono">
        Waiting for incoming WebSocket events...
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-300">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>Latest Event Payload (JSON)</span>
          <span className="text-[10px] text-slate-500 font-normal">
            ({lastEvent.zone_id} • {lastEvent.risk_level})
          </span>
        </div>
        <button className="text-slate-400 hover:text-slate-200">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isOpen && (
        <div className="p-4 bg-slate-950/90 font-mono text-xs text-slate-300 overflow-x-auto max-h-64">
          <pre className="text-slate-300">
            {JSON.stringify(lastEvent, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
