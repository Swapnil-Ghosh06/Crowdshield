import React from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

export function ConnectionStatusBadge({ status, reconnectCount, onReconnect }) {
  const cfgMap = {
    connected: {
      bg:    '#E8F5EE', border: '#B8DFC8', color: '#3A7D57',
      dot:   '#4A9B6F', icon: <CheckCircle2 size={13} />,
      label: 'Connected', sub: 'ws://localhost:8000',
    },
    connecting: {
      bg:    '#FDF0DC', border: '#E9C886', color: '#8A6020',
      dot:   '#C08B3A', icon: <RefreshCw size={13} className="animate-spin" />,
      label: 'Connecting…', sub: 'Attempting',
    },
    disconnected: {
      bg:    '#FCE0E0', border: '#E8A8A8', color: '#8B2020',
      dot:   '#B02828', icon: <AlertTriangle size={13} />,
      label: 'Disconnected', sub: 'Auto 3s',
    },
  };
  const cfg = cfgMap[status] || cfgMap.disconnected;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          8,
        padding:      '7px 14px',
        background:   cfg.bg,
        border:       `1px solid ${cfg.border}`,
        borderRadius: 99,
        color:        cfg.color,
        fontFamily:   'Montserrat, sans-serif',
        fontWeight:   600,
        fontSize:     12,
        whiteSpace:   'nowrap',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: cfg.dot,
          display: 'inline-block',
          boxShadow: status === 'connected' ? `0 0 6px ${cfg.dot}80` : 'none',
          flexShrink: 0,
        }} />
        {cfg.icon}
        <span>{cfg.label}</span>
        <span style={{
          opacity:    0.65,
          borderLeft: '1px solid currentColor',
          paddingLeft: 8,
          fontFamily: 'Google Sans, monospace',
          fontWeight: 400,
          fontSize:   10,
        }}>{cfg.sub}</span>
      </div>

      {status === 'disconnected' && (
        <button
          onClick={onReconnect}
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          5,
            padding:      '7px 12px',
            background:   'transparent',
            color:        'var(--cs-slate)',
            fontFamily:   'Montserrat, sans-serif',
            fontWeight:   600,
            fontSize:     11,
            border:       '1px solid var(--card-border)',
            borderRadius: 8,
            cursor:       'pointer',
          }}
        >
          <RefreshCw size={12} /> Retry
        </button>
      )}

      {reconnectCount > 0 && (
        <span style={{
          fontFamily:    'Google Sans, monospace',
          fontWeight:    700,
          fontSize:      10,
          color:         'var(--cs-slate)',
          background:    'rgba(112,123,109,0.1)',
          border:        '1px solid rgba(112,123,109,0.2)',
          borderRadius:  99,
          padding:       '3px 8px',
        }}>×{reconnectCount}</span>
      )}
    </div>
  );
}
