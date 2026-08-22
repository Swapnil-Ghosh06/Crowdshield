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
import { AISummarySection } from "@/components/dashboard/sections/ai-summary";
import { SettingsSection } from "@/components/dashboard/sections/settings";
import { CrowdShieldProvider } from "@/lib/crowdshield/context";
import { CrowdShieldSettingsProvider } from "@/lib/crowdshield/settings-context";

export type Section = "overview" | "liveMap" | "incidents" | "zones" | "analytics" | "digitalTwin" | "aiSummary" | "settings";

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
      case "analytics":
        return <AnalyticsSection />;
      case "digitalTwin":
        return <DigitalTwinSection />;
      case "aiSummary":
        return <AISummarySection />;
      case "settings":
        return <SettingsSection />;
      default:
        return <OverviewSection />;
    }
  };

  return (
    <CrowdShieldSettingsProvider>
      <CrowdShieldProvider>
        <div className="flex min-h-screen bg-background">
        <Sidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ease-out ${
            sidebarCollapsed ? "ml-[72px]" : "ml-[260px]"
          }`}
        >
          <Header activeSection={activeSection} />
          <MultilingualTicker />
          <main className="flex-1 p-6 overflow-auto">
            <div
              key={activeSection}
              className="animate-in fade-in slide-in-from-bottom-4 duration-500"
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
