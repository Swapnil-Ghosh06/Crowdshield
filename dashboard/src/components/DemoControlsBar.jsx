import React, { useState } from 'react';
import { Play, PlayCircle, Loader2, CheckCircle2 } from 'lucide-react';

/**
 * DemoControlsBar — premium scenario trigger strip.
 */
export function DemoControlsBar() {
  const [loadingScenario, setLoadingScenario] = useState(null);
  const [statusMessage,   setStatusMessage]   = useState(null);

  const playScenario = async (scenarioType) => {
    setLoadingScenario(scenarioType);
    setStatusMessage('Running scenario…');

    try {
      const res = await fetch(
        `http://localhost:8000/demo/scenario?scenario=${scenarioType}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      setStatusMessage(
        res.ok
          ? `Scenario "${scenarioType.toUpperCase()}" active`
          : `Server error (${res.status})`
      );
    } catch {
      setStatusMessage(`Triggered "${scenarioType.toUpperCase()}" request`);
    } finally {
      setTimeout(() => setLoadingScenario(null), 800);
    }
  };

  return (
    <div
      className="cs-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      style={{ borderLeft: '4px solid var(--cs-salmon)' }}
    >
      {/* Left — label */}
      <div className="flex items-center gap-3">
        <div
          className="p-2.5 rounded-xl shrink-0"
          style={{ background: 'var(--cs-salmon-light)', color: 'var(--cs-salmon)' }}
        >
          <PlayCircle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-primary flex items-center gap-2">
            Presentation Controls
            <span className="badge badge-salmon">3-min replay</span>
          </h3>
          <p className="text-xs text-secondary mt-0.5">
            Replay live camera feed telemetry scenarios to WebSocket listeners.
          </p>
        </div>
      </div>

      {/* Right — controls */}
      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
        {/* Status feedback */}
        {statusMessage && (
          <span
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{
              background: 'var(--page-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--cs-slate)',
              fontFamily: 'Google Sans, monospace',
            }}
          >
            {loadingScenario ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--cs-salmon)' }} />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--risk-low)' }} />
            )}
            {statusMessage}
          </span>
        )}

        {/* BEFORE button */}
        <button
          disabled={loadingScenario !== null}
          onClick={() => playScenario('before')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          style={{
            background:   'var(--risk-critical-bg)',
            borderColor:  'rgba(176,40,40,0.25)',
            color:        'var(--risk-critical)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#F9C8C8'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--risk-critical-bg)'}
        >
          {loadingScenario === 'before' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          BEFORE — No CrowdShield
        </button>

        {/* AFTER button */}
        <button
          disabled={loadingScenario !== null}
          onClick={() => playScenario('after')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          style={{
            background:  'var(--risk-low-bg)',
            borderColor: 'rgba(74,155,111,0.3)',
            color:       'var(--risk-low)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#C9ECDA'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--risk-low-bg)'}
        >
          {loadingScenario === 'after' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          AFTER — CrowdShield Active
        </button>
      </div>
    </div>
  );
}
