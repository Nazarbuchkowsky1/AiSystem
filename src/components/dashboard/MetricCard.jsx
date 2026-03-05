import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function MetricCard({ label, value, change, isPositive = true, icon: Icon }) {
  return (
    <div style={{
      background: "linear-gradient(145deg, #181818, #111)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12,
      padding: "10px 14px",
      position: "relative",
      overflow: "hidden",
      boxShadow: "0 0 20px rgba(0,0,0,0.4)",
    }}>
      {/* Top accent line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.3), transparent)"
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: "rgba(249,115,22,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {Icon && <Icon style={{ width: 16, height: 16, color: "#f97316" }} />}
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "3px 7px", borderRadius: 8, fontSize: 11, fontWeight: 500,
          background: isPositive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          color: isPositive ? "#22c55e" : "#ef4444",
        }}>
          {isPositive ? <TrendingUp style={{ width: 11, height: 11 }} /> : <TrendingDown style={{ width: 11, height: 11 }} />}
          {change}
        </div>
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, color: "#f5f5f5", letterSpacing: "-0.5px" }}>{value}</p>
      <p style={{ fontSize: 11, color: "#555", marginTop: 3 }}>{label}</p>
    </div>
  );
}