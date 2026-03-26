import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <form onSubmit={handleSubmit} style={{
        width: 360, padding: 32, borderRadius: 16,
        background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <img src="/logo.png?v=2" alt="Lumen" style={{ width: 36, height: 36, borderRadius: 10 }} />
          <span style={{ color: '#f5f5f5', fontWeight: 600, fontSize: 18, letterSpacing: '0.05em' }}>Lumen</span>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', color: '#fca5a5', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
            style={{
              background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
              padding: '10px 14px', color: '#f5f5f5', fontSize: 14, outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(249,115,22,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>Password</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)} required
            style={{
              background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
              padding: '10px 14px', color: '#f5f5f5', fontSize: 14, outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(249,115,22,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>

        <button type="submit" disabled={loading} style={{
          background: loading ? 'rgba(249,115,22,0.3)' : 'rgba(249,115,22,0.9)',
          color: '#fff', border: 'none', borderRadius: 10, padding: '11px 0',
          fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 0.2s', marginTop: 4,
        }}>
          {loading && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </form>
    </div>
  );
}
