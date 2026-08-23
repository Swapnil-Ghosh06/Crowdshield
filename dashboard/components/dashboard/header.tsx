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
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/95 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 select-none min-w-0">
      {/* LEFT: Section Title + Live Status Badge */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <h1
          className="text-sm sm:text-base font-bold text-foreground tracking-tight truncate shrink-0"
          style={{ fontFamily: "'Ysabeau SC', sans-serif" }}
        >
          {sectionTitles[activeSection]}
        </h1>

        <span className="w-px h-4 bg-border/60 shrink-0 hidden sm:inline" />

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono shrink-0">
          <span
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              connectionStatus === "connected"
                ? "bg-accent animate-pulse"
                : "bg-emerald-400 animate-pulse"
            )}
          />
          <span className="text-foreground font-semibold">Live Stream</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-muted-foreground">{totalEvents} updates</span>
        </div>
      </div>

      {/* CENTER & RIGHT: Scenario Controls + AI Mode + Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Scenario Controls Suite */}
        <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-xl bg-secondary/80 border border-border/80 text-xs font-mono">
          <button
            onClick={() => triggerSurge('gate_3')}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg font-semibold bg-destructive/15 border border-destructive/40 text-destructive hover:bg-destructive/25 transition-all cursor-pointer text-[10px] sm:text-[11px] whitespace-nowrap"
            title="Simulate sudden crowd congestion at North Gate"
          >
            <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>Simulate Surge</span>
          </button>

          <button
            onClick={() => triggerMitigation()}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg font-bold bg-[#44492B] border border-[#44492B] text-[#FAF7F2] hover:opacity-90 transition-all cursor-pointer text-[10px] sm:text-[11px] whitespace-nowrap shadow-xs"
            title="Deploy automated AI crowd mitigation"
          >
            <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#FAF7F2]" />
            <span>Auto Mitigate</span>
          </button>

          <button
            onClick={() => resetTelemetry()}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            title="Reset baseline telemetry"
          >
            <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
        </div>

        <span className="w-px h-4 bg-border/60 hidden md:inline" />

        {/* Right actions: AI badge + bell + avatar */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden lg:flex items-center gap-1.5 h-7 px-3 rounded-full border border-[#44492B]/40 bg-[#44492B]/10 text-[#44492B] text-xs font-mono font-extrabold">
            <Activity className="w-3.5 h-3.5 text-[#44492B] animate-pulse" />
            <span>AI Active</span>
          </div>

          {/* Bell Notification */}
          <button className="relative w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
            <Bell className="w-4 h-4" />
            {hasCritical && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full animate-ping" />
            )}
          </button>

          {/* User Avatar */}
          <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-xs font-mono font-bold text-foreground">
            CS
          </div>
        </div>
      </div>
    </header>
  );
}
