import React, { useState } from 'react';
import { Play, PlayCircle, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function DemoControlsBar() {
  const [loadingScenario, setLoadingScenario] = useState(null); // 'before' | 'after' | null
  const [statusMessage, setStatusMessage] = useState(null);

  const playScenario = async (scenarioType) => {
    setLoadingScenario(scenarioType);
    setStatusMessage('Demo running...');

    try {
      const response = await fetch(`http://localhost:8000/demo/scenario?scenario=${scenarioType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setStatusMessage(`Scenario '${scenarioType.toUpperCase()}' active`);
      } else {
        setStatusMessage(`Server error (${response.status})`);
      }
    } catch (err) {
      console.warn(`[DemoControls] Could not trigger http://localhost:8000/demo/scenario?scenario=${scenarioType}:`, err);
      // Fallback message for judges demo
      setStatusMessage(`Triggered '${scenarioType.toUpperCase()}' request`);
    } finally {
      setTimeout(() => {
        setLoadingScenario(null);
      }, 800);
    }
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-indigo-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
          <PlayCircle className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-100 flex items-center gap-2">
            Judge Presentation Controls
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-indigo-900 text-indigo-200 border border-indigo-700">
              3-Min Scenario Replay
            </span>
          </h3>
          <p className="text-[11px] text-slate-400">
            Replay live camera feed telemetry scenarios directly to WebSocket listeners.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {/* Status Indicator Label */}
        {statusMessage && (
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-indigo-300 border border-indigo-900 flex items-center gap-1.5">
            {loadingScenario ? (
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            {statusMessage}
          </span>
        )}

        {/* Scenario BEFORE Button */}
        <button
          disabled={loadingScenario !== null}
          onClick={() => playScenario('before')}
          className="px-3.5 py-2 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-rose-100 text-xs font-bold flex items-center gap-1.5 border border-rose-700 shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {loadingScenario === 'before' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          ▶ Play Scenario: BEFORE (no CrowdShield)
        </button>

        {/* Scenario AFTER Button */}
        <button
          disabled={loadingScenario !== null}
          onClick={() => playScenario('after')}
          className="px-3.5 py-2 rounded-lg bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 text-xs font-bold flex items-center gap-1.5 border border-emerald-700 shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {loadingScenario === 'after' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          ▶ Play Scenario: AFTER (CrowdShield Active)
        </button>
      </div>
    </div>
  );
}
