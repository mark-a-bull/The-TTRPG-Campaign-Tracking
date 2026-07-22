import { useState, type CSSProperties, type ReactNode } from "react";
import { entityTypeConfig, type EntityType } from "@ttrpg/shared";
import {
  clueHooks,
  entityHooksByType,
  locationHooks,
  monsterHooks,
  mysteryHooks,
  npcHooks,
  organizationHooks,
  pcHooks,
  type MinimalEntityRecord,
} from "../api/entities.js";
import { Button } from "../ui/Button.js";
import { Card } from "../ui/Card.js";
import { Dialog } from "../ui/Dialog.js";
import { ErrorBanner, errorMessage } from "../ui/ErrorBanner.js";
import { IconButton } from "../ui/IconButton.js";
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
    case "organizations":
      return organizationHooks.useCreate(campaignId);
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
    case "organizations":
      return organizationHooks.useUpdate(campaignId);
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
  const [readOnly, setReadOnly] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MinimalEntityRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Locations list renders as a nested tree instead of a flat grid; tracks
  // which location ids are collapsed (empty by default, so everything
  // starts expanded, same as the flat list already shows everything today).
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  if (isLoading) {
    return <p>Loading {config.pluralLabel.toLowerCase()}…</p>;
  }

  const imageField = config.imageField;
  const titleField = config.titleField;

  function openView(record: MinimalEntityRecord) {
    setEditing(record);
    setReadOnly(true);
  }

  function openEdit(record: MinimalEntityRecord) {
    setEditing(record);
    setReadOnly(false);
  }

  function renderCard(record: MinimalEntityRecord, extraStyle?: CSSProperties) {
    const imageUrl = imageField ? (record[imageField] as string | null) : null;
    const title = (record[titleField] as string) || "Untitled";
    return (
      <Card key={record.id} onClick={() => openView(record)} style={extraStyle}>
        <div style={{ padding: 16 }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8, marginBottom: 8 }}
            />
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 500, flex: 1 }}>{title}</div>
            <IconButton
              icon="edit"
              label={`Edit ${title}`}
              onClick={(event) => {
                event.stopPropagation();
                openEdit(record);
              }}
            />
            <IconButton
              icon="delete"
              label={`Delete ${title}`}
              onClick={(event) => {
                event.stopPropagation();
                setDeleteError(null);
                setPendingDelete(record);
              }}
            />
          </div>
        </div>
      </Card>
    );
  }

  function renderFlatGrid() {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {records?.map((record) => renderCard(record))}
      </div>
    );
  }

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function renderLocationTree() {
    const all = records ?? [];
    const childrenByParent = new Map<string | null, MinimalEntityRecord[]>();
    for (const record of all) {
      const parentId = (record.parentLocationId as string | null) ?? null;
      // Defensive: onDelete: SetNull guarantees no dangling parent
      // reference, but if a parentLocationId somehow doesn't match any
      // known id in this list, treat the location as top-level rather than
      // dropping it from the view entirely.
      const key = parentId && all.some((r) => r.id === parentId) ? parentId : null;
      const siblings = childrenByParent.get(key) ?? [];
      siblings.push(record);
      childrenByParent.set(key, siblings);
    }

    function renderLevel(parentId: string | null, depth: number): ReactNode[] {
      const children = childrenByParent.get(parentId) ?? [];
      return children.flatMap((record) => {
        const hasChildren = (childrenByParent.get(record.id) ?? []).length > 0;
        const isCollapsed = collapsedIds.has(record.id);
        const row = (
          <div key={record.id} style={{ display: "flex", alignItems: "flex-start", gap: 4, marginLeft: depth * 32 }}>
            {hasChildren ? (
              <IconButton
                icon={isCollapsed ? "chevron_right" : "expand_more"}
                label={isCollapsed ? "Expand" : "Collapse"}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleCollapsed(record.id);
                }}
              />
            ) : (
              <div style={{ width: 40 }} />
            )}
            {renderCard(record, { flex: 1, maxWidth: 400 })}
          </div>
        );
        const nested = hasChildren && !isCollapsed ? renderLevel(record.id, depth + 1) : [];
        return [row, ...nested];
      });
    }

    return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{renderLevel(null, 0)}</div>;
  }

  function openCreate() {
    setEditing("new");
    setReadOnly(false);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{config.pluralLabel}</h2>
        <Button onClick={openCreate}>Add {config.label}</Button>
      </div>

      {records && records.length === 0 ? (
        <p>No {config.pluralLabel.toLowerCase()} yet.</p>
      ) : null}

      {entityType === "locations" ? renderLocationTree() : renderFlatGrid()}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        headline={
          editing === "new" ? `New ${config.label}` : readOnly ? `View ${config.label}` : `Edit ${config.label}`
        }
      >
        <EntityForm
          // Dialog keeps EntityForm mounted and just toggles visibility, but
          // react-hook-form only reads `defaultValues` once at mount — so a
          // fresh key per edit target forces a remount to re-hydrate the form
          // with the newly selected record's values instead of showing stale
          // (often empty) state from whenever it first mounted.
          key={editing === "new" ? "new" : (editing ? editing.id : "closed")}
          entityType={entityType}
          campaignId={campaignId}
          initialValues={editing && editing !== "new" ? editing : undefined}
          submitting={createEntity.isPending || updateEntity.isPending}
          readOnly={editing !== "new" && readOnly}
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
        onClose={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        headline={`Delete ${pendingDelete ? (pendingDelete[titleField] as string) : ""}?`}
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
              disabled={deleteEntity.isPending}
              onClick={() => {
                if (pendingDelete) {
                  deleteEntity.mutate(pendingDelete.id, {
                    onSuccess: () => {
                      setPendingDelete(null);
                      setDeleteError(null);
                      // If the deleted record's edit/view dialog is still
                      // open, close it too — otherwise Save would PATCH an
                      // id that no longer exists.
                      setEditing((current) =>
                        current && current !== "new" && current.id === pendingDelete.id ? null : current,
                      );
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
        <p>This can&apos;t be undone.</p>
      </Dialog>
    </div>
  );
}
