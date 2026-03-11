import React, { useState } from "react";
import { Globe, Bell, Shield, Palette, Plug, Monitor } from "lucide-react";

const SECTIONS = [
  { id: "general", label: "General", icon: Globe },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "system", label: "System", icon: Monitor },
];

function SettingToggle({ label, description, defaultOn = false }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{description}</p>
      </div>
      <button
        onClick={() => setOn(!on)}
        className="w-10 h-6 rounded-full transition-all relative"
        style={{
          background: on ? "var(--accent)" : "rgba(255,255,255,0.1)",
          boxShadow: on ? "0 0 12px rgba(249,115,22,0.3)" : "none",
        }}
      >
        <div
          className="w-4 h-4 rounded-full absolute top-1 transition-all"
          style={{
            left: on ? 22 : 4,
            background: on ? "#fff" : "var(--text-muted)",
          }}
        />
      </button>
    </div>
  );
}

export default function Settings() {
  const [activeSection, setActiveSection] = useState("general");

  return (
    <div className="p-6 h-full overflow-auto">
      <h1 className="text-xl font-semibold mb-6" style={{ color: "var(--text-primary)" }}>Settings</h1>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full md:w-56 flex-shrink-0 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap flex-shrink-0"
                style={{
                  background: isActive ? "var(--accent-dim)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 glass-panel p-6">
          {activeSection === "general" && (
            <div>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>General Settings</h2>
              <SettingToggle label="Auto-save sessions" description="Automatically save conversation history" defaultOn />
              <SettingToggle label="Smart suggestions" description="Show AI-powered suggestions in chat" defaultOn />
              <SettingToggle label="Analytics tracking" description="Collect usage analytics for dashboard" defaultOn />
              <SettingToggle label="Developer mode" description="Enable advanced debugging features" />
            </div>
          )}
          {activeSection === "notifications" && (
            <div>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Notifications</h2>
              <SettingToggle label="Email notifications" description="Receive email alerts for important events" defaultOn />
              <SettingToggle label="Desktop notifications" description="Browser push notifications" />
              <SettingToggle label="Task completion alerts" description="Get notified when tasks are completed" defaultOn />
              <SettingToggle label="Agent status alerts" description="Notifications when agents go offline" />
            </div>
          )}
          {activeSection === "security" && (
            <div>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Security</h2>
              <SettingToggle label="Two-factor authentication" description="Add an extra layer of security" />
              <SettingToggle label="API key encryption" description="Encrypt all stored API keys" defaultOn />
              <SettingToggle label="Session timeout" description="Auto-logout after 30 minutes of inactivity" />
            </div>
          )}
          {activeSection === "appearance" && (
            <div>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Appearance</h2>
              <SettingToggle label="Compact mode" description="Reduce spacing for more content density" />
              <SettingToggle label="Animations" description="Enable UI animations and transitions" defaultOn />
              <SettingToggle label="Glow effects" description="Show ambient glow effects on UI elements" defaultOn />
            </div>
          )}
          {activeSection === "integrations" && (
            <div>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Integrations</h2>
              <SettingToggle label="OpenAI API" description="Connected and active" defaultOn />
              <SettingToggle label="Local AI Bridge" description="Connect to local AI models" />
              <SettingToggle label="Webhook notifications" description="Send events to external webhooks" />
            </div>
          )}
          {activeSection === "system" && (
            <div>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>System</h2>
              <SettingToggle label="Debug logging" description="Enable verbose system logging" />
              <SettingToggle label="Performance monitoring" description="Track system performance metrics" defaultOn />
              <SettingToggle label="Auto-updates" description="Automatically update system components" defaultOn />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}