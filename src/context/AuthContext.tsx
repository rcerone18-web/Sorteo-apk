import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../api/client';
import { initConfig } from '../config';
import { initDb } from '../db';
import type { Usuario } from '../types';

const TOKEN_KEY = '@sorteo_token';
const USER_KEY = '@sorteo_user';

interface AuthState {
  user: Usuario | null;
  token: string | null;
  isLoading: boolean;
  isRestored: boolean;
}

interface AuthContextType extends AuthState {
  login: (usuario: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: false,
    isRestored: false,
  });

  const restoreSession = useCallback(async () => {
    try {
      const [t, u] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);
      if (t && u) {
        api.setAuthToken(t);
        setState((s) => ({ ...s, token: t, user: JSON.parse(u) as Usuario, isRestored: true }));
      } else {
        setState((s) => ({ ...s, isRestored: true }));
      }
    } catch {
      setState((s) => ({ ...s, isRestored: true }));
    }
  }, []);

  useEffect(() => {
    (async () => {
      await initConfig();
      await initDb();
      await restoreSession();
    })();
  }, [restoreSession]);

  const login = useCallback(async (usuario: string, clave: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const res = await api.login({ usuario, clave });
      api.setAuthToken(res.token);
      await AsyncStorage.setItem(TOKEN_KEY, res.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.usuario));
      setState({
        user: res.usuario,
        token: res.token,
        isLoading: false,
        isRestored: true,
      });
    } finally {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  const logout = useCallback(async () => {
    api.setAuthToken(null);
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setState({ user: null, token: null, isLoading: false, isRestored: true });
  }, []);

  useEffect(() => {
    api.setOnAuthError(() => {
      logout();
    });
    return () => api.setOnAuthError(null);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, restoreSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
