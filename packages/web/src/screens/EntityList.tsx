import { useState } from "react";
import { entityTypeConfig, type EntityType } from "@ttrpg/shared";
import {
  clueHooks,
  entityHooksByType,
  locationHooks,
  monsterHooks,
  mysteryHooks,
  npcHooks,
  pcHooks,
  type MinimalEntityRecord,
} from "../api/entities.js";
import { Button } from "../ui/Button.js";
import { Card } from "../ui/Card.js";
import { Dialog } from "../ui/Dialog.js";
import { EntityForm } from "./EntityForm.js";

// entityType is stable for the lifetime of a mounted EntityList instance (the
// parent remounts via `key={entityType}` on tab change), so switching between
// these fixed hook calls never changes order within one instance's renders.
function useCreateForType(entityType: EntityType, campaignId: string) {
  switch (entityType) {
    case "pcs":
      return pcHooks.useCreate(campaignId);
    case "npcs":
      return npcHooks.useCreate(campaignId);
    case "monsters":
      return monsterHooks.useCreate(campaignId);
    case "locations":
      return locationHooks.useCreate(campaignId);
    case "mysteries":
      return mysteryHooks.useCreate(campaignId);
    case "clues":
      return clueHooks.useCreate(campaignId);
  }
}

function useUpdateForType(entityType: EntityType, campaignId: string) {
  switch (entityType) {
    case "pcs":
      return pcHooks.useUpdate(campaignId);
    case "npcs":
      return npcHooks.useUpdate(campaignId);
    case "monsters":
      return monsterHooks.useUpdate(campaignId);
    case "locations":
      return locationHooks.useUpdate(campaignId);
    case "mysteries":
      return mysteryHooks.useUpdate(campaignId);
    case "clues":
      return clueHooks.useUpdate(campaignId);
  }
}

interface EntityListProps {
  campaignId: string;
  entityType: EntityType;
}

export function EntityList({ campaignId, entityType }: EntityListProps) {
  const config = entityTypeConfig[entityType];
  const { useList, useDelete } = entityHooksByType[entityType];
  const { data: records, isLoading } = useList(campaignId);
  const deleteEntity = useDelete(campaignId);
  const createEntity = useCreateForType(entityType, campaignId);
  const updateEntity = useUpdateForType(entityType, campaignId);

  const [editing, setEditing] = useState<MinimalEntityRecord | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MinimalEntityRecord | null>(null);

  if (isLoading) {
    return <p>Loading {config.pluralLabel.toLowerCase()}…</p>;
  }

  const imageField = config.imageField;
  const titleField = config.titleField;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{config.pluralLabel}</h2>
        <Button onClick={() => setEditing("new")}>Add {config.label}</Button>
      </div>

      {records && records.length === 0 ? (
        <p>No {config.pluralLabel.toLowerCase()} yet.</p>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {records?.map((record) => {
          const imageUrl = imageField ? (record[imageField] as string | null) : null;
          const title = (record[titleField] as string) || "Untitled";
          return (
            <Card key={record.id} onClick={() => setEditing(record)}>
              <div style={{ padding: 16 }}>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt=""
                    style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8, marginBottom: 8 }}
                  />
                ) : null}
                <div style={{ fontSize: 16, fontWeight: 500 }}>{title}</div>
                <Button
                  variant="text"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPendingDelete(record);
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        headline={editing === "new" ? `New ${config.label}` : `Edit ${config.label}`}
      >
        <EntityForm
          entityType={entityType}
          initialValues={editing && editing !== "new" ? editing : undefined}
          submitting={createEntity.isPending || updateEntity.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={(data) => {
            // The create/update hooks are picked per entityType via a switch (see
            // useCreateForType/useUpdateForType above), so their input type is a
            // union across all entity shapes here; `data` is validated at runtime
            // by the matching zod schema in EntityForm, so this cast is safe.
            if (editing === "new") {
              createEntity.mutate(data as never, { onSuccess: () => setEditing(null) });
            } else if (editing) {
              updateEntity.mutate({ id: editing.id, data: data as never }, {
                onSuccess: () => setEditing(null),
              });
            }
          }}
        />
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        headline={`Delete ${pendingDelete ? (pendingDelete[titleField] as string) : ""}?`}
        actions={
          <>
            <Button variant="text" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingDelete) {
                  deleteEntity.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
                }
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p>This can't be undone.</p>
      </Dialog>
    </div>
  );
}
