import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

/**
 * RawEventStream — High-tech terminal payload inspector.
 */
export function RawEventStream({ lastEvent }) {
  const [isOpen,  setIsOpen]  = useState(false);
  const [copied,  setCopied]  = useState(false);

  const handleCopy = () => {
    if (!lastEvent) return;
    navigator.clipboard.writeText(JSON.stringify(lastEvent, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!lastEvent) {
    return (
      <div className="cs-card p-4 text-center text-xs text-slate-500 font-mono bg-white border border-slate-200">
        <Terminal className="w-4 h-4 mx-auto mb-1 text-slate-400" />
        Listening for raw WebSocket event payloads…
      </div>
    );
  }

  return (
    <div className="cs-card overflow-hidden bg-white border border-slate-200">
      {/* Toggle header */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-xs font-bold text-slate-800 hover:text-blue-600 transition-colors cursor-pointer"
        >
          <Terminal className="w-4 h-4 text-blue-600" />
          Raw Telemetry Packet (JSON)
          <span className="badge badge-slate font-mono text-[10px] ml-1">
            {lastEvent.zone_id} · {lastEvent.risk_level?.toUpperCase()}
          </span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </button>

        {isOpen && (
          <button
            onClick={handleCopy}
            className="btn-ghost text-[10px] py-1 px-2 flex items-center gap-1 bg-white"
            title="Copy JSON payload"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>

      {isOpen && (
        <div className="p-4 overflow-x-auto max-h-72 bg-slate-950 text-slate-200">
          <pre className="text-xs leading-relaxed font-mono whitespace-pre-wrap word-break-all text-emerald-400">
            {JSON.stringify(lastEvent, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
