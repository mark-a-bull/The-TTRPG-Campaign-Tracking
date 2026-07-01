import { Route, Routes } from "react-router-dom";
import { CampaignDashboard } from "./screens/CampaignDashboard.js";
import { CampaignHome } from "./screens/CampaignHome.js";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CampaignDashboard />} />
      <Route path="/campaigns/:campaignId" element={<CampaignHome />} />
    </Routes>
  );
}
