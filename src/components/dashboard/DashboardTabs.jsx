import React from "react";

const TAB_KEYS = ["Agents", "Tools", "Costs", "System"];

const TAB_LABELS = {
  Agents: "Агенти",
  Tools: "Інструменти",
  Costs: "Витрати",
  System: "Система",
};

export default function DashboardTabs({ activeTab, onTabChange }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
        overflowX: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {TAB_KEYS.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`dashboard-tab${isActive ? " dashboard-tab--active" : ""}`}
            style={{
              position: "relative",
            }}
          >
            {TAB_LABELS[tab]}
            {isActive && (
              <span
                style={{
                  position: "absolute",
                  bottom: -1,
                  left: 0,
                  right: 0,
                  height: 1,
                  background: "#f97316",
                  borderRadius: "1px 1px 0 0",
                  boxShadow: "none",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
