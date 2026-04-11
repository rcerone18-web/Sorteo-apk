import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import type { AppTheme } from './theme';
import { darkTheme, lightTheme } from './theme';

type ThemeMode = 'light' | 'dark';

const THEME_MODE_KEY = '@sorteo_theme_mode';

type ThemeContextValue = {
  theme: AppTheme;
  mode: ThemeMode;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme debe usarse dentro de ThemeProvider');
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const systemMode: ThemeMode = systemScheme === 'dark' ? 'dark' : 'light';

  const [mode, setMode] = useState<ThemeMode>(systemMode);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_MODE_KEY);
        if (!mounted) return;
        if (saved === 'light' || saved === 'dark') setMode(saved);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const theme = useMemo(() => {
    return (mode === 'dark' ? darkTheme : lightTheme) as AppTheme;
  }, [mode]);

  const toggleTheme = () => {
    setMode((m) => {
      const next: ThemeMode = m === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(THEME_MODE_KEY, next).catch(() => {});
      return next;
    });
  };

  return <ThemeContext.Provider value={{ theme, mode, toggleTheme }}>{children}</ThemeContext.Provider>;
}

