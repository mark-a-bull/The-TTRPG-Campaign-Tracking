import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface Settings {
  darkMode: boolean;
}

interface SettingsContextValue {
  settings: Settings;
  setDarkMode: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_KEY = "ttrpg-settings";

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { darkMode: parsed.darkMode ?? false };
    }
  } catch {
    // ignore
  }
  return { darkMode: false };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.classList.toggle("dark", settings.darkMode);
  }, [settings]);

  function setDarkMode(value: boolean) {
    setSettings((prev) => ({ ...prev, darkMode: value }));
  }

  return (
    <SettingsContext.Provider value={{ settings, setDarkMode }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
