import React from 'react';

export function StatCard({ title, value, subtext, icon: Icon, color = 'salmon', badge }) {
  const palettes = {
    salmon:  { iconBg: 'var(--cs-salmon-light)',               iconColor: 'var(--cs-salmon)',      iconBorder: 'rgba(191,137,127,0.2)' },
    slate:   { iconBg: 'rgba(112,123,109,0.08)',                iconColor: 'var(--cs-slate)',        iconBorder: 'rgba(112,123,109,0.18)' },
    emerald: { iconBg: 'var(--risk-low-bg)',                    iconColor: 'var(--risk-low)',        iconBorder: 'var(--risk-low-border)' },
    amber:   { iconBg: 'var(--risk-medium-bg)',                 iconColor: 'var(--risk-medium)',     iconBorder: 'var(--risk-medium-border)' },
    rose:    { iconBg: 'var(--risk-critical-bg)',               iconColor: 'var(--risk-critical)',   iconBorder: 'var(--risk-critical-border)' },
  };
  const p = palettes[color] || palettes.salmon;

  return (
    <div style={{
      background:   '#FFFFFF',
      border:       '1px solid var(--card-border)',
      borderRadius: 16,
      boxShadow:    'var(--card-shadow)',
      padding:      '20px 20px',
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'space-between',
      gap:          16,
    }}>
      {/* Left */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <span style={{
            fontFamily:    'Montserrat, sans-serif',
            fontWeight:    700,
            fontSize:      10,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color:         'var(--cs-slate)',
          }}>{title}</span>
          {badge && (
            <span style={{
              fontFamily:    'Montserrat, sans-serif',
              fontWeight:    700,
              fontSize:      9,
              color:         'var(--cs-slate)',
              background:    'rgba(112,123,109,0.1)',
              border:        '1px solid rgba(112,123,109,0.2)',
              borderRadius:  99,
              padding:       '2px 7px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>{badge}</span>
          )}
        </div>

        <span style={{
          fontFamily:    'Montserrat, sans-serif',
          fontWeight:    800,
          fontSize:      26,
          letterSpacing: '-0.04em',
          color:         'var(--cs-pewter)',
          lineHeight:    1,
        }}>{value}</span>

        {subtext && (
          <span style={{
            fontFamily:  'Google Sans, monospace',
            fontSize:    11,
            color:       'var(--cs-slate-light)',
            marginTop:   6,
            overflow:    'hidden',
            textOverflow:'ellipsis',
            whiteSpace:  'nowrap',
          }}>{subtext}</span>
        )}
      </div>

      {/* Icon */}
      <div style={{
        width:          44,
        height:         44,
        borderRadius:   12,
        background:     p.iconBg,
        border:         `1px solid ${p.iconBorder}`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
      }}>
        <Icon size={20} color={p.iconColor} />
      </div>
    </div>
  );
}
