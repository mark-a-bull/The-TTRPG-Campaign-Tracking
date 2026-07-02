import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { entityTypeConfig, entityTypes } from "@ttrpg/shared";
import { useCampaign } from "../api/campaigns.js";
import { Button } from "../ui/Button.js";
import { Tabs } from "../ui/Tabs.js";
import { TopAppBar } from "../ui/TopAppBar.js";
import { EntityList } from "./EntityList.js";
import { SessionBanner } from "./SessionBanner.js";

export function CampaignHome() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { data: campaign, isLoading } = useCampaign(campaignId);
  const [tabIndex, setTabIndex] = useState(0);

  if (isLoading || !campaign) {
    return <p style={{ padding: 24 }}>Loading campaign…</p>;
  }

  const entityType = entityTypes[tabIndex];

  return (
    <div>
      <TopAppBar
        title={campaign.name}
        leading={
          <Button variant="text" onClick={() => navigate("/")}>
            ← Campaigns
          </Button>
        }
      />
      <SessionBanner campaignId={campaign.id} />
      <Tabs
        labels={entityTypes.map((type) => entityTypeConfig[type].pluralLabel)}
        selectedIndex={tabIndex}
        onChange={setTabIndex}
      />
      <div style={{ padding: 24 }}>
        <EntityList key={entityType} campaignId={campaign.id} entityType={entityType} />
      </div>
    </div>
  );
}
