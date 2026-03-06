import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell
} from "recharts";

const generateData = (n, max) => Array.from({ length: n }, (_, i) => ({
  name: `${i}`,
  value: Math.floor(Math.random() * max + max * 0.2),
}));

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel px-3 py-2 text-xs" style={{ border: "1px solid rgba(249,115,22,0.2)" }}>
      <p style={{ color: "var(--text-muted)" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: "#f97316" }} className="font-medium">{p.value}</p>
      ))}
    </div>
  );
};

const TABS_CONFIG = {
  OpenClo: {
    panels: [
      { title: "Tasks Timeline", type: "area", span: 7 },
      { title: "Task Types", type: "bar", span: 5 },
      { title: "OpenClo Runtime", type: "line", span: 5 },
      { title: "Task Success Rate", type: "pie", span: 7 },
    ],
  },
  Tools: {
    panels: [
      { title: "Tools Usage", type: "area", span: 7 },
      { title: "Tool Execution Count", type: "bar", span: 5 },
      { title: "Tool Runtime", type: "line", span: 5 },
      { title: "Usage by Category", type: "pie", span: 7 },
    ],
  },
  Costs: {
    panels: [
      { title: "Daily Spend", type: "area", span: 7 },
      { title: "Cost by Agent", type: "bar", span: 5 },
      { title: "Cost by Tool", type: "bar", span: 5 },
      { title: "Token Consumption", type: "pie", span: 7 },
    ],
  },
  System: {
    panels: [
      { title: "System Load", type: "area", span: 7 },
      { title: "API Requests", type: "line", span: 5 },
      { title: "Errors / Failures", type: "bar", span: 5 },
      { title: "Performance Metrics", type: "pie", span: 7 },
    ],
  },
};

const pieData = [
  { name: "A", value: 40, fill: "#f97316" },
  { name: "B", value: 30, fill: "#fb923c" },
  { name: "C", value: 20, fill: "#fdba74" },
  { name: "D", value: 10, fill: "#fed7aa" },
];

function ChartPanel({ title, type, span }) {
  const data = generateData(12, 100);
  const spanClass = span === 7 ? "col-span-1 md:col-span-7" : "col-span-1 md:col-span-5";

  return (
    <div className={`${spanClass} glass-panel p-5`}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        {type === "area" ? (
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} fill={`url(#grad-${title})`} />
          </AreaChart>
        ) : type === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} barSize={16} />
          </BarChart>
        ) : type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot={false} />
          </LineChart>
        ) : (
          <PieChart>
            <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3}>
              {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export default function GenericTab({ tabName }) {
  const config = TABS_CONFIG[tabName];
  if (!config) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full overflow-auto">
      {config.panels.map((panel, i) => (
        <ChartPanel key={i} {...panel} />
      ))}
    </div>
  );
}