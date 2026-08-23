"use client";

import { cn } from "@/lib/utils";
import type { Section } from "@/app/page";
import {
  Bell,
  Search,
  Radio,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { VoiceCommandButton } from "@/components/dashboard/voice-command-button";
import { useCrowdShield } from "@/lib/crowdshield/context";

interface HeaderProps {
  activeSection: Section;
}

const sectionTitles: Record<Section, string> = {
  overview: "Command Overview",
  liveMap: "Live Venue Map",
  incidents: "Incident Log",
  zones: "Zone Monitor",
  analytics: "Risk Analytics",
  digitalTwin: "Digital Twin",
  aiSummary: "AI Incident Summary",
  settings: "Settings",
};

export function Header({ activeSection }: HeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const {
    connectionStatus,
    refreshMode,
    setRefreshMode,
    refreshNow,
    isRefreshing,
  } = useCrowdShield();

  return (
    <div className="sticky top-0 z-30">
      {connectionStatus === "disconnected" && (
        <div className="w-full bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-400 text-xs px-4 py-1.5 flex items-center justify-center gap-2">
          <WifiOff className="w-3 h-3 flex-shrink-0" />
          <span>Backend offline — displaying cached venue state</span>
        </div>
      )}

      <header className="h-16 border-b border-border bg-background/90 backdrop-blur-md flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">
            {sectionTitles[activeSection]}
          </h1>

          {/* Minimal, sleek telemetry status pill */}
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-border/80 text-xs">
            <button
              onClick={() => setRefreshMode(refreshMode === "2min" ? "live" : "2min")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/60 hover:bg-secondary border border-border/60 text-muted-foreground hover:text-foreground transition-all"
              title="Toggle between 2-minute interval and live streaming"
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  connectionStatus === "connected"
                    ? refreshMode === "live"
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-sky-400"
                    : "bg-amber-400"
                )}
              />
              <span className="font-mono text-[11px]">
                {refreshMode === "live" ? "Live Feed" : "Auto-refresh (2m)"}
              </span>
            </button>

            <button
              onClick={refreshNow}
              disabled={isRefreshing}
              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Refresh telemetry"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-accent")} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div
            className={cn(
              "relative flex items-center transition-all duration-200",
              searchFocused ? "w-60" : "w-44"
            )}
          >
            <Search className="absolute left-3 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-secondary/50 border border-border/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 transition-all"
            />
          </div>

          <VoiceCommandButton />

          <button className="relative w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent rounded-full" />
          </button>

          <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-xs font-semibold text-foreground font-mono">
            CS
          </div>
        </div>
      </header>
    </div>
  );
}
