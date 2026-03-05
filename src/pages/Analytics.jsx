import React, { useState } from "react";
import { MessageSquare, DollarSign, Clock, CheckCircle2 } from "lucide-react";
import MetricCard from "../components/dashboard/MetricCard";
import DashboardTabs from "../components/dashboard/DashboardTabs";
import OverviewTab from "../components/dashboard/OverviewTab";
import AgentsTab from "../components/dashboard/AgentsTab";
import GenericTab from "../components/dashboard/GenericTab";

const METRICS = [
  { label: "Prompts Today", value: "1,249", change: "+12.3%", isPositive: true, icon: MessageSquare },
  { label: "Total Spend", value: "$318", change: "+8.9%", isPositive: true, icon: DollarSign },
  { label: "OpenClo Runtime", value: "4h 22m", change: "+22.4%", isPositive: true, icon: Clock },
  { label: "Tasks Completed", value: "56", change: "+2", isPositive: true, icon: CheckCircle2 },
];

export default function Analytics() {
  const [activeTab, setActiveTab] = useState("Overview");

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "16px 20px", gap: 12, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "#f5f5f5" }}>Analytics</h1>
        <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 8, background: "rgba(249,115,22,0.15)", color: "#f97316" }}>
          Live
        </span>
      </div>

      {/* Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, flexShrink: 0 }}>
        {METRICS.map((m, i) => (
          <MetricCard key={i} {...m} />
        ))}
      </div>

      {/* Tabs */}
      <DashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {activeTab === "Overview" && <OverviewTab />}
        {activeTab === "Agents" && <AgentsTab />}
        {["OpenClo", "Tools", "Costs", "System"].includes(activeTab) && (
          <GenericTab tabName={activeTab} />
        )}
      </div>
    </div>
  );
}