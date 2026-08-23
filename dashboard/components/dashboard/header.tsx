"use client";

import { cn } from "@/lib/utils";
import type { Section } from "@/app/page";
import {
  Bell,
  Search,
  WifiOff,
  RefreshCw,
  Clock,
  Activity,
  Cpu,
  Volume2,
  VolumeX,
  Sparkles,
} from "lucide-react";
import { useState, useEffect } from "react";
import { VoiceCommandButton } from "@/components/dashboard/voice-command-button";
import { useCrowdShield } from "@/lib/crowdshield/context";

interface HeaderProps {
  activeSection: Section;
}

const sectionTitles: Record<Section, string> = {
  overview: "Safety Command Center",
  liveMap: "Live Spatial Vector Map",
  incidents: "Real-Time Incident Stream",
  zones: "Perimeter & Zone Dynamics",
  analytics: "Predictive Risk Analytics",
  digitalTwin: "3D Digital Twin Simulation",
  aiSummary: "TechNova Multi-Agent Briefing",
  settings: "System Thresholds & Config",
};

export function Header({ activeSection }: HeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [timeString, setTimeString] = useState<string>("");
  const [soundMuted, setSoundMuted] = useState(false);

  const {
    connectionStatus,
    refreshMode,
    setRefreshMode,
    refreshNow,
    isRefreshing,
  } = useCrowdShield();

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " UTC"
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="sticky top-0 z-30">
      {connectionStatus === "disconnected" && (
        <div className="w-full bg-destructive/15 border-b border-destructive/30 text-destructive text-xs px-4 py-1.5 flex items-center justify-center gap-2 font-mono animate-pulse">
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Backend Disconnected — Displaying cached telemetry snapshot</span>
        </div>
      )}

      <header className="h-16 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base font-bold text-foreground tracking-wide flex items-center gap-2">
              {sectionTitles[activeSection]}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                ACTIVE
              </span>
            </h1>
          </div>

          {/* Telemetry Status Controls */}
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-white/10 text-xs">
            <button
              onClick={() => setRefreshMode(refreshMode === "2min" ? "live" : "2min")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-500/30 text-cyan-300 transition-all shadow-sm"
              title="Toggle telemetry mode"
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  connectionStatus === "connected"
                    ? refreshMode === "live"
                      ? "bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse"
                      : "bg-sky-400"
                    : "bg-amber-400"
                )}
              />
              <span className="font-mono font-semibold text-[11px]">
                {refreshMode === "live" ? "Live Websocket (100ms)" : "Interval (2m)"}
              </span>
            </button>

            <button
              onClick={refreshNow}
              disabled={isRefreshing}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Manual Telemetry Sync"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-cyan-400")} />
            </button>
          </div>
        </div>

        {/* Right Action Items */}
        <div className="flex items-center gap-3">
          {/* Live UTC Clock */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-cyan-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{timeString || "00:00:00 UTC"}</span>
          </div>

          {/* AI Model Badge */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono">
            <Cpu className="w-3.5 h-3.5" />
            <span>TechNova AI v4</span>
          </div>

          {/* Search Bar */}
          <div
            className={cn(
              "relative flex items-center transition-all duration-300",
              searchFocused ? "w-56" : "w-40"
            )}
          >
            <Search className="absolute left-3 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search zones..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full h-8 pl-8 pr-8 rounded-xl bg-white/5 border border-white/10 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/40 transition-all font-mono"
            />
            <span className="absolute right-2 text-[9px] font-mono text-muted-foreground bg-white/5 px-1 py-0.5 rounded border border-white/10 pointer-events-none">
              ⌘K
            </span>
          </div>

          {/* Voice Command */}
          <VoiceCommandButton />

          {/* Audio Alert Mute/Unmute */}
          <button
            onClick={() => setSoundMuted(!soundMuted)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            title={soundMuted ? "Unmute Audio Alerts" : "Mute Audio Alerts"}
          >
            {soundMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Notification Alert Bell */}
          <button className="relative w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_6px_#f43f5e] animate-ping" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
          </button>

          {/* User Profile Command Badge */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-500 p-0.5 shadow-md shadow-cyan-500/20">
            <div className="w-full h-full rounded-[10px] bg-slate-950 flex items-center justify-center text-[10px] font-bold text-cyan-300 font-mono">
              HQ
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
