"use client";

import React from "react"

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  Clock,
  ChevronRight,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const conversionData = [
  { month: "Jan", rate: 18 },
  { month: "Feb", rate: 22 },
  { month: "Mar", rate: 19 },
  { month: "Apr", rate: 25 },
  { month: "May", rate: 23 },
  { month: "Jun", rate: 28 },
  { month: "Jul", rate: 26 },
  { month: "Aug", rate: 31 },
  { month: "Sep", rate: 29 },
  { month: "Oct", rate: 32 },
  { month: "Nov", rate: 35 },
  { month: "Dec", rate: 38 },
];

const sourceData = [
  { name: "Direct", value: 35, color: "oklch(0.7 0.18 220)" },
  { name: "Referral", value: 25, color: "oklch(0.7 0.18 145)" },
  { name: "Organic", value: 20, color: "oklch(0.75 0.18 55)" },
  { name: "Paid Ads", value: 15, color: "oklch(0.65 0.2 25)" },
  { name: "Social", value: 5, color: "oklch(0.7 0.15 300)" },
];

const reports = [
  { id: "1", name: "Monthly Sales Summary", type: "Sales", date: "Jan 20, 2024", status: "ready" },
  { id: "2", name: "Q4 Performance Analysis", type: "Performance", date: "Jan 18, 2024", status: "ready" },
  { id: "3", name: "Pipeline Forecast", type: "Forecast", date: "Jan 15, 2024", status: "ready" },
  { id: "4", name: "Team Productivity Report", type: "Team", date: "Jan 12, 2024", status: "generating" },
  { id: "5", name: "Lead Source Analysis", type: "Marketing", date: "Jan 10, 2024", status: "ready" },
];

function ReportCard({
  title,
  description,
  icon: Icon,
  color,
  index,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  index: number;
}) {
  return (
    <div
      className="group bg-card border border-border rounded-xl p-5 hover:border-accent/50 cursor-pointer transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: "both" }}
    >
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-4", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground mb-4">{description}</p>
      <button className="flex items-center gap-1 text-xs text-accent font-medium group-hover:gap-2 transition-all duration-200">
        View Report
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

export function ReportsSection() {
  const [chartsLoaded, setChartsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setChartsLoaded(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* Quick report cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard
          title="Sales Summary"
          description="Monthly revenue and deal metrics"
          icon={BarChart3}
          color="bg-chart-1/10 text-chart-1"
          index={0}
        />
        <ReportCard
          title="Conversion Rates"
          description="Funnel performance analysis"
          icon={TrendingUp}
          color="bg-accent/10 text-accent"
          index={1}
        />
        <ReportCard
          title="Lead Sources"
          description="Channel attribution breakdown"
          icon={PieChartIcon}
          color="bg-chart-3/10 text-chart-3"
          index={2}
        />
        <ReportCard
          title="Forecast"
          description="Revenue predictions & targets"
          icon={Calendar}
          color="bg-chart-5/10 text-chart-5"
          index={3}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion rate trend */}
        <div className="bg-card border border-border rounded-xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Conversion Rate Trend</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Monthly lead to deal conversion</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-success font-medium">
              <TrendingUp className="w-4 h-4" />
              +111% YoY
            </div>
          </div>
          <div className={`h-[250px] transition-opacity duration-700 ${chartsLoaded ? 'opacity-100' : 'opacity-0'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={conversionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.005 260)" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "oklch(0.65 0 0)", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "oklch(0.65 0 0)", fontSize: 12 }}
                  tickFormatter={(value) => `${value}%`}
                  dx={-10}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "oklch(0.12 0.005 260)",
                    border: "1px solid oklch(0.22 0.005 260)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "oklch(0.95 0 0)", fontWeight: 600 }}
                  formatter={(value: number) => [`${value}%`, "Conversion Rate"]}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="oklch(0.7 0.18 145)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead sources pie chart */}
        <div className="bg-card border border-border rounded-xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground">Lead Sources</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Where your leads come from</p>
          </div>
          <div className="flex items-center gap-8">
            <div className={`w-[180px] h-[180px] transition-opacity duration-700 ${chartsLoaded ? 'opacity-100' : 'opacity-0'}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {sourceData.map((source, index) => (
                <div
                  key={source.name}
                  className="flex items-center justify-between animate-in fade-in slide-in-from-right-2"
                  style={{ animationDelay: `${(index + 5) * 100}ms`, animationFillMode: "both" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }} />
                    <span className="text-sm text-foreground">{source.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{source.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent reports table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-foreground">Recent Reports</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Your generated reports</p>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
            <FileText className="w-4 h-4" />
            Generate New
          </button>
        </div>
        <div className="divide-y divide-border">
          {reports.map((report, index) => (
            <div
              key={report.id}
              className="flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-colors duration-150 cursor-pointer animate-in fade-in slide-in-from-left-2"
              style={{ animationDelay: `${(index + 6) * 50}ms`, animationFillMode: "both" }}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{report.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-1.5 py-0.5 rounded bg-secondary">{report.type}</span>
                    <span>•</span>
                    <span>{report.date}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {report.status === "generating" ? (
                  <div className="flex items-center gap-2 text-xs text-warning">
                    <Clock className="w-4 h-4 animate-pulse" />
                    Generating...
                  </div>
                ) : (
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200">
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
