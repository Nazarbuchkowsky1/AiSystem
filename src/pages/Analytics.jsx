import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, DollarSign, Clock, CheckCircle2 } from "lucide-react";
import MetricCard from "../components/dashboard/MetricCard";
import DashboardTabs from "../components/dashboard/DashboardTabs";
import OverviewTab from "../components/dashboard/OverviewTab";
import AgentsTab from "../components/dashboard/AgentsTab";
import GenericTab from "../components/dashboard/GenericTab";
import { base44 } from "@/api/base44Client";

const STATIC_METRICS = [
  { label: "OpenClo Runtime", value: "4h 22m", change: "+22.4%", isPositive: true, icon: Clock },
  { label: "Tasks Completed", value: "56", change: "+2", isPositive: true, icon: CheckCircle2 },
];

function formatChange(today, yesterday) {
  if (today === 0 && yesterday === 0) return { change: "—", isPositive: true };
  if (yesterday === 0 && today > 0) return { change: "+100%", isPositive: true };
  const pct = ((today - yesterday) / yesterday) * 100;
  const isPositive = pct >= 0;
  const sign = pct >= 0 ? "+" : "";
  return { change: `${sign}${pct.toFixed(1)}%`, isPositive };
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState("Overview");

  const { data: analytics = {}, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getAnalytics", {});
      return res?.data ?? {};
    },
    refetchInterval: 60 * 1000,
  });

  const promptsToday = Number(analytics.promptsToday) || 0;
  const promptsYesterday = Number(analytics.promptsYesterday) || 0;
  const spendToday = Number(analytics.spendToday) || 0;
  const spendYesterday = Number(analytics.spendYesterday) || 0;

  const promptsMetric = useMemo(() => {
    const { change, isPositive } = formatChange(promptsToday, promptsYesterday);
    return {
      label: "Prompts Today",
      value: promptsToday.toLocaleString(),
      change,
      isPositive,
      icon: MessageSquare,
    };
  }, [promptsToday, promptsYesterday]);

  const spendMetric = useMemo(() => {
    const { change, isPositive } = formatChange(spendToday, spendYesterday);
    let formatted;
    if (spendToday === 0) formatted = "$0.00";
    else if (spendToday < 0.01) formatted = `$${spendToday.toFixed(4)}`;
    else if (spendToday < 1) formatted = `$${spendToday.toFixed(3)}`;
    else formatted = `$${spendToday.toFixed(2)}`;
    return {
      label: "Total Spend",
      value: formatted,
      change,
      isPositive,
      icon: DollarSign,
    };
  }, [spendToday, spendYesterday]);

  const metrics = [promptsMetric, spendMetric, ...STATIC_METRICS];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "10px 16px 10px", gap: 8, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: "#f5f5f5" }}>Analytics</h1>
        <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 8, background: "rgba(249,115,22,0.15)", color: "#f97316" }}>
          Live
        </span>
      </div>

      {/* Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, flexShrink: 0 }}>
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} style={{ background: "#181818", border: "1px solid #2a2a2a", borderRadius: 12, padding: "10px 14px", minHeight: 90 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#2a2a2a", marginBottom: 8 }} />
              <div style={{ height: 20, width: "60%", background: "#2a2a2a", borderRadius: 4, marginBottom: 4 }} />
              <div style={{ height: 10, width: "40%", background: "#2a2a2a", borderRadius: 4 }} />
            </div>
          ))
        ) : (
          metrics.map((m, i) => (
            <MetricCard key={i} {...m} />
          ))
        )}
      </div>

      {/* Tabs */}
      <DashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {activeTab === "Overview" && <OverviewTab />}
        {activeTab === "Agents" && <AgentsTab />}
        {["OpenClo", "Tools", "Costs", "System"].includes(activeTab) && (
          <GenericTab tabName={activeTab} />
        )}
      </div>
    </div>
  );
}