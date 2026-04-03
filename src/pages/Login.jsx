import React, { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Loader2 } from "lucide-react";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "";

export default function Login() {
  const { loginWithTelegram } = useAuth();
  const widgetRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notRegistered, setNotRegistered] = useState(false);

  const onTelegramAuth = useCallback(
    async (user) => {
      if (!user || user.id == null) {
        setError("Некоректна відповідь Telegram");
        return;
      }
      setError("");
      setLoading(true);
      try {
        await loginWithTelegram(user);
        window.location.href = "/";
      } catch (err) {
        if (
          err.status === 403 &&
          (err.code === "NOT_IN_AIRTABLE" || err.data?.code === "NOT_IN_AIRTABLE" || err.data?.error === "not_registered")
        ) {
          setNotRegistered(true);
        } else {
          setError(err.message || "Не вдалося увійти");
        }
      } finally {
        setLoading(false);
      }
    },
    [loginWithTelegram]
  );

  useEffect(() => {
    if (!BOT_USERNAME) return undefined;
    window.onTelegramAuth = onTelegramAuth;
    const container = widgetRef.current;
    if (!container) return undefined;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    container.appendChild(script);
    return () => {
      delete window.onTelegramAuth;
      script.remove();
    };
  }, [onTelegramAuth]);

  if (notRegistered) {
    return <UserNotRegisteredError onBack={() => setNotRegistered(false)} />;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: 380,
          padding: 32,
          borderRadius: 16,
          background: "#0f0f0f",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png?v=2" alt="Lumen" style={{ width: 36, height: 36, borderRadius: 10 }} />
          <span style={{ color: "#f5f5f5", fontWeight: 600, fontSize: 18, letterSpacing: "0.05em" }}>Lumen</span>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: "#888", textAlign: "center", lineHeight: 1.5 }}>
          Увійдіть через Telegram. Доступ мають лише користувачі з дозволеного списку.
        </p>

        {error && (
          <div
            style={{
              width: "100%",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#fca5a5",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {!BOT_USERNAME && (
          <div
            style={{
              width: "100%",
              background: "rgba(249,115,22,0.08)",
              border: "1px solid rgba(249,115,22,0.25)",
              borderRadius: 8,
              padding: "10px 12px",
              color: "#fdba74",
              fontSize: 12,
              textAlign: "center",
            }}
          >
            Додайте у .env змінну VITE_TELEGRAM_BOT_USERNAME (ім’я бота без @) і перезапустіть dev-сервер.
          </div>
        )}

        <div ref={widgetRef} style={{ minHeight: BOT_USERNAME ? 44 : 0, display: "flex", justifyContent: "center" }} />

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#888", fontSize: 13 }}>
            <Loader2 style={{ width: 16, height: 16, animation: "login-spin 1s linear infinite" }} />
            Вхід…
          </div>
        )}

        <style>{`@keyframes login-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
