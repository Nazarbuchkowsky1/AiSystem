import React from "react";

const TABS = ["Overview", "Agents", "OpenClo", "Tools", "Costs", "System"];

export default function DashboardTabs({ activeTab, onTabChange }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 2,
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      flexShrink: 0,
    }}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            style={{
              position: "relative",
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: isActive ? 700 : 400,
              color: isActive ? "#f97316" : "#4a4a4a",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "color 0.2s",
              outline: "none",
              textShadow: "none",
            }}
          >
            {tab}
            {isActive && (
              <span style={{
                position: "absolute",
                bottom: -1,
                left: 0,
                right: 0,
                height: 1,
                background: "#f97316",
                borderRadius: "1px 1px 0 0",
                boxShadow: "none",
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}