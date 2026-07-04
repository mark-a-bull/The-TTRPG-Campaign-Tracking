import { useNavigate } from "react-router-dom";
import { useSettings } from "../SettingsContext.js";
import { Button } from "../ui/Button.js";
import { IconButton } from "../ui/IconButton.js";
import { TopAppBar } from "../ui/TopAppBar.js";

const colorLabels: Record<string, string> = {
  primary: "Primary",
  surface: "Surface",
  onSurface: "Text on Surface",
  background: "Background",
  onBackground: "Text on Background",
  surfaceVariant: "Surface Variant",
  onSurfaceVariant: "Text on Variant",
};

export function SettingsScreen() {
  const { settings, setDarkMode, setColorScheme, resetColorScheme } = useSettings();
  const navigate = useNavigate();

  return (
    <div>
      <TopAppBar
        title="Settings"
        leading={
          <IconButton icon="arrow_back" label="Back" onClick={() => navigate(-1)} />
        }
      />
      <div style={{ padding: 24, maxWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>Appearance</h2>

        {/* Dark Mode Toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "var(--md-sys-color-surface-variant)",
            borderRadius: 12,
            marginBottom: 24,
          }}
        >
          <span>Dark Mode</span>
          <input
            type="checkbox"
            checked={settings.darkMode}
            onChange={(e) => setDarkMode(e.target.checked)}
            style={{
              width: 48,
              height: 28,
              accentColor: "var(--md-sys-color-primary)",
            }}
          />
        </div>

        {/* Color Scheme */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Color Scheme</h3>
            <Button variant="text" onClick={resetColorScheme}>
              Reset
            </Button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            {Object.entries(settings.colorScheme).map(([key, value]) => (
              <label
                key={key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: 12,
                  background: "var(--md-sys-color-surface-variant)",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>
                  {colorLabels[key] || key}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => setColorScheme({ [key]: e.target.value })}
                    style={{
                      width: 32,
                      height: 32,
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, fontFamily: "monospace" }}>{value}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
