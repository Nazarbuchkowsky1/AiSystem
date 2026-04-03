import React from "react";
import { Wrench, Image, Globe, Video } from "lucide-react";

const TOOLS = [
  {
    id: "carousel_creator",
    name: "Створення каруселей",
    description: "Автоматизована генерація каруселей для соціальних мереж",
    icon_name: "Image",
  },
  {
    id: "site_builder",
    name: "Створення сайтів",
    description: "Створення та запуск сайтів під міні-продукти, інфобіз",
    icon_name: "Globe",
  },
  {
    id: "reels_generator",
    name: "Генерація рілсів",
    description: "Створення відео-рілсів для соціальних мереж",
    icon_name: "Video",
  },
];

const iconMap = { Image, Globe, Video };

export default function Tools() {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0a0a" }}>
      <div style={{
        padding: "14px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(90deg, rgba(249,115,22,0.03), transparent)",
        height: 64,
        boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(251,146,60,0.08))",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid rgba(249,115,22,0.2)",
            boxShadow: "0 2px 12px rgba(249,115,22,0.15)"
          }}>
            <Wrench style={{ width: 18, height: 18, color: "#f97316" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#f5f5f5", margin: 0, lineHeight: 1.2, letterSpacing: "-0.02em" }}>Інструменти</h1>
            <p style={{ fontSize: 11, color: "#555", margin: 0, fontWeight: 500 }}>
              {TOOLS.length} інструментів доступно
            </p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {TOOLS.map(tool => {
              const Icon = iconMap[tool.icon_name] || Wrench;
              return (
                <div key={tool.id} className="tools-stub-card">
                  <div style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}>
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#22c55e",
                      boxShadow: "0 0 8px rgba(34,197,94,0.6)",
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>активний</span>
                  </div>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 12,
                  }}>
                    <Icon style={{ width: 16, height: 16, color: "#f97316" }} />
                  </div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5", margin: "0 0 4px 0" }}>{tool.name}</h3>
                  <p style={{ fontSize: 11, color: "#666", margin: 0, lineHeight: 1.4 }}>{tool.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {TOOLS.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#444" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#666", marginBottom: 4 }}>Інструментів ще немає</div>
          </div>
        )}
      </div>
    </div>
  );
}
