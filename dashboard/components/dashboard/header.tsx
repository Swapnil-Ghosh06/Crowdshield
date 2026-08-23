"use client";

import { cn } from "@/lib/utils";
import type { Section } from "@/app/page";
import { Bell, ShieldCheck, Flame, RotateCcw, Activity } from "lucide-react";
import { useCrowdShield } from "@/lib/crowdshield/context";

export interface HeaderProps {
  activeSection: Section;
  aiMode: "baseline" | "ai";
  setAiMode: (mode: "baseline" | "ai") => void;
}

const sectionTitles: Record<Section, string> = {
  overview: "Command Overview",
  liveMap: "Live Venue Map",
  incidents: "Incident Log",
  zones: "Zone Monitor",
  analytics: "Risk Analytics",
  digitalTwin: "Digital Twin",
  aiSummary: "AI Incident Summary",
};

export function Header({ activeSection }: HeaderProps) {
  const { connectionStatus, events, triggerSurge, triggerMitigation, resetTelemetry, totalEvents } = useCrowdShield();

  const hasCritical = Array.from(events.values()).some(
    (e) => e.risk_level === "critical"
  );

  return (
    <header className="sticky top-0 z-30 h-16 sm:h-18 border-b border-border bg-background/95 backdrop-blur-md flex items-center justify-between px-5 sm:px-8 select-none min-w-0 shadow-xs">
      {/* LEFT: Section Title + Live Status Badge */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <h1 className="text-lg sm:text-xl md:text-2xl font-black text-foreground tracking-tight truncate shrink-0">
          {sectionTitles[activeSection]}
        </h1>

        <span className="w-px h-5 bg-border/80 shrink-0 hidden sm:inline" />

        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/80 border border-border/60 text-xs font-medium shrink-0">
          <span
            className={cn(
              "w-2.5 h-2.5 rounded-full shrink-0",
              connectionStatus === "connected"
                ? "bg-emerald-600 animate-pulse"
                : "bg-emerald-500 animate-pulse"
            )}
          />
          <span className="text-foreground font-bold">Live Telemetry</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground font-mono font-semibold">{totalEvents} updates</span>
        </div>
      </div>

      {/* CENTER & RIGHT: Scenario Controls + AI Mode + Profile */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Scenario Controls Suite */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/90 border border-border text-xs">
          <button
            onClick={() => triggerSurge('gate_3')}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg font-bold bg-destructive/15 border border-destructive/40 text-destructive hover:bg-destructive/25 transition-all cursor-pointer text-xs sm:text-sm whitespace-nowrap"
            title="Simulate sudden crowd congestion at North Gate"
          >
            <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Simulate Surge</span>
          </button>

          <button
            onClick={() => triggerMitigation()}
            className="flex items-center gap-1.5 px-3.5 sm:px-4.5 py-1.5 rounded-lg font-bold bg-[#44492B] border border-[#44492B] text-[#FAF7F2] hover:opacity-90 transition-all cursor-pointer text-xs sm:text-sm whitespace-nowrap shadow-xs"
            title="Deploy automated AI crowd mitigation"
          >
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FAF7F2]" />
            <span>Auto Mitigate</span>
          </button>

          <button
            onClick={() => resetTelemetry()}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            title="Reset baseline telemetry"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <span className="w-px h-5 bg-border/80 hidden md:inline" />

        {/* Right actions: AI badge + bell + avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex items-center gap-2 h-8 px-3.5 rounded-full border border-[#44492B]/40 bg-[#44492B]/10 text-[#44492B] text-xs sm:text-sm font-bold">
            <Activity className="w-4 h-4 text-[#44492B] animate-pulse" />
            <span>AI Active</span>
          </div>

          {/* Bell Notification */}
          <button className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-secondary/80 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
            <Bell className="w-4 h-4" />
            {hasCritical && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-destructive rounded-full animate-ping" />
            )}
          </button>

          {/* User Avatar */}
          <div className="w-9 h-9 rounded-xl bg-[#44492B] border border-[#44492B] flex items-center justify-center text-xs font-bold text-[#FAF7F2] shadow-xs">
            CS
          </div>
        </div>
      </div>
    </header>
  );
}
