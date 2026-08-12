import React from 'react';

/**
 * StatCard — light-themed metric card with warm palette.
 */
export function StatCard({ title, value, subtext, icon: Icon, color = 'salmon', badge }) {
  const colorMap = {
    salmon:   { icon: 'text-[#BF897F] bg-[#F4EAE8] border-[#DAC2B2]', accent: '#BF897F' },
    slate:    { icon: 'text-[#707B6D] bg-[rgba(112,123,109,0.1)] border-[#C9A896]', accent: '#707B6D' },
    emerald:  { icon: 'text-[#4A9B6F] bg-[#E8F5EE] border-[#B8DFC8]', accent: '#4A9B6F' },
    amber:    { icon: 'text-[#C08B3A] bg-[#FDF0DC] border-[#E9C886]', accent: '#C08B3A' },
    rose:     { icon: 'text-[#B02828] bg-[#FCE0E0] border-[#E8A8A8]', accent: '#B02828' },
    indigo:   { icon: 'text-[#5E6AB2] bg-[#ECEEFF] border-[#BFC7E8]', accent: '#5E6AB2' },
    cyan:     { icon: 'text-[#3A8FA3] bg-[#E4F4F8] border-[#AADDE8]', accent: '#3A8FA3' },
  };

  const { icon: iconCls } = colorMap[color] || colorMap.salmon;

  return (
    <div className="cs-card p-5 flex items-center justify-between gap-4 animate-fade-in-up">
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-semibold tracking-wide uppercase text-secondary mb-1">
          {title}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black tracking-tight font-display text-primary truncate">
            {value}
          </span>
          {badge && (
            <span className="badge badge-slate text-[10px] shrink-0">
              {badge}
            </span>
          )}
        </div>
        {subtext && (
          <span className="text-[11px] text-muted mt-0.5 font-body truncate" style={{ fontFamily: 'Google Sans, monospace' }}>
            {subtext}
          </span>
        )}
      </div>

      <div className={`p-3 rounded-2xl border shrink-0 ${iconCls}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}
