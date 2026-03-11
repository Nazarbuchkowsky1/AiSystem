import React from "react";

const SIZE = 300;
const CENTER = SIZE / 2;
const MAX_R = 120;
const MIN_R = 15;

export default function LifeWheel({ areas }) {
  if (!areas || areas.length === 0) return null;
  const n = areas.length;
  const angleStep = (2 * Math.PI) / n;

  const getPoint = (angle, radius) => ({
    x: CENTER + radius * Math.cos(angle - Math.PI / 2),
    y: CENTER + radius * Math.sin(angle - Math.PI / 2),
  });

  const rings = [2, 4, 6, 8, 10];

  const scorePoints = areas.map((a, i) => {
    const r = MIN_R + ((a.current_score || 1) / 10) * (MAX_R - MIN_R);
    return getPoint(i * angleStep, r);
  });
  const scorePath = scorePoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";

  // Build gradient fill segments per area
  const segPaths = areas.map((a, i) => {
    const angle1 = i * angleStep - Math.PI / 2;
    const angle2 = (i + 1) * angleStep - Math.PI / 2;
    const r = MIN_R + ((a.current_score || 1) / 10) * (MAX_R - MIN_R);
    const midAngle = (angle1 + angle2) / 2;
    
    // Polygon: center -> current on axis i -> arc-like midpoint -> current on axis i+1 -> center
    const p1 = getPoint(i * angleStep, r);
    const nextIdx = (i + 1) % n;
    const r2 = MIN_R + ((areas[nextIdx].current_score || 1) / 10) * (MAX_R - MIN_R);
    const p2 = getPoint((i + 1) * angleStep, r2);

    return { p1, p2, color: a.color || "#f97316" };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <radialGradient id="wheelGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(249,115,22,0.08)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* Background glow */}
        <circle cx={CENTER} cy={CENTER} r={MAX_R + 10} fill="url(#wheelGlow)" />

        {/* Grid rings */}
        {rings.map((v) => {
          const r = MIN_R + (v / 10) * (MAX_R - MIN_R);
          return (
            <circle key={v} cx={CENTER} cy={CENTER} r={r}
              fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1}
              strokeDasharray={v === 10 ? "none" : "2 4"} />
          );
        })}

        {/* Axis lines with area color at tip */}
        {areas.map((a, i) => {
          const p = getPoint(i * angleStep, MAX_R + 5);
          return (
            <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y}
              stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          );
        })}

        {/* Filled score polygon */}
        <path d={scorePath}
          fill="rgba(249,115,22,0.1)"
          stroke="rgba(249,115,22,0.6)"
          strokeWidth={2}
          strokeLinejoin="round"
          filter="url(#glow)"
        />

        {/* Score dots with area colors */}
        {scorePoints.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={6} fill={areas[i].color || "#f97316"} opacity={0.2} />
            <circle cx={p.x} cy={p.y} r={4} fill={areas[i].color || "#f97316"} stroke="#0a0a0a" strokeWidth={2} />
          </g>
        ))}

        {/* Labels */}
        {areas.map((a, i) => {
          const labelR = MAX_R + 28;
          const p = getPoint(i * angleStep, labelR);
          return (
            <g key={`label-${i}`}>
              <text x={p.x} y={p.y - 6}
                textAnchor="middle" dominantBaseline="middle"
                fill={a.color || "#888"} fontSize={10} fontWeight={700}
              >
                {a.name}
              </text>
              <text x={p.x} y={p.y + 7}
                textAnchor="middle" dominantBaseline="middle"
                fill="#666" fontSize={9} fontWeight={500}
              >
                {a.current_score || 1}/10
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}