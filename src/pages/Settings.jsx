import React, { useState } from "react";
import { Globe, Bell, Shield, Palette, Plug, Monitor } from "lucide-react";

const SECTIONS = [
  { id: "general", label: "Загальні", icon: Globe },
  { id: "notifications", label: "Сповіщення", icon: Bell },
  { id: "security", label: "Безпека", icon: Shield },
  { id: "appearance", label: "Вигляд", icon: Palette },
  { id: "integrations", label: "Інтеграції", icon: Plug },
  { id: "system", label: "Система", icon: Monitor },
];

function SettingToggle({ checked: _checked, onChange: _onChange, label, description, defaultOn = false }) {
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
      <h1 className="text-xl font-semibold mb-6" style={{ color: "var(--text-primary)" }}>Налаштування</h1>

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
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Загальні налаштування</h2>
              <SettingToggle label="Автозбереження сесій" description="Автоматично зберігати історію діалогів" defaultOn />
              <SettingToggle label="Розумні підказки" description="Показувати AI-пропозиції в чаті" defaultOn />
              <SettingToggle label="Аналітика" description="Збирати дані використання для дашборду" defaultOn />
              <SettingToggle label="Режим розробника" description="Увімкнути розширені функції налагодження" />
            </div>
          )}
          {activeSection === "notifications" && (
            <div>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Сповіщення</h2>
              <SettingToggle label="Електронна пошта" description="Отримувати сповіщення на email про важливі події" defaultOn />
              <SettingToggle label="Сповіщення на робочому столі" description="Push-сповіщення в браузері" />
              <SettingToggle label="Сповіщення про завершення задач" description="Отримувати повідомлення коли задачі виконано" defaultOn />
              <SettingToggle label="Сповіщення про статус агентів" description="Повідомлення коли агенти відключаються" />
            </div>
          )}
          {activeSection === "security" && (
            <div>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Безпека</h2>
              <SettingToggle label="Двофакторна автентифікація" description="Додатковий рівень захисту" />
              <SettingToggle label="Шифрування API-ключів" description="Шифрувати всі збережені API-ключі" defaultOn />
              <SettingToggle label="Тайм-аут сесії" description="Автоматичний вихід через 30 хвилин неактивності" />
            </div>
          )}
          {activeSection === "appearance" && (
            <div>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Вигляд</h2>
              <SettingToggle label="Компактний режим" description="Зменшити відступи для більшої щільності контенту" />
              <SettingToggle label="Анімації" description="Увімкнути анімації та переходи UI" defaultOn />
              <SettingToggle label="Ефекти сяйва" description="Показувати ефекти сяйва на елементах інтерфейсу" defaultOn />
            </div>
          )}
          {activeSection === "integrations" && (
            <div>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Інтеграції</h2>
              <SettingToggle label="OpenAI API" description="Підключено та активно" defaultOn />
              <SettingToggle label="Локальний AI" description="Підключення до локальних AI-моделей" />
              <SettingToggle label="Вебхуки" description="Надсилати події на зовнішні вебхуки" />
            </div>
          )}
          {activeSection === "system" && (
            <div>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Система</h2>
              <SettingToggle label="Логі налагодження" description="Увімкнути детальне системне логування" />
              <SettingToggle label="Моніторинг продуктивності" description="Відстежувати метрики продуктивності системи" defaultOn />
              <SettingToggle label="Автооновлення" description="Автоматично оновлювати системні компоненти" defaultOn />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
