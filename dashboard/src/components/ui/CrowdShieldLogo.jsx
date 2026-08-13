import React from 'react';

/**
 * CrowdShieldLogo — Premium defense-grade brandmark.
 * Combines an angular hexagonal shield with radar sweep rings,
 * real-time telemetry pulse nodes, and authoritative typography.
 */
export function CrowdShieldLogo({ size = 'md', showSubtitle = true, className = '' }) {
  const sizeMap = {
    sm: { iconSize: 32, titleSize: 'text-base', subSize: 'text-[10px]' },
    md: { iconSize: 42, titleSize: 'text-xl',   subSize: 'text-[11px]' },
    lg: { iconSize: 52, titleSize: 'text-2xl',  subSize: 'text-xs' },
  };

  const { iconSize, titleSize, subSize } = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* ── Bespoke SVG Shield Brandmark ── */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-sm transition-transform hover:scale-105 duration-300"
        >
          <defs>
            {/* Background Shield Gradient */}
            <linearGradient id="shieldGrad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="50%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>

            {/* Glowing Border Gradient */}
            <linearGradient id="shieldBorder" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="50%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>

            {/* Radar Wave Gradient */}
            <linearGradient id="radarGrad" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.1" />
            </linearGradient>

            {/* Core Pulse Glow Filter */}
            <filter id="coreGlow" x="14" y="14" width="20" height="20" filterUnits="userSpaceOnUse">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Base Shield Geometry */}
          <path
            d="M24 4L8 10V22C8 32.5 14.8 42.1 24 44.8C33.2 42.1 40 32.5 40 22V10L24 4Z"
            fill="url(#shieldGrad)"
            stroke="url(#shieldBorder)"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Inner Safety Boundary (Subtle Inset) */}
          <path
            d="M24 8.5L12 13V22C12 30 17.1 37.3 24 39.5C30.9 37.3 36 30 36 22V13L24 8.5Z"
            fill="none"
            stroke="#334155"
            strokeWidth="1"
            strokeDasharray="2 2"
          />

          {/* Radar Telemetry Rings */}
          <circle cx="24" cy="24" r="10" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.3" fill="none" />
          <circle cx="24" cy="24" r="6" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.5" fill="none" />

          {/* Radar Sweep Arc */}
          <path
            d="M24 14 A10 10 0 0 1 34 24 L24 24 Z"
            fill="url(#radarGrad)"
          />

          {/* Crosshair telemetry grid */}
          <line x1="24" y1="12" x2="24" y2="36" stroke="#0284C7" strokeWidth="1" strokeOpacity="0.6" />
          <line x1="12" y1="24" x2="36" y2="24" stroke="#0284C7" strokeWidth="1" strokeOpacity="0.6" />

          {/* Core Telemetry Node (Glowing Center) */}
          <circle cx="24" cy="24" r="3.5" fill="#38BDF8" filter="url(#coreGlow)" />
          <circle cx="24" cy="24" r="2" fill="#FFFFFF" />

          {/* Peripheral Node Accents */}
          <circle cx="17" cy="18" r="1.5" fill="#60A5FA" />
          <circle cx="31" cy="18" r="1.5" fill="#60A5FA" />
          <circle cx="30" cy="29" r="1.5" fill="#38BDF8" />
        </svg>
      </div>

      {/* ── Brand Typography ── */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className={`font-black tracking-tight leading-none text-slate-900 font-display ${titleSize}`}>
            Crowd<span className="text-blue-600">Shield</span>
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-50 text-blue-700 border border-blue-200">
            PRO v1.0
          </span>
        </div>
        {showSubtitle && (
          <span className={`text-slate-500 font-medium tracking-tight leading-tight mt-0.5 ${subSize}`}>
            Real-Time Crowd Risk &amp; Stampede Intelligence
          </span>
        )}
      </div>
    </div>
  );
}
