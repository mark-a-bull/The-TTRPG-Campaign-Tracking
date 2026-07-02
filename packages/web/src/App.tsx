import { Route, Routes } from "react-router-dom";
import { BattleConsole } from "./screens/BattleConsole.js";
import { CampaignDashboard } from "./screens/CampaignDashboard.js";
import { CampaignHome } from "./screens/CampaignHome.js";
import { HistoryLog } from "./screens/HistoryLog.js";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CampaignDashboard />} />
      <Route path="/campaigns/:campaignId" element={<CampaignHome />} />
      <Route path="/campaigns/:campaignId/sessions/:sessionId" element={<HistoryLog />} />
      <Route
        path="/campaigns/:campaignId/sessions/:sessionId/battles/:battleId"
        element={<BattleConsole />}
      />
    </Routes>
  );
}
