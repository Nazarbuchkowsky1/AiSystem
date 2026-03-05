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
    <div className="h-full flex flex-col p-6 gap-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Analytics</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
            Live
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-4">
        {METRICS.map((m, i) => (
          <MetricCard key={i} {...m} />
        ))}
      </div>

      {/* Tabs */}
      <DashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === "Overview" && <OverviewTab />}
        {activeTab === "Agents" && <AgentsTab />}
        {["OpenClo", "Tools", "Costs", "System"].includes(activeTab) && (
          <GenericTab tabName={activeTab} />
        )}
      </div>
    </div>
  );
}