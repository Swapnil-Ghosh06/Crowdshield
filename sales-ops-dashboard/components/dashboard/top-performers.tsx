"use client";

import { Trophy, TrendingUp } from "lucide-react";

const performers = [
  { name: "Sarah Chen", deals: 24, revenue: "$487,500", change: "+15%", rank: 1 },
  { name: "Mike Johnson", deals: 19, revenue: "$356,200", change: "+8%", rank: 2 },
  { name: "Emily Davis", deals: 17, revenue: "$312,800", change: "+12%", rank: 3 },
  { name: "James Wilson", deals: 15, revenue: "$289,400", change: "+5%", rank: 4 },
  { name: "Lisa Park", deals: 14, revenue: "$267,100", change: "+9%", rank: 5 },
];

export function TopPerformers() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">Top Performers</h3>
          <p className="text-sm text-muted-foreground mt-0.5">This month&apos;s leaders</p>
        </div>
        <div className="flex items-center gap-1 text-warning">
          <Trophy className="w-5 h-5" />
        </div>
      </div>

      <div className="space-y-3">
        {performers.map((person, index) => (
          <div
            key={person.name}
            className="group flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-all duration-200 cursor-pointer animate-in fade-in slide-in-from-right-2"
            style={{ animationDelay: `${(index + 4) * 100}ms`, animationFillMode: "both" }}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent/80 to-chart-1 flex items-center justify-center text-sm font-semibold text-accent-foreground">
                  {person.name.split(" ").map((n) => n[0]).join("")}
                </div>
                {person.rank <= 3 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-warning text-[10px] font-bold flex items-center justify-center text-background">
                    {person.rank}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{person.name}</p>
                <p className="text-xs text-muted-foreground">{person.deals} deals closed</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">{person.revenue}</p>
              <div className="flex items-center justify-end gap-1 text-xs text-success">
                <TrendingUp className="w-3 h-3" />
                {person.change}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
