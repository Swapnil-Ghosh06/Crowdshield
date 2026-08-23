"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  changeType?: "positive" | "negative" | "neutral" | "warning";
  icon: LucideIcon;
  delay?: number;
  highlight?: boolean;
  tag?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  delay = 0,
  highlight = false,
  tag,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: delay * 0.08, ease: "easeOut" }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn(
        "group relative bg-card border rounded-xl p-4 lg:p-5 transition-colors duration-200 overflow-hidden select-none",
        highlight
          ? "border-accent/40 bg-accent/[0.03] shadow-[0_0_20px_rgba(0,214,143,0.06)]"
          : "border-border hover:border-border/80"
      )}
    >
      {/* Subtle top accent line on hover or highlight */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300",
          highlight
            ? "bg-accent opacity-100"
            : changeType === "negative"
            ? "bg-destructive opacity-0 group-hover:opacity-100"
            : "bg-accent opacity-0 group-hover:opacity-100"
        )}
      />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-muted-foreground uppercase tracking-wider" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {title}
          </span>
          {tag && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {tag}
            </span>
          )}
        </div>
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200",
            highlight
              ? "bg-accent/15 text-accent"
              : "bg-secondary text-muted-foreground group-hover:text-foreground group-hover:bg-secondary/80"
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-1">
        <span className="text-2xl lg:text-3xl font-extrabold text-foreground tracking-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          {value}
        </span>

        <div
          className={cn(
            "flex items-center gap-1 text-xs font-semibold shrink-0",
            changeType === "positive" && "text-emerald-700 font-bold",
            changeType === "negative" && "text-destructive font-bold",
            changeType === "warning" && "text-amber-700 font-bold",
            changeType === "neutral" && "text-muted-foreground"
          )}
        >
          {changeType === "positive" && <TrendingUp className="w-3.5 h-3.5" />}
          {changeType === "negative" && <TrendingDown className="w-3.5 h-3.5" />}
          {changeType === "warning" && <TrendingUp className="w-3.5 h-3.5" />}
          {changeType === "neutral" && <Minus className="w-3.5 h-3.5 opacity-50" />}
          <span>{change}</span>
        </div>
      </div>
    </motion.div>
  );
}
