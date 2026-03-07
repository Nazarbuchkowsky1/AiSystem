import React from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { pagesConfig } from "@/pages.config";

const mainPageKey = pagesConfig.mainPage ?? Object.keys(pagesConfig.Pages || {})[0];

export default function AgentsPreloadGuard({ children }) {
  const { pathname } = useLocation();
  const isAgentsRoute = pathname === "/Agents" || (pathname === "/" && mainPageKey === "Agents");

  const { isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => base44.entities.Agent.list("-created_date"),
    enabled: isAgentsRoute,
  });

  const { isLoading: kbLoading } = useQuery({
    queryKey: ["knowledgeBases"],
    queryFn: () => base44.entities.KnowledgeBase.list("-created_date"),
    enabled: isAgentsRoute,
  });

  const preloading = isAgentsRoute && (agentsLoading || kbLoading);

  if (preloading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: "rgba(249,115,22,0.12)",
            border: "1px solid rgba(249,115,22,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Loader2 style={{ width: 32, height: 32, color: "#f97316", animation: "app-init-spin 1s linear infinite" }} />
        </div>
        <style>{`@keyframes app-init-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return children;
}
