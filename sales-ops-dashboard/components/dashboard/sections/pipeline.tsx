"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, MoreHorizontal, Clock, DollarSign, User, Building2 } from "lucide-react";

interface Deal {
  id: string;
  company: string;
  value: number;
  rep: string;
  daysInStage: number;
  probability: number;
}

interface Stage {
  id: string;
  name: string;
  deals: Deal[];
  total: number;
}

const initialStages: Stage[] = [
  {
    id: "lead",
    name: "Lead",
    total: 892000,
    deals: [
      { id: "1", company: "Nexus Technologies", value: 45000, rep: "Sarah C.", daysInStage: 3, probability: 20 },
      { id: "2", company: "Bright Systems", value: 78000, rep: "Mike J.", daysInStage: 5, probability: 25 },
      { id: "3", company: "CoreLogic Inc", value: 32000, rep: "Emily D.", daysInStage: 1, probability: 15 },
    ],
  },
  {
    id: "qualified",
    name: "Qualified",
    total: 556000,
    deals: [
      { id: "4", company: "DataPrime Ltd", value: 125000, rep: "James W.", daysInStage: 7, probability: 40 },
      { id: "5", company: "CloudNine Corp", value: 89000, rep: "Sarah C.", daysInStage: 4, probability: 45 },
    ],
  },
  {
    id: "proposal",
    name: "Proposal",
    total: 357000,
    deals: [
      { id: "6", company: "TechForward", value: 167000, rep: "Mike J.", daysInStage: 12, probability: 60 },
      { id: "7", company: "Innovate Plus", value: 95000, rep: "Lisa P.", daysInStage: 8, probability: 65 },
      { id: "8", company: "SmartGrid Co", value: 54000, rep: "Emily D.", daysInStage: 6, probability: 55 },
    ],
  },
  {
    id: "negotiation",
    name: "Negotiation",
    total: 179000,
    deals: [
      { id: "9", company: "Enterprise Max", value: 245000, rep: "Sarah C.", daysInStage: 15, probability: 80 },
      { id: "10", company: "GrowthLab", value: 112000, rep: "James W.", daysInStage: 10, probability: 75 },
    ],
  },
];

function DealCard({ deal, index }: { deal: Deal; index: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group bg-background border border-border rounded-lg p-4 cursor-grab active:cursor-grabbing hover:border-accent/50 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center">
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium text-foreground truncate max-w-[120px]">{deal.company}</span>
        </div>
        <button className={cn(
          "w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200",
          isHovered ? "opacity-100" : "opacity-0"
        )}>
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm text-foreground font-semibold mb-3">
        <DollarSign className="w-3.5 h-3.5 text-accent" />
        ${deal.value.toLocaleString()}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {deal.rep}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {deal.daysInStage}d
        </div>
      </div>

      {/* Probability bar */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">Probability</span>
          <span className="text-foreground font-medium">{deal.probability}%</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${deal.probability}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function PipelineSection() {
  const [stages] = useState(initialStages);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Manage and track your sales pipeline</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors duration-200">
          <Plus className="w-4 h-4" />
          Add Deal
        </button>
      </div>

      {/* Pipeline board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stages.map((stage, stageIndex) => (
          <div
            key={stage.id}
            className="bg-card border border-border rounded-xl p-4 min-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: `${stageIndex * 100}ms`, animationFillMode: "both" }}
          >
            {/* Stage header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{stage.name}</h3>
                <span className="px-2 py-0.5 bg-secondary rounded-md text-xs font-medium text-muted-foreground">
                  {stage.deals.length}
                </span>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                ${(stage.total / 1000).toFixed(0)}k
              </span>
            </div>

            {/* Deals */}
            <div className="space-y-3">
              {stage.deals.map((deal, dealIndex) => (
                <DealCard key={deal.id} deal={deal} index={dealIndex} />
              ))}
            </div>

            {/* Add deal to stage */}
            <button className="w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-accent/50 hover:bg-secondary/50 transition-all duration-200">
              <Plus className="w-4 h-4" />
              Add deal
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
