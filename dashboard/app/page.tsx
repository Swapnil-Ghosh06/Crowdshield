"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { MultilingualTicker } from "@/components/dashboard/multilingual-ticker";
import { OverviewSection } from "@/components/dashboard/sections/overview";
import { LiveMapSection } from "@/components/dashboard/sections/live-map";
import { IncidentsSection } from "@/components/dashboard/sections/incidents";
import { ZonesSection } from "@/components/dashboard/sections/zones";
import { AnalyticsSection } from "@/components/dashboard/sections/analytics";
import { DigitalTwinSection } from "@/components/dashboard/sections/digital-twin";
import { BroadcastSection } from "@/components/dashboard/sections/broadcast";
import { CrowdShieldProvider } from "@/lib/crowdshield/context";
import { CrowdShieldSettingsProvider } from "@/lib/crowdshield/settings-context";

export type Section =
  | "overview"
  | "liveMap"
  | "incidents"
  | "zones"
  | "broadcast"
  | "analytics"
  | "digitalTwin"
  | "aiSummary";

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aiMode, setAiMode] = useState<"baseline" | "ai">("ai");

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return <OverviewSection />;
      case "liveMap":
        return <LiveMapSection />;
      case "incidents":
        return <IncidentsSection />;
      case "zones":
        return <ZonesSection />;
      case "broadcast":
        return <BroadcastSection />;
      case "analytics":
        return <AnalyticsSection />;
      case "digitalTwin":
        return <DigitalTwinSection />;
      case "aiSummary":
        return <AISummarySection />;
      default:
        return <OverviewSection />;
    }
  };

  return (
    <CrowdShieldSettingsProvider>
      <CrowdShieldProvider>
        <div className="flex min-h-screen max-w-full overflow-x-hidden bg-background">
          <Sidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />
          <div
            className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ease-out overflow-x-hidden ${
              sidebarCollapsed ? "ml-[72px]" : "ml-[260px]"
            }`}
          >
            <Header
              activeSection={activeSection}
              aiMode={aiMode}
              setAiMode={setAiMode}
            />
            <main className="flex-1 min-w-0 p-6 overflow-x-hidden overflow-y-auto">
              <div
                key={activeSection}
                className="min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                {renderSection()}
              </div>
            </main>
          </div>
        </div>
      </CrowdShieldProvider>
    </CrowdShieldSettingsProvider>
  );
}
