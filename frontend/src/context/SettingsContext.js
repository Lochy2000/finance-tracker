import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { settingsApi } from '../lib/api';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    currency: 'GBP',
    date_format: 'DD/MM/YYYY',
    theme: 'light',
    notifications_enabled: true,
  });
  const [loaded, setLoaded] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await settingsApi.get();
      setSettings(response.data);
      applyTheme(response.data.theme);
    } catch {
      // Use defaults
    } finally {
      setLoaded(true);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings) => {
    setSettings(newSettings);
    applyTheme(newSettings.theme);
    try {
      await settingsApi.update(newSettings);
    } catch {
      // Best-effort save
    }
  }, []);

  const value = useMemo(() => ({
    settings,
    loaded,
    fetchSettings,
    updateSettings,
  }), [settings, loaded, fetchSettings, updateSettings]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
