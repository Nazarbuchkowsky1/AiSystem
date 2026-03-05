import React, { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, RadialBarChart, RadialBar, Cell
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

// Radial segments for Task Completion Rate gauge
const GAUGE_SEGMENTS = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  filled: i < 3, // ~17%
}));

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel px-3 py-2 text-xs" style={{ border: "1px solid rgba(249,115,22,0.2)" }}>
      <p style={{ color: "var(--text-muted)" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: "#f97316" }} className="font-medium">
          {Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
};

function ProcessingMeter() {
  // Compass-style gauge
  const value = 178;
  const angle = -45; // pointing roughly SE
  const rad = (angle * Math.PI) / 180;
  const cx = 80, cy = 80, r = 55;
  const nx = cx + r * Math.sin(rad);
  const ny = cy - r * Math.cos(rad);

  return (
    <div style={{ position: "relative", width: 160, height: 160, margin: "0 auto" }}>
      <svg width="160" height="160" viewBox="0 0 160 160">
        {/* Outer circle */}
        <circle cx="80" cy="80" r="72" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        {/* Inner ring segments */}
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i * 10 * Math.PI) / 180;
          const x1 = 80 + 60 * Math.cos(a);
          const y1 = 80 + 60 * Math.sin(a);
          const x2 = 80 + 68 * Math.cos(a);
          const y2 = 80 + 68 * Math.sin(a);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
          );
        })}
        {/* Compass labels */}
        <text x="80" y="18" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">N</text>
        <text x="148" y="84" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">E</text>
        <text x="80" y="152" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">S</text>
        <text x="12" y="84" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">W</text>
        {/* Needle */}
        <line x1="80" y1="80" x2={nx} y2={ny} stroke="#f97316" strokeWidth="2"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 4px rgba(249,115,22,0.6))" }} />
        {/* Center dot */}
        <circle cx="80" cy="80" r="5" fill="#f97316"
          style={{ filter: "drop-shadow(0 0 6px rgba(249,115,22,0.8))" }} />
        {/* Arc highlight */}
        <path
          d={`M ${cx + 50 * Math.cos(-Math.PI / 4)} ${cy + 50 * Math.sin(-Math.PI / 4)} A 50 50 0 0 1 ${cx + 50 * Math.cos(Math.PI / 4)} ${cy + 50 * Math.sin(Math.PI / 4)}`}
          fill="none" stroke="rgba(249,115,22,0.15)" strokeWidth="10" />
      </svg>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-30%)", textAlign: "center" }}>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Current Usage</p>
        <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>min</p>
      </div>
    </div>
  );
}

function TaskCompletionGauge() {
  const percentage = 17;
  const total = 20;
  const filled = Math.round((percentage / 100) * total);
  const gapAngle = 4;
  const arcSpan = 200;
  const startAngle = -100;
  const cx = 80, cy = 90, r = 58;

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
    const large = segAngle > 180 ? 1 : 0;
    return (
      <path
        key={i}
        d={`M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        stroke={i < filled ? "#f97316" : "rgba(255,255,255,0.07)"}
        style={i < filled ? { filter: "drop-shadow(0 0 4px rgba(249,115,22,0.5))" } : {}}
      />
    );
  });

  return (
    <div style={{ position: "relative", width: 160, height: 130, margin: "0 auto" }}>
      <svg width="160" height="130" viewBox="0 0 160 130">
        {segments}
      </svg>
      <div style={{ position: "absolute", top: "55%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
        <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>{percentage}%</p>
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>this month</p>
      </div>
    </div>
  );
}

export default function OverviewTab() {
  const [range, setRange] = useState("Weekly");

  return (
    <div className="grid grid-cols-12 gap-3 pb-2">
      {/* AI Generation Activity - col 5 */}
      <div className="col-span-5 glass-panel p-5 flex flex-col">
        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>AI Generation Activity</h3>
        {/* Stats row */}
        <div className="flex gap-8 mb-3">
          <div>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Weekly</p>
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              2,197 <span className="text-xs font-normal" style={{ color: "var(--accent)" }}>↑18.0%</span>
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Compared to $1,340 last week</p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Monthly</p>
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              8,903 <span className="text-xs font-normal" style={{ color: "var(--accent)" }}>↑19%</span>
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Compared to $5,445 last month</p>
          </div>
        </div>
        {/* Area chart */}
        <div className="flex-1" style={{ minHeight: 120 }}>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={activityData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#1a0800" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="name" tick={{ fill: "#444", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#444", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2}
                fill="url(#areaGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {/* Location table */}
        <div className="mt-2 space-y-2">
          {locationData.map((row) => (
            <div key={row.city} className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{row.city}</span>
              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{row.cost}</span>
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{row.total}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Middle column - Timeline + Tokens + Resource */}
      <div className="col-span-4 flex flex-col gap-3">
        {/* Daily AI Usage Timeline */}
        <div className="glass-panel p-4">
          <h4 className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Daily AI Usage Timeline</h4>
          <div className="space-y-1.5">
            {timelineData.map((row) => (
              <div key={row.label} className="flex items-center gap-2">
                <span className="text-[10px] w-6 text-right flex-shrink-0" style={{ color: "var(--text-muted)" }}>{row.label}</span>
                <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div
                    className="h-full rounded-sm transition-all"
                    style={{
                      width: `${(row.value / 52000) * 100}%`,
                      background: "linear-gradient(90deg, #c2410c, #f97316)",
                    }}
                  />
                </div>
                <span className="text-[9px] w-8" style={{ color: "var(--text-muted)" }}>
                  {row.value >= 1000 ? `${(row.value / 1000).toFixed(0)}k` : row.value}
                </span>
              </div>
            ))}
            {/* X-axis labels */}
            <div className="flex justify-between pl-8 pt-1">
              {["0", "10k", "20k", "30k", "40k", "50k"].map((l) => (
                <span key={l} className="text-[9px]" style={{ color: "var(--text-muted)" }}>{l}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Tokens */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-panel p-4">
            <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Tokens Used</p>
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              157<span className="text-xs font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>4.2B</span>
            </p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Tokens Processed</p>
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              4.2<span className="text-xs font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>B</span>
            </p>
          </div>
        </div>

        {/* Resource Allocation */}
        <div className="glass-panel p-4 flex-1">
          <h4 className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Resource Allocation</h4>
          <div className="space-y-3">
            {resourceData.map((r) => (
              <div key={r.name}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{r.name}</span>
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{r.value}%</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${r.value}%`,
                      background: "linear-gradient(90deg, #c2410c, #f97316)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right column - Processing Meter + Task Completion */}
      <div className="col-span-3 flex flex-col gap-3">
        {/* AI Processing Load Meter */}
        <div className="glass-panel p-4 flex flex-col">
          <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>AI Processing Load Meter</h4>
          <ProcessingMeter />
          <div className="grid grid-cols-3 gap-1 mt-2">
            {[
              { label: "Response", value: "1.2s" },
              { label: "Peak Load", value: "450 m/s" },
              { label: "Tokens", value: "49K tpm" },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                <p className="text-[10px] font-semibold" style={{ color: "var(--text-primary)" }}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Task Completion Rate */}
        <div className="glass-panel p-4 flex flex-col flex-1">
          <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Task Completion Rate</h4>
          <div className="flex-1 flex items-center justify-center">
            <TaskCompletionGauge />
          </div>
        </div>
      </div>
    </div>
  );
}