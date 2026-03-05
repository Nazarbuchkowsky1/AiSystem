import React from "react";

const TABS = ["Overview", "Agents", "OpenClo", "Tools", "Costs", "System"];

export default function DashboardTabs({ activeTab, onTabChange }) {
  return (
    <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--border-subtle)" }}>
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
            activeTab === tab ? "tab-active" : ""
          }`}
          style={{
            color: activeTab === tab ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}