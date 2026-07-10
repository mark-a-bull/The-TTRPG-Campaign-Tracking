import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Campaign } from "@ttrpg/shared";
import { useCampaigns, useCreateCampaign, useDeleteCampaign, useUpdateCampaign } from "../api/campaigns.js";
import { Button } from "../ui/Button.js";
import { Card } from "../ui/Card.js";
import { Dialog } from "../ui/Dialog.js";
import { ErrorBanner, errorMessage } from "../ui/ErrorBanner.js";
import { IconButton } from "../ui/IconButton.js";
import { TextField } from "../ui/TextField.js";
import { TopAppBar } from "../ui/TopAppBar.js";

export function CampaignDashboard() {
  const { data: campaigns, isLoading } = useCampaigns();
  const createCampaign = useCreateCampaign();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const updateCampaign = useUpdateCampaign(editingCampaign?.id ?? "");

  const [pendingDelete, setPendingDelete] = useState<Campaign | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteCampaign = useDeleteCampaign();

  function resetAndClose() {
    setDialogOpen(false);
    setName("");
    setDescription("");
  }

  function openEdit(campaign: Campaign) {
    setEditingCampaign(campaign);
    setEditName(campaign.name);
    setEditDescription(campaign.description);
  }

  function closeEdit() {
    setEditingCampaign(null);
  }

  return (
    <div>
      <TopAppBar
        title="Campaigns"
        trailing={
          <IconButton icon="settings" label="Settings" onClick={() => navigate("/settings")} />
        }
      />
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 500, flex: 1 }}>{campaign.name}</div>
                  <IconButton
                    icon="edit"
                    label={`Edit ${campaign.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      openEdit(campaign);
                    }}
                  />
                  <IconButton
                    icon="delete"
                    label={`Delete ${campaign.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteError(null);
                      setPendingDelete(campaign);
                    }}
                  />
                </div>
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

      <Dialog open={editingCampaign !== null} onClose={closeEdit} headline="Edit Campaign">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 320 }}>
          <TextField label="Name" value={editName} onChange={setEditName} required />
          <TextField label="Description" value={editDescription} onChange={setEditDescription} multiline />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="text" onClick={closeEdit}>
              Cancel
            </Button>
            <Button
              disabled={!editName.trim() || updateCampaign.isPending}
              onClick={() =>
                updateCampaign.mutate(
                  { name: editName, description: editDescription },
                  { onSuccess: closeEdit },
                )
              }
            >
              Save
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onClose={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        headline={`Delete ${pendingDelete?.name ?? ""}?`}
        actions={
          <>
            <Button
              variant="text"
              onClick={() => {
                setPendingDelete(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={deleteCampaign.isPending}
              onClick={() => {
                if (pendingDelete) {
                  deleteCampaign.mutate(pendingDelete.id, {
                    onSuccess: () => {
                      setPendingDelete(null);
                      setDeleteError(null);
                    },
                    onError: (error) => setDeleteError(errorMessage(error)),
                  });
                }
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        {deleteError ? <ErrorBanner message={deleteError} onDismiss={() => setDeleteError(null)} /> : null}
        <p>This can't be undone. All entities, sessions, and history in this campaign will be deleted too.</p>
      </Dialog>
    </div>
  );
}
