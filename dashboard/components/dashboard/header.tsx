"use client";

import { cn } from "@/lib/utils";
import type { Section } from "@/app/page";
import { Bell, ShieldOff, ShieldCheck } from "lucide-react";
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

export function Header({ activeSection, aiMode, setAiMode }: HeaderProps) {
  const { connectionStatus, events } = useCrowdShield();

  const hasCritical = Array.from(events.values()).some(
    (e) => e.risk_level === "critical"
  );

  return (
    <div className="sticky top-0 z-30">
      <header className="h-14 border-b border-border bg-background/90 backdrop-blur-md flex items-center justify-between px-6">
        {/* LEFT: title + divider + status dot */}
        <div className="flex items-center gap-3">
          <h1
            className="text-base font-semibold text-foreground"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            {sectionTitles[activeSection]}
          </h1>

          <span className="w-px h-4 bg-border/60" />

          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                connectionStatus === "connected"
                  ? "bg-accent animate-pulse"
                  : "bg-amber-400"
              )}
            />
            {connectionStatus === "connected" ? "Live" : "Offline"}
          </span>
        </div>

        {/* RIGHT: AI toggle + bell + avatar */}
        <div className="flex items-center gap-2">
          {/* AI Scenario Toggle */}
          <button
            onClick={() => setAiMode(aiMode === "ai" ? "baseline" : "ai")}
            className={cn(
              "flex items-center gap-1.5 h-7 px-3 rounded-full border text-xs font-medium transition-all duration-200",
              aiMode === "ai"
                ? "bg-accent/20 border-accent/40 text-accent"
                : "bg-secondary border-border/60 text-muted-foreground"
            )}
          >
            {aiMode === "ai" ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>AI Active</span>
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              </>
            ) : (
              <>
                <ShieldOff className="w-3.5 h-3.5" />
                <span>Baseline</span>
              </>
            )}
          </button>

          {/* Bell notification */}
          <button className="relative w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <Bell className="w-4 h-4" />
            {hasCritical && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            )}
          </button>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-xs font-mono text-foreground">
            CS
          </div>
        </div>
      </header>
    </div>
  );
}
