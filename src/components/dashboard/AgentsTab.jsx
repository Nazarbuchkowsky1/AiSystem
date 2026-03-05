import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from "recharts";

const agentActivity = [
  { name: "Launch Expert", prompts: 342, color: "#f97316" },
  { name: "Grebenyuk", prompts: 278, color: "#fb923c" },
  { name: "Creative Dir.", prompts: 198, color: "#fdba74" },
];

const usageDist = [
  { name: "Launch Expert", value: 42, fill: "#f97316" },
  { name: "Grebenyuk", value: 34, fill: "#fb923c" },
  { name: "Creative Dir.", value: 24, fill: "#fdba74" },
];

const responseTime = Array.from({ length: 12 }, (_, i) => ({
  time: `${i * 2}:00`,
  avg: (Math.random() * 2 + 0.5).toFixed(1),
}));

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel px-3 py-2 text-xs" style={{ border: "1px solid rgba(249,115,22,0.2)" }}>
      <p style={{ color: "var(--text-muted)" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || "#f97316" }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function AgentsTab() {
  return (
    <div className="grid grid-cols-12 gap-4 h-full">
      {/* Agent Activity */}
      <div className="col-span-7 glass-panel p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Agent Activity</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={agentActivity}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="prompts" radius={[6, 6, 0, 0]} barSize={40}>
              {agentActivity.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Response Time */}
      <div className="col-span-5 glass-panel p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Avg Response Time (s)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={responseTime}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis dataKey="time" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="avg" stroke="#f97316" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Prompts Per Agent */}
      <div className="col-span-5 glass-panel p-5">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Prompts Per Agent</h3>
        <div className="space-y-3">
          {agentActivity.map((a) => (
            <div key={a.name} className="flex items-center gap-3">
              <span className="text-xs w-24 truncate" style={{ color: "var(--text-secondary)" }}>{a.name}</span>
              <div className="flex-1 h-3 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="h-full rounded-full" style={{ width: `${(a.prompts / 342) * 100}%`, background: a.color }} />
              </div>
              <span className="text-xs font-medium w-8 text-right" style={{ color: "var(--text-primary)" }}>{a.prompts}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Distribution */}
      <div className="col-span-7 glass-panel p-5 flex items-center">
        <div className="w-1/2">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Usage Distribution</h3>
          <div className="space-y-2">
            {usageDist.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{d.name}</span>
                <span className="text-xs font-medium ml-auto" style={{ color: "var(--text-primary)" }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="w-1/2">
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={usageDist} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3}>
                {usageDist.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}