import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { getSettings, updateSettings } from '@/store/storage';
import { Colors } from '@/constants/theme';
import { CurrencyCode, ThemeMode, Settings } from '@/store/types';

type ThemeColors = { text: string; background: string; backgroundElement: string; backgroundSelected: string; textSecondary: string };

interface ThemeContextValue {
  theme: ThemeMode;
  currency: CurrencyCode;
  loading: boolean;
  setTheme: (t: ThemeMode) => Promise<void>;
  setCurrency: (c: CurrencyCode) => Promise<void>;
  colors: ThemeColors;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceScheme = useColorScheme();
  const [settings, setSettings] = useState<Settings>({ theme: 'system', currency: 'INR' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await getSettings();
      setSettings(s);
    } catch (e) {
      console.error('Failed to load settings', e);
    } finally {
      setLoading(false);
    }
  };

  const resolvedTheme = useMemo<'light' | 'dark'>(() => {
    if (settings.theme === 'system') {
      return deviceScheme === 'dark' ? 'dark' : 'light';
    }
    return settings.theme;
  }, [settings.theme, deviceScheme]);

  const colors = useMemo(() => Colors[resolvedTheme], [resolvedTheme]);

  const setTheme = useCallback(async (t: ThemeMode) => {
    await updateSettings({ theme: t });
    setSettings((prev) => ({ ...prev, theme: t }));
  }, []);

  const setCurrency = useCallback(async (c: CurrencyCode) => {
    await updateSettings({ currency: c });
    setSettings((prev) => ({ ...prev, currency: c }));
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme: settings.theme,
    currency: settings.currency,
    loading,
    setTheme,
    setCurrency,
    colors,
    resolvedTheme,
  }), [settings.theme, settings.currency, loading, setTheme, setCurrency, colors, resolvedTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return ctx;
}
