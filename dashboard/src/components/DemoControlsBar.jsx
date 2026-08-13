import React, { useState } from 'react';
import { Play, Loader2, CheckCircle2 } from 'lucide-react';

export function DemoControlsBar() {
  const [loadingScenario, setLoadingScenario] = useState(null);
  const [statusMessage,   setStatusMessage]   = useState(null);

  const playScenario = async (scenarioType) => {
    setLoadingScenario(scenarioType);
    setStatusMessage('Running…');
    try {
      const res = await fetch(
        `http://localhost:8000/demo/scenario?scenario=${scenarioType}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      setStatusMessage(res.ok ? `"${scenarioType.toUpperCase()}" active` : `Error ${res.status}`);
    } catch {
      setStatusMessage(`"${scenarioType.toUpperCase()}" sent`);
    } finally {
      setTimeout(() => setLoadingScenario(null), 800);
    }
  };

  return (
    <div style={{
      background:  '#FFFFFF',
      border:      '1px solid var(--card-border)',
      borderLeft:  '4px solid var(--cs-salmon)',
      borderRadius:16,
      padding:     '14px 20px',
      display:     'flex',
      flexWrap:    'wrap',
      alignItems:  'center',
      justifyContent: 'space-between',
      gap:         16,
      boxShadow:   'var(--card-shadow)',
    }}>
      {/* Left — info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width:          36,
          height:         36,
          background:     'var(--cs-salmon-light)',
          border:         '1px solid rgba(191,137,127,0.2)',
          borderRadius:   10,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          flexShrink:     0,
        }}>
          <Play size={15} color="var(--cs-salmon)" style={{ marginLeft: 2 }} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily:  'Montserrat, sans-serif',
              fontWeight:  700,
              fontSize:    13,
              color:       'var(--cs-pewter)',
            }}>Presentation Controls</span>
            <span style={{
              fontFamily:    'Montserrat, sans-serif',
              fontWeight:    700,
              fontSize:      9,
              color:         'var(--cs-salmon-dark)',
              background:    'var(--cs-salmon-light)',
              border:        '1px solid rgba(191,137,127,0.28)',
              borderRadius:  99,
              padding:       '2px 8px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>3-min replay</span>
          </div>
          <p style={{
            fontFamily: 'Google Sans, sans-serif',
            fontSize:   11,
            color:      'var(--cs-slate)',
            marginTop:  2,
          }}>
            Replay live camera feed telemetry scenarios to WebSocket listeners.
          </p>
        </div>
      </div>

      {/* Right — controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {statusMessage && (
          <span style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          6,
            fontFamily:   'Google Sans, monospace',
            fontSize:     12,
            color:        'var(--cs-slate)',
            background:   'var(--cs-pearl-dark)',
            border:       '1px solid var(--card-border)',
            borderRadius: 8,
            padding:      '6px 12px',
          }}>
            {loadingScenario
              ? <Loader2 size={12} color="var(--cs-salmon)" className="animate-spin" />
              : <CheckCircle2 size={12} color="var(--risk-low)" />
            }
            {statusMessage}
          </span>
        )}

        <button
          disabled={!!loadingScenario}
          onClick={() => playScenario('before')}
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          8,
            padding:      '9px 16px',
            background:   'var(--risk-critical-bg)',
            color:        'var(--risk-critical)',
            fontFamily:   'Montserrat, sans-serif',
            fontWeight:   700,
            fontSize:     12,
            border:       '1px solid rgba(176,40,40,0.22)',
            borderRadius: 10,
            cursor:       'pointer',
            transition:   'all 0.15s',
            opacity:      loadingScenario ? 0.6 : 1,
          }}
          onMouseEnter={e => { if (!loadingScenario) e.currentTarget.style.background = '#F9C8C8'; }}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--risk-critical-bg)'}
        >
          {loadingScenario === 'before'
            ? <Loader2 size={13} className="animate-spin" />
            : <Play size={13} style={{ fill: 'currentColor' }} />
          }
          BEFORE — No CrowdShield
        </button>

        <button
          disabled={!!loadingScenario}
          onClick={() => playScenario('after')}
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          8,
            padding:      '9px 16px',
            background:   'var(--risk-low-bg)',
            color:        'var(--risk-low)',
            fontFamily:   'Montserrat, sans-serif',
            fontWeight:   700,
            fontSize:     12,
            border:       '1px solid rgba(74,155,111,0.28)',
            borderRadius: 10,
            cursor:       'pointer',
            transition:   'all 0.15s',
            opacity:      loadingScenario ? 0.6 : 1,
          }}
          onMouseEnter={e => { if (!loadingScenario) e.currentTarget.style.background = '#C9ECDA'; }}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--risk-low-bg)'}
        >
          {loadingScenario === 'after'
            ? <Loader2 size={13} className="animate-spin" />
            : <Play size={13} style={{ fill: 'currentColor' }} />
          }
          AFTER — CrowdShield Active
        </button>
      </div>
    </div>
  );
}
