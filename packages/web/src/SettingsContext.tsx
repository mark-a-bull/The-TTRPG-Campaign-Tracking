import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ColorScheme, Settings, SettingsUpdate } from "@ttrpg/shared";
import { useSettingsQuery, useUpdateSettings } from "./api/settings.js";

interface SettingsContextValue {
  settings: Settings;
  setDarkMode: (value: boolean) => void;
  setColorScheme: (colors: Partial<ColorScheme>) => void;
  resetColorScheme: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// Pre-server-persistence key this app used to read/write directly -- kept
// around only so migrateLegacySettings can read it once. Never written to
// again after this ships.
const LEGACY_STORAGE_KEY = "ttrpg-settings";
const MIGRATED_KEY = "ttrpg-settings-migrated";

const COLOR_PUT_DEBOUNCE_MS = 400;

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
  surface: "#74698c",
  onSurface: "#e6e1e5",
  background: "#1c1b1f",
  onBackground: "#e6e1e5",
  surfaceVariant: "#49454f",
  onSurfaceVariant: "#cac4d0",
};

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

/** Pushes a pre-existing localStorage value to the server, once per browser.
 * Guarded by MIGRATED_KEY rather than "does the server already have a
 * non-default value" -- the server can't tell "never customized" apart from
 * "customized to exactly the defaults". Two devices that both had different
 * local values before this shipped will race on whichever loads first; an
 * accepted one-time edge case, not synced/reconciled further. */
async function migrateLegacySettings(putSettings: (data: SettingsUpdate) => Promise<unknown>) {
  if (localStorage.getItem(MIGRATED_KEY)) return;
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const darkMode: boolean = parsed.darkMode ?? false;
      const colorScheme: ColorScheme = parsed.colorScheme ?? (darkMode ? defaultDarkColors : defaultLightColors);
      await putSettings({ darkMode, colorScheme });
    }
  } catch {
    // Malformed legacy value -- nothing sensible to migrate.
  } finally {
    localStorage.setItem(MIGRATED_KEY, "true");
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [migrationDone, setMigrationDone] = useState(false);
  const updateSettings = useUpdateSettings();
  const query = useSettingsQuery({ enabled: migrationDone });
  const [settings, setSettings] = useState<Settings | null>(null);
  const pendingColorPatchRef = useRef<Partial<ColorScheme>>({});
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    migrateLegacySettings((data) => updateSettings.mutateAsync(data)).finally(() => setMigrationDone(true));
    // Intentionally mount-only: `mutateAsync` is stable across renders, but
    // `updateSettings` itself is a new object every render (isPending etc.
    // change) -- depending on it would break the once-per-mount intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Seed local state once from the initial fetch only -- after that, local
    // optimistic state is authoritative so a background refetch (e.g. on
    // window focus) can't clobber an in-flight edit with a stale response.
    if (query.data && settings === null) setSettings(query.data);
  }, [query.data, settings]);

  useEffect(() => {
    if (!settings) return;
    document.documentElement.classList.toggle("dark", settings.darkMode);
    applyColorScheme(settings.colorScheme);
  }, [settings]);

  function setDarkMode(value: boolean) {
    const colorScheme = value ? defaultDarkColors : defaultLightColors;
    setSettings((prev) => (prev ? { ...prev, darkMode: value, colorScheme } : prev));
    updateSettings.mutate({ darkMode: value, colorScheme });
  }

  function setColorScheme(colors: Partial<ColorScheme>) {
    setSettings((prev) => (prev ? { ...prev, colorScheme: { ...prev.colorScheme, ...colors } } : prev));

    // Native <input type="color"> fires onChange continuously while
    // dragging -- accumulate the patch and debounce the PUT rather than
    // firing one per drag tick. Merge into any already-pending patch so
    // touching two different color fields within the debounce window
    // doesn't drop the earlier one.
    pendingColorPatchRef.current = { ...pendingColorPatchRef.current, ...colors };
    clearTimeout(colorDebounceRef.current);
    colorDebounceRef.current = setTimeout(() => {
      const patch = pendingColorPatchRef.current;
      pendingColorPatchRef.current = {};
      updateSettings.mutate({ colorScheme: patch });
    }, COLOR_PUT_DEBOUNCE_MS);
  }

  function resetColorScheme() {
    clearTimeout(colorDebounceRef.current);
    pendingColorPatchRef.current = {};
    setSettings((prev) => {
      if (!prev) return prev;
      const colorScheme = prev.darkMode ? defaultDarkColors : defaultLightColors;
      updateSettings.mutate({ colorScheme });
      return { ...prev, colorScheme };
    });
  }

  if (!settings) return null;

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
