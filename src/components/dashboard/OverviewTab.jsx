import React, { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, RadialBarChart, RadialBar, PieChart, Pie, Cell
} from "recharts";

const activityData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  prompts: Math.floor(Math.random() * 120 + 20),
  agents: Math.floor(Math.random() * 80 + 10),
}));

const timelineData = [
  { name: "Jan", value: 12000 }, { name: "Feb", value: 18000 },
  { name: "Mar", value: 21880 }, { name: "Apr", value: 14600 },
  { name: "May", value: 18400 }, { name: "Jun", value: 12222 },
  { name: "Jul", value: 14600 }, { name: "Aug", value: 16800 },
];

const resourceData = [
  { name: "Chat", value: 72, fill: "#f97316" },
  { name: "Image", value: 69, fill: "#fb923c" },
  { name: "Code", value: 32, fill: "#fdba74" },
];

const completionData = [{ name: "Rate", value: 78, fill: "#f97316" }];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel px-3 py-2 text-xs" style={{ border: "1px solid rgba(249,115,22,0.2)" }}>
      <p style={{ color: "var(--text-muted)" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export default function OverviewTab() {
  const [range, setRange] = useState("weekly");

  return (
    <div className="grid grid-cols-12 gap-4 h-full">
      {/* Main Chart - Left */}
      <div className="col-span-7 glass-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>AI Generation Activity</h3>
            <div className="flex items-center gap-6 mt-2">
              <div>
                <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>2,197</span>
                <span className="text-xs ml-2" style={{ color: "var(--accent)" }}>↑18.0%</span>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Weekly</p>
              </div>
              <div>
                <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>8,903</span>
                <span className="text-xs ml-2" style={{ color: "var(--accent)" }}>↑19%</span>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Monthly</p>
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            {["today", "weekly", "monthly"].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: range === r ? "var(--accent-dim)" : "transparent",
                  color: range === r ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={timelineData}>
            <defs>
              <linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} fill="url(#orangeGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Right Column */}
      <div className="col-span-5 grid grid-rows-3 gap-4">
        {/* Daily Timeline */}
        <div className="glass-panel p-4">
          <h4 className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Daily AI Usage Timeline</h4>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={activityData.slice(0, 12)} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="hour" type="category" tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
              <Bar dataKey="prompts" fill="#f97316" radius={[0, 4, 4, 0]} barSize={6} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tokens Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-panel p-4 flex flex-col justify-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tokens Used</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>
              157<span className="text-sm font-normal ml-1" style={{ color: "var(--text-muted)" }}>4.2B</span>
            </p>
          </div>
          <div className="glass-panel p-4 flex flex-col justify-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tokens Processed</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>
              4.2<span className="text-sm font-normal ml-1" style={{ color: "var(--text-muted)" }}>B</span>
            </p>
          </div>
        </div>

        {/* Resource + Completion */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-panel p-4">
            <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Resource Allocation</h4>
            <div className="space-y-2">
              {resourceData.map((r) => (
                <div key={r.name} className="flex items-center gap-2">
                  <span className="text-[10px] w-10" style={{ color: "var(--text-muted)" }}>{r.name}</span>
                  <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${r.value}%`, background: r.fill }}
                    />
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>{r.value}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="glass-panel p-4 flex flex-col items-center justify-center">
            <h4 className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Task Completion</h4>
            <ResponsiveContainer width={90} height={70}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={completionData} startAngle={180} endAngle={0}>
                <RadialBar background={{ fill: "rgba(255,255,255,0.05)" }} dataKey="value" cornerRadius={8} />
              </RadialBarChart>
            </ResponsiveContainer>
            <p className="text-lg font-bold -mt-2" style={{ color: "var(--accent)" }}>78%</p>
          </div>
        </div>
      </div>
    </div>
  );
}