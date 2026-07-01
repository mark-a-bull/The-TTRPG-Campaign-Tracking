import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCampaigns, useCreateCampaign } from "../api/campaigns.js";
import { Button } from "../ui/Button.js";
import { Card } from "../ui/Card.js";
import { Dialog } from "../ui/Dialog.js";
import { TextField } from "../ui/TextField.js";
import { TopAppBar } from "../ui/TopAppBar.js";

export function CampaignDashboard() {
  const { data: campaigns, isLoading } = useCampaigns();
  const createCampaign = useCreateCampaign();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function resetAndClose() {
    setDialogOpen(false);
    setName("");
    setDescription("");
  }

  return (
    <div>
      <TopAppBar title="Campaigns" />
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Your Campaigns</h1>
          <Button onClick={() => setDialogOpen(true)}>New Campaign</Button>
        </div>

        {isLoading ? <p>Loading…</p> : null}
        {campaigns && campaigns.length === 0 ? <p>No campaigns yet. Create your first one.</p> : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {campaigns?.map((campaign) => (
            <Card key={campaign.id} onClick={() => navigate(`/campaigns/${campaign.id}`)}>
              <div style={{ padding: 16 }}>
                {campaign.coverImageUrl ? (
                  <img
                    src={campaign.coverImageUrl}
                    alt=""
                    style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8, marginBottom: 8 }}
                  />
                ) : null}
                <div style={{ fontSize: 18, fontWeight: 500 }}>{campaign.name}</div>
                <div style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
                  {campaign.description}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onClose={resetAndClose} headline="New Campaign">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 320 }}>
          <TextField label="Name" value={name} onChange={setName} required />
          <TextField label="Description" value={description} onChange={setDescription} multiline />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="text" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || createCampaign.isPending}
              onClick={() =>
                createCampaign.mutate(
                  { name, description },
                  {
                    onSuccess: (campaign) => {
                      resetAndClose();
                      navigate(`/campaigns/${campaign.id}`);
                    },
                  },
                )
              }
            >
              Create
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
