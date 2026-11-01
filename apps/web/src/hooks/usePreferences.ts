import { useState, useEffect } from 'react';
import { SortOption } from '@github-discovery/shared';

export interface Preferences {
  theme: 'light' | 'dark' | 'system';
  defaultSort: SortOption;
  pageSize: number;
}

const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  defaultSort: 'newest',
  pageSize: 25,
};

const STORAGE_KEY = 'github_discovery_preferences';

export function usePreferences() {
  const [preferences, setPreferencesState] = useState<Preferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load preferences from localStorage', e);
    }
    return DEFAULT_PREFERENCES;
  });

  const updatePreferences = (updates: Partial<Preferences>) => {
    setPreferencesState((prev) => {
      const updated = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save preferences to localStorage', e);
      }
      return updated;
    });
  };

  useEffect(() => {
    // Theme application
    const root = document.documentElement;
    const isDark =
      preferences.theme === 'dark' ||
      (preferences.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [preferences.theme]);

  return { preferences, updatePreferences };
}

