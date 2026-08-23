"use client";

import { cn } from "@/lib/utils";
import type { Section } from "@/app/page";
import { Bell, ShieldCheck, Flame, RotateCcw, Activity } from "lucide-react";
import { useCrowdShield } from "@/lib/crowdshield/context";
import { useCrowdShieldSettings } from "@/lib/crowdshield/settings-context";

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
  broadcast: "PA Broadcast Console",
  analytics: "Risk Analytics",
  digitalTwin: "Digital Twin",
  aiSummary: "AI Incident Summary",
};

export function Header({ activeSection, aiMode, setAiMode }: HeaderProps) {
  const { connectionStatus, events, triggerBackendScenario, totalEvents } = useCrowdShield();
  const { autoSimulate } = useCrowdShieldSettings();

  const hasCritical = Array.from(events.values()).some(
    (e) => e.risk_level === "critical"
  );

  let statusDotClass = "bg-emerald-400 animate-pulse";
  let statusLabel = "Live Pipeline";
  let showDemoBadge = false;

  if (connectionStatus === "connected") {
    statusDotClass = "bg-emerald-400 animate-pulse";
    statusLabel = "Live Pipeline";
  } else if (connectionStatus === "connecting") {
    statusDotClass = "bg-amber-400 animate-pulse";
    statusLabel = "Connecting...";
  } else if (connectionStatus === "disconnected") {
    if (autoSimulate) {
      statusDotClass = "bg-amber-400 animate-pulse";
      statusLabel = "Simulating";
      showDemoBadge = true;
    } else {
      statusDotClass = "bg-destructive";
      statusLabel = "Disconnected";
    }
  }

  const handleSimulateSurge = async () => {
    try {
      await triggerBackendScenario("before");
      setAiMode("baseline");
    } catch {
      setAiMode("baseline");
    }
  };

  const handleAutoMitigate = async () => {
    try {
      await triggerBackendScenario("after");
      setAiMode("ai");
    } catch {
      setAiMode("ai");
    }
  };

  const handleResetScenario = async () => {
    try {
      await triggerBackendScenario("reset");
    } catch {
      // ignore
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 sm:h-18 border-b border-border bg-background/95 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 lg:px-8 select-none shadow-xs gap-3">
      {/* LEFT: Section Title + Live Status Badge */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 shrink">
        <h1
          className="text-base sm:text-lg md:text-xl font-black text-foreground tracking-tight truncate shrink-0"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          {sectionTitles[activeSection]}
        </h1>

        {/* Live / Simulating Status Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 border border-border text-xs font-semibold shrink-0">
          <span className={cn("w-2 h-2 rounded-full shrink-0", statusDotClass)} />
          <span className="text-foreground text-[11px] sm:text-xs" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {statusLabel}
          </span>
          {showDemoBadge && (
            <span
              className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.2 text-[9px] font-bold"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              DEMO
            </span>
          )}
          <span className="text-muted-foreground hidden xl:inline">·</span>
          <span className="text-muted-foreground text-[10px] hidden xl:inline" style={{ fontFamily: "'Google Sans', sans-serif" }}>
            {totalEvents} events
          </span>
        </div>
      </div>

      {/* RIGHT: Scenario Controls + AI Mode Badge + Notification + Avatar */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Scenario Controls Suite */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/90 border border-border text-xs">
          <button
            onClick={handleSimulateSurge}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg font-bold bg-destructive/15 border border-destructive/40 text-destructive hover:bg-destructive/25 transition-all cursor-pointer text-xs whitespace-nowrap"
            title="Simulate sudden crowd congestion at South/North Gate (Scripted Scenario: Before)"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Simulate Surge</span>
          </button>

          <button
            onClick={handleAutoMitigate}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg font-bold bg-[#44492B] border border-[#44492B] text-[#FAF7F2] hover:opacity-90 transition-all cursor-pointer text-xs whitespace-nowrap shadow-xs"
            title="Deploy automated AI crowd mitigation (Scripted Scenario: After)"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#FAF7F2]" />
            <span>Auto Mitigate</span>
          </button>

          <button
            onClick={handleResetScenario}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            title="Reset to ambient monitoring"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="w-px h-5 bg-border/80 hidden sm:inline" />

        {/* AI Mode indicator badge */}
        <div
          className={cn(
            "hidden md:flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-bold transition-all",
            aiMode === "baseline"
              ? "bg-destructive/15 text-destructive border-destructive/30"
              : "bg-[#44492B]/15 text-[#44492B] border-[#44492B]/30"
          )}
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          <Activity
            className={cn(
              "w-3.5 h-3.5",
              aiMode === "ai" ? "text-[#44492B] animate-pulse" : "text-destructive"
            )}
          />
          <span>{aiMode === "baseline" ? "Without AI" : "AI Active"}</span>
        </div>

        {/* Bell Notification */}
        <button className="relative w-8.5 h-8.5 flex items-center justify-center rounded-xl bg-secondary/80 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
          <Bell className="w-4 h-4" />
          {hasCritical && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-destructive rounded-full animate-ping" />
          )}
        </button>

        {/* User Avatar */}
        <div
          className="w-8.5 h-8.5 rounded-xl bg-[#44492B] border border-[#44492B] flex items-center justify-center text-xs font-bold text-[#FAF7F2] shadow-xs"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          CS
        </div>
      </div>
    </header>
  );
}
