import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { AlertTriangle } from "lucide-react";

export default function PageNotFound() {
  return (
    <div className="h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-dim)" }}>
          <AlertTriangle className="w-7 h-7" style={{ color: "var(--accent)" }} />
        </div>
        <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>404 — Сторінку не знайдено</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Сторінка, яку ви шукаєте, не існує</p>
        <Link
          to={createPageUrl("Agents")}
          className="px-5 py-2.5 rounded-xl text-sm font-medium inline-block transition hover:opacity-90"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Повернутися до головної
        </Link>
      </div>
    </div>
  );
}