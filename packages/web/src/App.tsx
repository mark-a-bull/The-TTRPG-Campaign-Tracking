import { Route, Routes } from "react-router-dom";
import { SettingsProvider } from "./SettingsContext.js";
import { BattleConsole } from "./screens/BattleConsole.js";
import { CampaignDashboard } from "./screens/CampaignDashboard.js";
import { CampaignHome } from "./screens/CampaignHome.js";
import { HistoryLog } from "./screens/HistoryLog.js";
import { PublicDisplay } from "./screens/PublicDisplay.js";
import { SettingsScreen } from "./screens/SettingsScreen.js";

// The public display screen deliberately sits outside SettingsProvider: it's
// a standalone page (possibly opened on a different device entirely, like a
// TV browser) with its own fixed dark styling, not part of the GM app shell
// or its local light/dark theme preference.
function GmApp() {
  return (
    <SettingsProvider>
      <Routes>
        <Route path="/" element={<CampaignDashboard />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/campaigns/:campaignId" element={<CampaignHome />} />
        <Route path="/campaigns/:campaignId/sessions/:sessionId" element={<HistoryLog />} />
        <Route
          path="/campaigns/:campaignId/sessions/:sessionId/battles/:battleId"
          element={<BattleConsole />}
        />
      </Routes>
    </SettingsProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/display/:campaignId" element={<PublicDisplay />} />
      <Route path="/*" element={<GmApp />} />
    </Routes>
  );
}
