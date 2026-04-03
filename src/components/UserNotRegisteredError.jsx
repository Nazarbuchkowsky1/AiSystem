import React from 'react';

export default function UserNotRegisteredError({ onBack }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        padding: 24,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          padding: 28,
          background: '#0f0f0f',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              marginBottom: 16,
              borderRadius: '50%',
              background: 'rgba(249,115,22,0.12)',
              border: '1px solid rgba(249,115,22,0.25)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f5f5f5', margin: '0 0 12px' }}>Доступ обмежено</h1>
          <p style={{ fontSize: 14, color: '#888', margin: '0 0 20px', lineHeight: 1.55 }}>
            Вас немає у списку дозволених користувачів. Зверніться до адміністратора, щоб додали вас у базу.
          </p>
          <div style={{ padding: 14, borderRadius: 10, background: '#141414', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'left' }}>
            <p style={{ fontSize: 12, color: '#666', margin: 0 }}>Можливо:</p>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#888', fontSize: 12, lineHeight: 1.6 }}>
              <li>Перевірте, що увійшли правильним акаунтом Telegram</li>
              <li>Попросіть адміна додати ваш Telegram ID у Airtable</li>
            </ul>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                marginTop: 20,
                padding: '10px 20px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'transparent',
                color: '#f5f5f5',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Назад до входу
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
