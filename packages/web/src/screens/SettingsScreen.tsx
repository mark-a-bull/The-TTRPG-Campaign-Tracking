import { useNavigate } from "react-router-dom";
import { useSettings } from "../SettingsContext.js";
import { IconButton } from "../ui/IconButton.js";
import { TopAppBar } from "../ui/TopAppBar.js";

export function SettingsScreen() {
  const { settings, setDarkMode } = useSettings();
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
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "var(--md-sys-color-surface-variant)",
            borderRadius: 12,
            cursor: "pointer",
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
        </label>
      </div>
    </div>
  );
}
