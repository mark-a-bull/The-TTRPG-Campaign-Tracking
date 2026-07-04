import { Route, Routes } from "react-router-dom";
import { SettingsProvider } from "./SettingsContext.js";
import { BattleConsole } from "./screens/BattleConsole.js";
import { CampaignDashboard } from "./screens/CampaignDashboard.js";
import { CampaignHome } from "./screens/CampaignHome.js";
import { HistoryLog } from "./screens/HistoryLog.js";
import { SettingsScreen } from "./screens/SettingsScreen.js";

export default function App() {
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
