"use client";

import { cn } from "@/lib/utils";
import type { Section } from "@/app/page";
import { Bell, Search, Radio, WifiOff } from "lucide-react";
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
  const { connectionStatus } = useCrowdShield();

  return (
    <div className="sticky top-0 z-30">
      {/* Simulated data warning banner */}
      {connectionStatus === "disconnected" && (
        <div className="w-full bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-400 text-xs px-4 py-1.5 flex items-center justify-center gap-2">
          <WifiOff className="w-3 h-3 flex-shrink-0" />
          <span>⚠ Backend disconnected — showing <strong>simulated data</strong>. Start the pipeline at port 8000 to go live.</span>
        </div>
      )}
      {connectionStatus === "connecting" && (
        <div className="w-full bg-blue-500/10 border-b border-blue-500/30 text-blue-400 text-xs px-4 py-1.5 flex items-center justify-center gap-2">
          <Radio className="w-3 h-3 flex-shrink-0 animate-pulse" />
          <span>Connecting to live feed…</span>
        </div>
      )}

      <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-semibold text-foreground">
            {sectionTitles[activeSection]}
          </h1>
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <Radio className={cn("w-4 h-4", connectionStatus === "connected" && "text-green-400")} />
            <span className={connectionStatus === "connected" ? "text-green-400" : ""}>
              {connectionStatus === "connected" ? "Live · Auto-refresh 3s" : connectionStatus === "connecting" ? "Connecting…" : "Simulated Data"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div
            className={cn(
              "relative flex items-center transition-all duration-300",
              searchFocused ? "w-64" : "w-48"
            )}
          >
            <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full h-9 pl-9 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
            />
          </div>

          {/* Voice Command Button */}
          <VoiceCommandButton />

          {/* Notifications */}
          <button className="relative w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full animate-pulse" />
          </button>

          {/* User avatar */}
          <button className="w-9 h-9 rounded-lg overflow-hidden bg-secondary ring-2 ring-transparent hover:ring-accent/50 transition-all duration-200">
            <div className="w-full h-full bg-gradient-to-br from-accent/80 to-chart-1 flex items-center justify-center text-xs font-semibold text-accent-foreground">
              CS
            </div>
          </button>
        </div>
      </header>
    </div>
  );
}
