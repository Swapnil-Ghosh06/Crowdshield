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
} from "lucide-react";
import { useCrowdShield } from "@/lib/crowdshield/context";

interface SidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

interface NavGroup {
  title: string;
  items: { id: Section; label: string; icon: React.ElementType }[];
}

const navGroups: NavGroup[] = [
  {
    title: "Operations",
    items: [
      { id: "overview", label: "Command", icon: LayoutDashboard },
      { id: "liveMap", label: "Live Map", icon: Map },
      { id: "zones", label: "Zone Monitor", icon: Shield },
    ],
  },
  {
    title: "Risk & Telemetry",
    items: [
      { id: "incidents", label: "Incidents", icon: AlertTriangle },
      { id: "analytics", label: "Analytics", icon: TrendingUp },
    ],
  },
  {
    title: "AI & Simulation",
    items: [
      { id: "digitalTwin", label: "Digital Twin", icon: Cpu },
      { id: "aiSummary", label: "AI Summary", icon: Brain },
    ],
  },
];

export function Sidebar({
  activeSection,
  onSectionChange,
  collapsed,
  onCollapsedChange,
}: SidebarProps) {
  const { connectionStatus } = useCrowdShield();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-out flex flex-col select-none",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Logo Area */}
      <div className="h-[70px] flex items-center px-4 border-b border-sidebar-border/80 shrink-0">
        <div className="flex items-center gap-3 w-full">
          <div className="relative w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-card/60 border border-border/50 p-1">
            <img
              src="/logo.svg"
              alt="CrowdShield"
              className="w-full h-full object-contain"
            />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_6px_var(--accent)]" />
          </div>
          <div
            className={cn(
              "flex flex-col transition-all duration-300 min-w-0",
              collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
            )}
          >
            <span className="font-bold text-sm text-sidebar-foreground whitespace-nowrap leading-tight tracking-tight">
              CrowdShield
            </span>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap font-medium tracking-wide">
              Safety Intelligence Platform
            </span>
          </div>
        </div>
      </div>

      {/* Grouped Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto overflow-x-hidden">
        {navGroups.map((group, groupIdx) => (
          <div key={group.title} className="space-y-1">
            {/* Section Header or Divider */}
            {collapsed ? (
              groupIdx > 0 && <div className="h-[1px] bg-border/40 my-3 mx-2" />
            ) : (
              <div className="px-3 pb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase font-mono">
                  {group.title}
                </span>
              </div>
            )}

            {/* Nav Items */}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSectionChange(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200 group text-left border relative",
                      isActive
                        ? "bg-accent/10 border-accent/30 text-foreground font-semibold shadow-[0_0_16px_rgba(0,214,143,0.08)]"
                        : "border-transparent text-muted-foreground hover:text-sidebar-foreground hover:bg-secondary/40 hover:border-border/40 font-medium"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0 transition-transform duration-200",
                        isActive
                          ? "text-accent drop-shadow-[0_0_6px_rgba(0,214,143,0.4)]"
                          : "text-muted-foreground group-hover:text-sidebar-foreground group-hover:scale-110"
                      )}
                    />
                    <span
                      className={cn(
                        "text-[13px] whitespace-nowrap transition-all duration-300",
                        collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100",
                        isActive ? "font-semibold text-foreground" : "font-medium"
                      )}
                    >
                      {item.label}
                    </span>

                    {/* Active Accent Indicator Dot */}
                    {isActive && !collapsed && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--accent)] animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-sidebar-border/80 bg-sidebar/50 shrink-0">
        {/* Status Footer (when expanded) */}
        {!collapsed && (
          <div className="px-4 py-2.5 border-b border-border/40 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  connectionStatus === "connected"
                    ? "bg-accent shadow-[0_0_8px_var(--accent)] animate-pulse"
                    : connectionStatus === "connecting"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-rose-500"
                )}
              />
              <span className="text-[11px] font-mono text-muted-foreground">
                {connectionStatus === "connected"
                  ? "Pipeline Live"
                  : connectionStatus === "connecting"
                  ? "Connecting…"
                  : "Offline"}
              </span>
            </div>
            <span className="px-1.5 py-0.5 text-[9px] font-mono font-medium rounded bg-secondary/80 text-muted-foreground border border-border/40">
              SYS OK
            </span>
          </div>
        )}

        {/* Collapse Button */}
        <div className="p-2.5">
          <button
            onClick={() => onCollapsedChange(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-sidebar-foreground hover:bg-secondary/40 border border-transparent hover:border-border/40 transition-all duration-200"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs font-medium text-muted-foreground hover:text-foreground">
                  Collapse Sidebar
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
