import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function MetricCard({ label, value, change, isPositive = true, icon: Icon }) {
  return (
    <div className="metric-card p-5 group hover:border-orange-500/20 transition-all duration-300">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "var(--accent-dim)" }}
        >
          {Icon && <Icon className="w-4 h-4" style={{ color: "var(--accent)" }} />}
        </div>
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
          style={{
            background: isPositive ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
            color: isPositive ? "#22c55e" : "#ef4444",
          }}
        >
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {change}
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
    </div>
  );
}