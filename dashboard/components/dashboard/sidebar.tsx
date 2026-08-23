"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { Section } from "@/app/page";
import {
  LayoutDashboard,
  Map,
  AlertTriangle,
  Shield,
  TrendingUp,
  Cpu,
  Brain,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Settings,
  Radio,
  Sparkles,
} from "lucide-react";
import { useCrowdShield } from "@/lib/crowdshield/context";

interface SidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

const mainNavItems: { id: Section; label: string; icon: React.ElementType; badge?: string }[] = [
  { id: "overview", label: "Command Center", icon: LayoutDashboard },
  { id: "liveMap", label: "Live Vector Map", icon: Map, badge: "LIVE" },
  { id: "incidents", label: "Incidents & Surge", icon: AlertTriangle },
  { id: "zones", label: "Zone Monitor", icon: Shield },
];

const intelNavItems: { id: Section; label: string; icon: React.ElementType; badge?: string }[] = [
  { id: "digitalTwin", label: "3D Digital Twin", icon: Cpu, badge: "AI" },
  { id: "analytics", label: "Crowd Analytics", icon: TrendingUp },
  { id: "aiSummary", label: "TechNova LLM", icon: Brain, badge: "GPT-4" },
  { id: "settings", label: "System Config", icon: Settings },
];

export function Sidebar({
  activeSection,
  onSectionChange,
  collapsed,
  onCollapsedChange,
}: SidebarProps) {
  const { isConnected } = useCrowdShield();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-out flex flex-col glass-panel border-r border-white/10",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-white/10 relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-emerald-500/30 to-cyan-400/20 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <ShieldAlert className="w-5 h-5 text-cyan-400 animate-pulse-slow" />
            </div>
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background transition-colors",
                isConnected ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-amber-500 animate-ping"
              )}
            />
          </div>

          <div
            className={cn(
              "flex flex-col transition-all duration-300",
              collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-wide text-foreground whitespace-nowrap bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
                CrowdShield
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold uppercase tracking-wider">
                v2.4
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-cyan-400" /> AI Safety Command
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto overflow-x-hidden">
        {/* Operations Section */}
        <div>
          {!collapsed && (
            <p className="px-3 mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 font-semibold">
              Core Operations
            </p>
          )}
          <div className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group relative",
                    isActive
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-500/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
                  )}
                >
                  {/* Active Indicator Bar */}
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full bg-cyan-400 shadow-[0_0_10px_#06b6d4] transition-all duration-300",
                      isActive ? "opacity-100" : "opacity-0"
                    )}
                  />

                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-transform duration-200",
                      isActive ? "text-cyan-400" : "text-muted-foreground group-hover:text-foreground group-hover:scale-110"
                    )}
                  />

                  <span
                    className={cn(
                      "whitespace-nowrap transition-all duration-300 flex-1 text-left",
                      collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                    )}
                  >
                    {item.label}
                  </span>

                  {!collapsed && item.badge && (
                    <span
                      className={cn(
                        "text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase",
                        item.badge === "LIVE"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse"
                          : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Intelligence & Analytics Section */}
        <div>
          {!collapsed && (
            <p className="px-3 mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 font-semibold">
              Intelligence & AI
            </p>
          )}
          <div className="space-y-1">
            {intelNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group relative",
                    isActive
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-500/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full bg-cyan-400 shadow-[0_0_10px_#06b6d4] transition-all duration-300",
                      isActive ? "opacity-100" : "opacity-0"
                    )}
                  />

                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-transform duration-200",
                      isActive ? "text-cyan-400" : "text-muted-foreground group-hover:text-foreground group-hover:scale-110"
                    )}
                  />

                  <span
                    className={cn(
                      "whitespace-nowrap transition-all duration-300 flex-1 text-left",
                      collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                    )}
                  >
                    {item.label}
                  </span>

                  {!collapsed && item.badge && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Footer / Collapse Toggle */}
      <div className="p-3 border-t border-white/10 space-y-2">
        {!collapsed && (
          <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/20 flex items-center gap-2.5 text-xs">
            <Radio className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
            <div className="flex-1 truncate">
              <p className="text-[11px] font-bold text-foreground truncate">Live WebSockets</p>
              <p className="text-[10px] text-muted-foreground font-mono truncate">
                {isConnected ? "Connected (4 Zones)" : "Reconnecting..."}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={() => onCollapsedChange(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent transition-all duration-200"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
