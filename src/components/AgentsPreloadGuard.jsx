import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { logStep } from "@/lib/clientLogger";

// Single initial load: fetch analytics, agents, and KB once so Analytics/Agents/Tools open without a second loader
export default function AgentsPreloadGuard({ children }) {
  const { isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      logStep("Preload", "getAnalytics: start");
      const data = await base44.functions.invoke("getAnalytics", {}).then((r) => r?.data ?? {});
      logStep("Preload", "getAnalytics: done");
      return data;
    },
    staleTime: 60 * 1000,
  });

  const { isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      logStep("Preload", "Agent.list: start");
      const list = await base44.entities.Agent.list("-created_date");
      logStep("Preload", "Agent.list: done count", list?.length);
      return list;
    },
    staleTime: 60 * 1000,
  });

  const { isLoading: kbLoading } = useQuery({
    queryKey: ["knowledgeBases"],
    queryFn: async () => {
      logStep("Preload", "KnowledgeBase.list: start");
      const list = await base44.entities.KnowledgeBase.list("-created_date");
      logStep("Preload", "KnowledgeBase.list: done count", list?.length);
      return list;
    },
    staleTime: 60 * 1000,
  });

  const preloading = analyticsLoading || agentsLoading || kbLoading;

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
