import React from 'react';
import { Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

/**
 * RawEventStream — warm terminal-style JSON viewer.
 */
export function RawEventStream({ lastEvent }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!lastEvent) {
    return (
      <div
        className="cs-card p-5 text-center text-sm text-secondary"
        style={{ fontFamily: 'Google Sans, monospace' }}
      >
        <Terminal className="w-5 h-5 mx-auto mb-2 text-muted" />
        Waiting for incoming WebSocket events…
      </div>
    );
  }

  return (
    <div className="cs-card overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-[var(--cs-pearl-dark)]"
        style={{ borderBottom: isOpen ? '1px solid var(--card-border)' : 'none' }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Terminal className="w-4 h-4" style={{ color: 'var(--cs-salmon)' }} />
          Latest Event Payload (JSON)
          <span
            className="badge badge-slate ml-1"
            style={{ fontFamily: 'Google Sans, monospace', fontSize: 10 }}
          >
            {lastEvent.zone_id} · {lastEvent.risk_level}
          </span>
        </div>
        {isOpen
          ? <ChevronUp className="w-4 h-4 text-muted" />
          : <ChevronDown className="w-4 h-4 text-muted" />
        }
      </button>

      {isOpen && (
        <div
          className="p-5 overflow-x-auto max-h-64"
          style={{ background: 'var(--cs-pewter)', borderRadius: '0 0 16px 16px' }}
        >
          <pre
            className="text-xs leading-relaxed"
            style={{
              color:       '#DAC2B2',
              fontFamily:  'Google Sans, monospace',
              whiteSpace:  'pre-wrap',
              wordBreak:   'break-all',
            }}
          >
            {JSON.stringify(lastEvent, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
