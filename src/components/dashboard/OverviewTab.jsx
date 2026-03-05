import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const activityData = [
  { name: "Jan", value: 12222 },
  { name: "Feb", value: 14600 },
  { name: "Mar", value: 21880 },
  { name: "Apr", value: 14600 },
  { name: "May", value: 18400 },
  { name: "Jun", value: 1122 },
  { name: "Jul", value: 1122 },
  { name: "Aug", value: 18400 },
];

const locationData = [
  { city: "Los Angeles", cost: "$20.30", total: "$50,331" },
  { city: "New York", cost: "$18,782", total: "$40,795" },
  { city: "Canada", cost: "$14,221", total: "$30,123" },
];

const timelineData = [
  { label: "Aug", value: 48000 },
  { label: "Jul", value: 42000 },
  { label: "Jun", value: 36000 },
  { label: "May", value: 52000 },
  { label: "Apr", value: 30000 },
  { label: "Mar", value: 28000 },
  { label: "Feb", value: 20000 },
  { label: "Jan", value: 15000 },
];

const resourceData = [
  { name: "Chat", value: 72 },
  { name: "Image", value: 69 },
  { name: "Code", value: 32 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#161616", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8, padding: "6px 10px" }}>
      <p style={{ color: "#555", fontSize: 10 }}>{label}</p>
      <p style={{ color: "#f97316", fontSize: 11, fontWeight: 600 }}>{Number(payload[0].value).toLocaleString()}</p>
    </div>
  );
};

function TaskCompletionGauge() {
  const percentage = 17;
  const total = 20;
  const filled = Math.round((percentage / 100) * total);
  const gapAngle = 4;
  const arcSpan = 200;
  const startAngle = -100;
  const cx = 80, cy = 85, r = 60;

  const getCoord = (angleDeg) => {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  const segments = Array.from({ length: total }, (_, i) => {
    const segAngle = (arcSpan - gapAngle * total) / total;
    const start = startAngle + i * (segAngle + gapAngle);
    const end = start + segAngle;
    const s = getCoord(start);
    const e = getCoord(end);
    return (
      <path
        key={i}
        d={`M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        stroke={i < filled ? "#f97316" : "rgba(255,255,255,0.07)"}
        style={i < filled ? { filter: "drop-shadow(0 0 4px rgba(249,115,22,0.5))" } : {}}
      />
    );
  });

  return (
    <div style={{ position: "relative", width: 160, height: 120, margin: "0 auto" }}>
      <svg width="160" height="120" viewBox="0 0 160 120">{segments}</svg>
      <div style={{ position: "absolute", top: "62%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
        <p style={{ fontSize: 28, fontWeight: 700, color: "#f97316", lineHeight: 1 }}>{percentage}%</p>
        <p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>this month</p>
      </div>
    </div>
  );
}

function AIProcessingLoadMeter() {
  const cx = 90, cy = 90, r = 65;
  const needleAngle = -30; // roughly 178 min position
  const needleRad = (needleAngle * Math.PI) / 180;
  const nx = cx + r * 0.85 * Math.cos(needleRad);
  const ny = cy + r * 0.85 * Math.sin(needleRad);

  // Arc from -180deg to 0deg (semicircle top)
  const arcPoints = (startDeg, endDeg, radius) => {
    const s = (startDeg * Math.PI) / 180;
    const e = (endDeg * Math.PI) / 180;
    return {
      x1: cx + radius * Math.cos(s), y1: cy + radius * Math.sin(s),
      x2: cx + radius * Math.cos(e), y2: cy + radius * Math.sin(e),
    };
  };

  const arc = arcPoints(-180, 0, r);

  return (
    <div style={{ position: "relative", width: "100%", height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="180" height="120" viewBox="0 0 180 120">
        {/* Background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Active arc (orange, partial) */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${nx} ${ny}`}
          fill="none"
          stroke="#f97316"
          strokeWidth="8"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 6px rgba(249,115,22,0.5))" }}
        />
        {/* Needle */}
        <line
          x1={cx} y1={cy}
          x2={cx + r * 0.7 * Math.cos(needleRad)}
          y2={cy + r * 0.7 * Math.sin(needleRad)}
          stroke="#f97316"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={4} fill="#f97316" />
        {/* Compass labels */}
        <text x={cx} y={cy - r - 8} textAnchor="middle" fill="#444" fontSize="9">N</text>
        <text x={cx + r + 10} y={cy + 4} textAnchor="middle" fill="#444" fontSize="9">E</text>
        <text x={cx - r - 10} y={cy + 4} textAnchor="middle" fill="#444" fontSize="9">W</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#444" fontSize="9">S</text>
        {/* Value */}
        <text x={cx} y={cy - 18} textAnchor="middle" fill="#555" fontSize="9">Current Usage</text>
        <text x={cx} y={cy + 2} textAnchor="middle" fill="#f5f5f5" fontSize="26" fontWeight="700">178</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fill="#555" fontSize="9">min</text>
        {/* 450 label */}
        <text x={cx + r + 4} y={cy + 22} textAnchor="middle" fill="#555" fontSize="9">450</text>
      </svg>
    </div>
  );
}

export default function OverviewTab() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "5fr 4fr 3fr", gap: 12, alignItems: "start" }}>

      {/* LEFT — AI Generation Activity */}
      <div className="glass-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5" }}>AI Generation Activity</p>
        <div style={{ display: "flex", gap: 32, marginBottom: 4 }}>
          <div>
            <p style={{ fontSize: 10, color: "#555" }}>Weekly</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: "#f5f5f5" }}>
              2,197 <span style={{ fontSize: 11, color: "#f97316" }}>↑19.6%</span>
            </p>
            <p style={{ fontSize: 9, color: "#444" }}>Compared to $1,340 last week</p>
          </div>
          <div>
            <p style={{ fontSize: 10, color: "#555" }}>Monthly</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: "#f5f5f5" }}>
              8,903 <span style={{ fontSize: 11, color: "#f97316" }}>↑1.9%</span>
            </p>
            <p style={{ fontSize: 9, color: "#444" }}>Compared to $5,445 last month</p>
          </div>
        </div>

        {/* Area chart with data point labels */}
        <div style={{ position: "relative" }}>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={activityData} margin={{ top: 16, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#1a0800" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="name" tick={{ fill: "#444", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#444", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} fill="url(#areaGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Location table */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {locationData.map((row) => (
            <div key={row.city} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: "#888" }}>{row.city}</span>
              <span style={{ fontSize: 11, color: "#f5f5f5" }}>{row.cost}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#f5f5f5" }}>{row.total}</span>
            </div>
          ))}
        </div>
      </div>

      {/* MIDDLE — Timeline + Tokens + Resource Allocation */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Daily AI Usage Timeline */}
        <div className="glass-panel" style={{ padding: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", marginBottom: 10 }}>Daily AI Usage Timeline</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {timelineData.map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, color: "#555", width: 22, textAlign: "right", flexShrink: 0 }}>{row.label}</span>
                <div style={{ flex: 1, height: 10, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                  <div style={{
                    width: `${(row.value / 52000) * 100}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #7c2d12, #f97316)",
                    borderRadius: 3,
                  }} />
                </div>
                <span style={{ fontSize: 9, color: "#444", width: 26, textAlign: "right" }}>
                  {row.value >= 1000 ? `${Math.round(row.value / 1000)}k` : row.value}
                </span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: 30, marginTop: 2 }}>
              {["0", "10k", "20k", "30k", "40k", "50k"].map((l) => (
                <span key={l} style={{ fontSize: 8, color: "#444" }}>{l}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Tokens */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="glass-panel" style={{ padding: 14 }}>
            <p style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>Tokens Used</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#f5f5f5", lineHeight: 1 }}>
              157<span style={{ fontSize: 11, color: "#555", marginLeft: 2 }}>4.2B</span>
            </p>
          </div>
          <div className="glass-panel" style={{ padding: 14 }}>
            <p style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>Tokens Processed</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#f5f5f5", lineHeight: 1 }}>
              4.2<span style={{ fontSize: 11, color: "#555", marginLeft: 2 }}>B</span>
            </p>
          </div>
        </div>

        {/* Resource Allocation */}
        <div className="glass-panel" style={{ padding: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", marginBottom: 10 }}>Resource Allocation</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {resourceData.map((r) => (
              <div key={r.name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#888" }}>{r.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#f5f5f5" }}>{r.value}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.05)" }}>
                  <div style={{
                    width: `${r.value}%`,
                    height: "100%",
                    borderRadius: 4,
                    background: "linear-gradient(90deg, #7c2d12, #f97316)",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — AI Processing Load Meter + Task Completion Rate */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* AI Processing Load Meter */}
        <div className="glass-panel" style={{ padding: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", marginBottom: 6 }}>AI Processing Load Meter</p>
          <AIProcessingLoadMeter />
          {/* Bottom stats */}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 10, marginTop: 4 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 9, color: "#555" }}>Response</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#f5f5f5" }}>1.2s</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 9, color: "#555" }}>Peak Load</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#f5f5f5" }}>450 m/s</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 9, color: "#555" }}>Tokens</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#f5f5f5" }}>49K tpm</p>
            </div>
          </div>
        </div>

        {/* Task Completion Rate */}
        <div className="glass-panel" style={{ padding: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", marginBottom: 6 }}>Task Completion Rate</p>
          <TaskCompletionGauge />
        </div>
      </div>

    </div>
  );
}