import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
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
    <div style={{ background: "#1a1a1a", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 8, padding: "5px 10px" }}>
      <p style={{ color: "#555", fontSize: 9 }}>{label}</p>
      <p style={{ color: "#f97316", fontSize: 11, fontWeight: 600 }}>{Number(payload[0].value).toLocaleString()}</p>
    </div>
  );
};

// Tube/flow style area chart — uses two mirrored areas to create the "pipeline" look
function TubeAreaChart() {
  // Transform data into upper/lower bounds for the tube shape
  const tubeData = activityData.map((d, i) => {
    const half = d.value / 2;
    return { ...d, upper: 12000 + half * 0.9, lower: 12000 - half * 0.9 };
  });

  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={tubeData} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
        <defs>
          <linearGradient id="tubeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c2d12" stopOpacity={0.9} />
            <stop offset="40%" stopColor="#f97316" stopOpacity={1} />
            <stop offset="100%" stopColor="#c2410c" stopOpacity={0.8} />
          </linearGradient>
          <linearGradient id="tubeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#7c2d12" stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={true} horizontal={true} />
        <XAxis dataKey="name" tick={{ fill: "#444", fontSize: 9 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} tickLine={false} />
        <YAxis hide />
        <Tooltip content={<CustomTooltip />} />
        {/* Upper boundary */}
        <Area
          type="monotone"
          dataKey="upper"
          stroke="url(#tubeGrad)"
          strokeWidth={2.5}
          fill="url(#tubeFill)"
          fillOpacity={1}
          dot={false}
          activeDot={false}
          style={{ filter: "drop-shadow(0 0 6px rgba(249,115,22,0.4))" }}
        />
        {/* Lower boundary — fills to make tube */}
        <Area
          type="monotone"
          dataKey="lower"
          stroke="url(#tubeGrad)"
          strokeWidth={2.5}
          fill="#0a0a0a"
          fillOpacity={1}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Vertical markers on the chart
const MARKERS = [
  { label: "21,980", pos: "18%" },
  { label: "1,122", pos: "42%" },
  { label: "18,400", pos: "62%" },
  { label: "12,222", pos: "10%", bottom: true },
  { label: "14,600", pos: "33%", bottom: true },
  { label: "1,122", pos: "82%", bottom: true },
];

function TaskCompletionGauge() {
  const percentage = 17;
  const total = 20;
  const filled = Math.round((percentage / 100) * total);
  const gapAngle = 4;
  const arcSpan = 200;
  const startAngle = -100;
  const cx = 70, cy = 70, r = 52;

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
        strokeWidth="9"
        strokeLinecap="round"
        stroke={i < filled ? "#f97316" : "rgba(255,255,255,0.07)"}
        style={i < filled ? { filter: "drop-shadow(0 0 3px rgba(249,115,22,0.5))" } : {}}
      />
    );
  });

  return (
    <div style={{ position: "relative", width: 140, height: 105, margin: "0 auto" }}>
      <svg width="140" height="105" viewBox="0 0 140 105">{segments}</svg>
      <div style={{ position: "absolute", top: "58%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#f97316", lineHeight: 1 }}>{percentage}%</p>
        <p style={{ fontSize: 9, color: "#555", marginTop: 2 }}>this month</p>
      </div>
    </div>
  );
}

export default function OverviewTab() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "5fr 4fr 3fr", gap: 10, height: "100%" }}>

      {/* LEFT — AI Generation Activity */}
      <div style={{ background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 6, overflow: "hidden" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5", flexShrink: 0 }}>AI Generation Activity</p>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 24, flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 10, color: "#555" }}>Weekly</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: "#f5f5f5", lineHeight: 1.1 }}>
              2,197 <span style={{ fontSize: 11, color: "#f97316" }}>↑19.6%</span>
            </p>
            <p style={{ fontSize: 8, color: "#444" }}>Compared to $1,340 last week</p>
          </div>
          <div>
            <p style={{ fontSize: 10, color: "#555" }}>Monthly</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: "#f5f5f5", lineHeight: 1.1 }}>
              8,903 <span style={{ fontSize: 11, color: "#f97316" }}>↑1.9%</span>
            </p>
            <p style={{ fontSize: 8, color: "#444" }}>Compared to $5,445 last month</p>
          </div>
        </div>

        {/* Tube chart + vertical markers */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <TubeAreaChart />
          {/* Vertical marker lines */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 20, pointerEvents: "none" }}>
            {[
              { left: "18%", label: "21,980", top: "8%" },
              { left: "42%", label: "1,122", top: "8%" },
              { left: "64%", label: "18,400", top: "8%" },
              { left: "10%", label: "12,222", bottom: "16%" },
              { left: "32%", label: "14,600", bottom: "16%" },
              { left: "82%", label: "1,122", bottom: "16%" },
            ].map((m, i) => (
              <div key={i} style={{
                position: "absolute",
                left: m.left,
                top: m.top,
                bottom: m.bottom,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}>
                <div style={{
                  background: "#1a1a1a",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 4,
                  padding: "2px 5px",
                  fontSize: 8,
                  color: "#ccc",
                  whiteSpace: "nowrap",
                }} />
              </div>
            ))}
          </div>
        </div>

        {/* Location table */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 6, display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          {locationData.map((row) => (
            <div key={row.city} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: "#888", minWidth: 80 }}>{row.city}</span>
              <span style={{ fontSize: 11, color: "#f5f5f5" }}>{row.cost}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#f5f5f5" }}>{row.total}</span>
            </div>
          ))}
        </div>
      </div>

      {/* MIDDLE — Timeline + Tokens + Resource Allocation */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>

        {/* Daily AI Usage Timeline */}
        <div style={{ background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 14, padding: 12, flexShrink: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#f5f5f5", marginBottom: 8 }}>Daily AI Usage Timeline</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {timelineData.map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 8, color: "#555", width: 20, textAlign: "right", flexShrink: 0 }}>{row.label}</span>
                <div style={{ flex: 1, height: 9, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden", position: "relative" }}>
                  {/* Grid lines inside bar track */}
                  {[20, 40, 60, 80].map(p => (
                    <div key={p} style={{ position: "absolute", left: `${p}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.06)" }} />
                  ))}
                  <div style={{
                    width: `${(row.value / 52000) * 100}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #7c2d12, #f97316)",
                    borderRadius: 3,
                    position: "relative",
                    zIndex: 1,
                  }} />
                </div>
                <span style={{ fontSize: 8, color: "#444", width: 24, textAlign: "right" }}>
                  {row.value >= 1000 ? `${Math.round(row.value / 1000)}k` : row.value}
                </span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: 26, marginTop: 1 }}>
              {["0", "10k", "20k", "30k", "40k", "50k"].map((l) => (
                <span key={l} style={{ fontSize: 7, color: "#333" }}>{l}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Tokens */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flexShrink: 0 }}>
          <div style={{ background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 14, padding: 12 }}>
            <p style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Tokens Used</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: "#f5f5f5", lineHeight: 1 }}>
              157<span style={{ fontSize: 9, color: "#555", marginLeft: 2 }}>4.2B</span>
            </p>
          </div>
          <div style={{ background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 14, padding: 12 }}>
            <p style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Tokens Processed</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: "#f5f5f5", lineHeight: 1 }}>
              4.2<span style={{ fontSize: 9, color: "#555", marginLeft: 2 }}>B</span>
            </p>
          </div>
        </div>

        {/* Resource Allocation */}
        <div style={{ background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 14, padding: 12, flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#f5f5f5", marginBottom: 8 }}>Resource Allocation</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {resourceData.map((r) => (
              <div key={r.name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: "#888" }}>{r.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#f5f5f5" }}>{r.value}%</span>
                </div>
                <div style={{ height: 7, borderRadius: 4, background: "rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
                  {[25, 50, 75].map(p => (
                    <div key={p} style={{ position: "absolute", left: `${p}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.06)", zIndex: 1 }} />
                  ))}
                  <div style={{
                    width: `${r.value}%`,
                    height: "100%",
                    borderRadius: 4,
                    background: "linear-gradient(90deg, #7c2d12, #f97316)",
                    position: "relative",
                    zIndex: 2,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — Task Completion Rate */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
        <div style={{ background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 14, padding: 12, display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#f5f5f5", marginBottom: 6 }}>Task Completion Rate</p>
          <TaskCompletionGauge />
        </div>
      </div>

    </div>
  );
}