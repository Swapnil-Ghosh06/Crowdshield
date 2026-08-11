import React from 'react';

export function StatCard({ title, value, subtext, icon: Icon, color = 'indigo', badge }) {
  const colorMap = {
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  };

  const selectedColor = colorMap[color] || colorMap.indigo;

  return (
    <div className="glass-panel rounded-xl p-4 border border-slate-800 flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">
          {title}
        </span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-black font-mono tracking-tight text-slate-100">
            {value}
          </span>
          {badge && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {badge}
            </span>
          )}
        </div>
        {subtext && (
          <span className="text-[11px] text-slate-500 mt-0.5 font-mono">
            {subtext}
          </span>
        )}
      </div>

      <div className={`p-3 rounded-xl border ${selectedColor}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}
