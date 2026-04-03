import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { logStep, addLogEntry } from '@/lib/clientLogger';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: 'local', public_settings: {} });

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      logStep("Auth", "checkAppState: start");
      setAuthError(null);

      const token = localStorage.getItem('auth_token');
      if (token) {
        await checkUserAuth();
      } else {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        logStep("Auth", "checkAppState: no token");
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      addLogEntry({ tag: "Auth", message: `checkAppState unexpected: ${error?.message || error}`, level: "error" });
      setAuthError({ type: 'unknown', message: error.message || 'An unexpected error occurred' });
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      logStep("Auth", "checkUserAuth: start");
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      logStep("Auth", "checkUserAuth: done", currentUser?.email || currentUser?.id);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      addLogEntry({ tag: "Auth", message: `checkUserAuth failed: ${error?.message || error}`, level: "error" });
      localStorage.removeItem('auth_token');
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
    }
  };

  const login = async (email, password) => {
    const result = await base44.auth.login(email, password);
    setUser(result.user);
    setIsAuthenticated(true);
    setAuthError(null);
    return result;
  };

  const loginWithTelegram = async (telegramPayload) => {
    const result = await base44.auth.loginTelegram(telegramPayload);
    setUser(result.user);
    setIsAuthenticated(true);
    setAuthError(null);
    return result;
  };

  const logout = (shouldRedirect = true) => {
    logStep("Auth", "logout", shouldRedirect ? "redirect" : "local");
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('auth_token');
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    logStep("Auth", "navigateToLogin");
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      login,
      loginWithTelegram,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
