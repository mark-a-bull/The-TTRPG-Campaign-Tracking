import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface ColorScheme {
  primary: string;
  surface: string;
  onSurface: string;
  background: string;
  onBackground: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
}

interface Settings {
  darkMode: boolean;
  colorScheme: ColorScheme;
}

interface SettingsContextValue {
  settings: Settings;
  setDarkMode: (value: boolean) => void;
  setColorScheme: (colors: Partial<ColorScheme>) => void;
  resetColorScheme: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_KEY = "ttrpg-settings";

const defaultLightColors: ColorScheme = {
  primary: "#6750a4",
  surface: "#fffbfe",
  onSurface: "#1c1b1f",
  background: "#fffbfe",
  onBackground: "#1c1b1f",
  surfaceVariant: "#e7e0ec",
  onSurfaceVariant: "#49454f",
};

const defaultDarkColors: ColorScheme = {
  primary: "#d0bcff",
  surface: "#1c1b1f",
  onSurface: "#e6e1e5",
  background: "#1c1b1f",
  onBackground: "#e6e1e5",
  surfaceVariant: "#49454f",
  onSurfaceVariant: "#cac4d0",
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        darkMode: parsed.darkMode ?? false,
        colorScheme: parsed.colorScheme ?? (parsed.darkMode ? defaultDarkColors : defaultLightColors),
      };
    }
  } catch {
    // ignore
  }
  return { darkMode: false, colorScheme: defaultLightColors };
}

function applyColorScheme(colors: ColorScheme) {
  const root = document.documentElement;
  root.style.setProperty("--md-sys-color-primary", colors.primary);
  root.style.setProperty("--md-sys-color-surface", colors.surface);
  root.style.setProperty("--md-sys-color-on-surface", colors.onSurface);
  root.style.setProperty("--md-sys-color-background", colors.background);
  root.style.setProperty("--md-sys-color-on-background", colors.onBackground);
  root.style.setProperty("--md-sys-color-surface-variant", colors.surfaceVariant);
  root.style.setProperty("--md-sys-color-on-surface-variant", colors.onSurfaceVariant);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.classList.toggle("dark", settings.darkMode);
    applyColorScheme(settings.colorScheme);
  }, [settings]);

  function setDarkMode(value: boolean) {
    setSettings((prev) => ({
      ...prev,
      darkMode: value,
      colorScheme: value ? defaultDarkColors : defaultLightColors,
    }));
  }

  function setColorScheme(colors: Partial<ColorScheme>) {
    setSettings((prev) => ({
      ...prev,
      colorScheme: { ...prev.colorScheme, ...colors },
    }));
  }

  function resetColorScheme() {
    setSettings((prev) => ({
      ...prev,
      colorScheme: prev.darkMode ? defaultDarkColors : defaultLightColors,
    }));
  }

  return (
    <SettingsContext.Provider value={{ settings, setDarkMode, setColorScheme, resetColorScheme }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
