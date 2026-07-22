import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Player } from "@ttrpg/shared";
import { useCreatePlayer, useDeletePlayer, usePlayers, useUpdatePlayer } from "../api/players.js";
import { Button } from "../ui/Button.js";
import { Card } from "../ui/Card.js";
import { Dialog } from "../ui/Dialog.js";
import { ErrorBanner, errorMessage } from "../ui/ErrorBanner.js";
import { IconButton } from "../ui/IconButton.js";
import { TextField } from "../ui/TextField.js";
import { TopAppBar } from "../ui/TopAppBar.js";

export function PlayersScreen() {
  const { data: players, isLoading } = usePlayers();
  const createPlayer = useCreatePlayer();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const updatePlayer = useUpdatePlayer(editingPlayer?.id ?? "");

  const [pendingDelete, setPendingDelete] = useState<Player | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletePlayer = useDeletePlayer();

  function resetAndClose() {
    setDialogOpen(false);
    setName("");
    setPhone("");
    setEmail("");
  }

  function openEdit(player: Player) {
    setEditingPlayer(player);
    setEditName(player.name);
    setEditPhone(player.phone);
    setEditEmail(player.email);
  }

  function closeEdit() {
    setEditingPlayer(null);
  }

  return (
    <div>
      <TopAppBar
        title="Players"
        leading={
          <Button variant="text" onClick={() => navigate("/")}>
            ← Campaigns
          </Button>
        }
      />
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Players</h1>
          <Button onClick={() => setDialogOpen(true)}>New Player</Button>
        </div>

        {isLoading ? <p>Loading…</p> : null}
        {players && players.length === 0 ? <p>No players yet. Add your first one.</p> : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {players?.map((player) => (
            <Card key={player.id}>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 500, flex: 1 }}>{player.name}</div>
                  <IconButton icon="edit" label={`Edit ${player.name}`} onClick={() => openEdit(player)} />
                  <IconButton
                    icon="delete"
                    label={`Delete ${player.name}`}
                    onClick={() => {
                      setDeleteError(null);
                      setPendingDelete(player);
                    }}
                  />
                </div>
                {player.phone ? (
                  <div style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>{player.phone}</div>
                ) : null}
                {player.email ? (
                  <div style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>{player.email}</div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onClose={resetAndClose} headline="New Player">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 320 }}>
          <TextField label="Name" value={name} onChange={setName} required />
          <TextField label="Phone" value={phone} onChange={setPhone} />
          <TextField label="Email" value={email} onChange={setEmail} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="text" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || createPlayer.isPending}
              onClick={() => createPlayer.mutate({ name, phone, email }, { onSuccess: resetAndClose })}
            >
              Create
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={editingPlayer !== null} onClose={closeEdit} headline="Edit Player">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 320 }}>
          <TextField label="Name" value={editName} onChange={setEditName} required />
          <TextField label="Phone" value={editPhone} onChange={setEditPhone} />
          <TextField label="Email" value={editEmail} onChange={setEditEmail} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="text" onClick={closeEdit}>
              Cancel
            </Button>
            <Button
              disabled={!editName.trim() || updatePlayer.isPending}
              onClick={() =>
                updatePlayer.mutate(
                  { name: editName, phone: editPhone, email: editEmail },
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
              disabled={deletePlayer.isPending}
              onClick={() => {
                if (pendingDelete) {
                  deletePlayer.mutate(pendingDelete.id, {
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
        <p>This can&apos;t be undone. Any PCs linked to this player will keep their record but show no player.</p>
      </Dialog>
    </div>
  );
}
