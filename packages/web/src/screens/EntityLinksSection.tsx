import { useState } from "react";
import { entityTypeConfig, entityTypes, type EntityLink, type EntityType } from "@ttrpg/shared";
import { useCreateLink, useDeleteLink, useEntityLinks, useUpdateLink } from "../api/entity-links.js";
import { useEntityNameLookup } from "../entity-lookup.js";
import { Button } from "../ui/Button.js";
import { Dialog } from "../ui/Dialog.js";
import { IconButton } from "../ui/IconButton.js";
import { TextField } from "../ui/TextField.js";

interface EntityLinksSectionProps {
  campaignId: string;
  entityType: EntityType;
  entityId: string;
  readOnly?: boolean;
}

interface LinkFormState {
  targetType: EntityType;
  targetId: string;
  label: string;
  directional: boolean;
  reverseLabel: string;
  visibility: "hidden" | "revealed";
  notes: string;
}

const emptyForm: LinkFormState = {
  targetType: "pcs",
  targetId: "",
  label: "",
  directional: false,
  reverseLabel: "",
  visibility: "revealed",
  notes: "",
};

export function EntityLinksSection({ campaignId, entityType, entityId, readOnly }: EntityLinksSectionProps) {
  const { data: links } = useEntityLinks(campaignId, entityType, entityId);
  const { refs, nameFor } = useEntityNameLookup(campaignId);
  const createLink = useCreateLink(campaignId);
  const updateLink = useUpdateLink(campaignId);
  const deleteLink = useDeleteLink(campaignId);

  const [open, setOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<EntityLink | null>(null);
  const [form, setForm] = useState<LinkFormState>(emptyForm);

  function openAdd() {
    setEditingLink(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(link: EntityLink) {
    const isFrom = link.fromType === entityType && link.fromId === entityId;
    setEditingLink(link);
    setForm({
      targetType: isFrom ? link.toType : link.fromType,
      targetId: isFrom ? link.toId : link.fromId,
      label: link.label,
      directional: link.directional,
      reverseLabel: link.reverseLabel ?? "",
      visibility: link.visibility,
      notes: link.notes,
    });
    setOpen(true);
  }

  function save() {
    const shared = {
      label: form.label,
      reverseLabel: form.directional ? form.reverseLabel || null : null,
      directional: form.directional,
      visibility: form.visibility,
      notes: form.notes,
    };
    if (editingLink) {
      updateLink.mutate({ id: editingLink.id, data: shared }, { onSuccess: () => setOpen(false) });
    } else {
      createLink.mutate(
        { fromType: entityType, fromId: entityId, toType: form.targetType, toId: form.targetId, ...shared },
        { onSuccess: () => setOpen(false) },
      );
    }
  }

  const availableTargets = refs.filter(
    (ref) => ref.type === form.targetType && !(ref.type === entityType && ref.id === entityId),
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: "var(--md-sys-color-on-surface-variant)" }}>
          Relationships &amp; Connections
        </h3>
        {readOnly ? null : (
          <Button variant="text" onClick={openAdd}>
            Add Link
          </Button>
        )}
      </div>

      {!links || links.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>No links yet.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {links.map((link) => {
            const isFrom = link.fromType === entityType && link.fromId === entityId;
            const otherType = isFrom ? link.toType : link.fromType;
            const otherId = isFrom ? link.toId : link.fromId;
            const displayLabel = isFrom ? link.label : link.reverseLabel || link.label;
            return (
              <li
                key={link.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: 8,
                  borderRadius: 8,
                  background: "var(--md-sys-color-surface-variant)",
                  fontSize: 13,
                }}
              >
                <div style={{ flex: 1 }}>
                  <strong>{displayLabel}</strong> — {nameFor(otherType, otherId)}{" "}
                  <span style={{ color: "var(--md-sys-color-on-surface-variant)" }}>
                    ({entityTypeConfig[otherType].label})
                  </span>
                  {link.visibility === "hidden" ? (
                    <span style={{ marginLeft: 6, fontSize: 11, color: "var(--md-sys-color-error)" }}>hidden</span>
                  ) : null}
                </div>
                {readOnly ? null : (
                  <>
                    <IconButton icon="edit" label={`Edit link: ${displayLabel}`} onClick={() => openEdit(link)} />
                    <IconButton
                      icon="delete"
                      label={`Delete link: ${displayLabel}`}
                      onClick={() => deleteLink.mutate(link.id)}
                    />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} headline={editingLink ? "Edit Link" : "Add Link"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 280 }}>
          {editingLink ? (
            <div style={{ fontSize: 13 }}>
              Linked to <strong>{nameFor(form.targetType, form.targetId)}</strong>
            </div>
          ) : (
            <>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Entity type
                <select
                  value={form.targetType}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, targetType: event.target.value as EntityType, targetId: "" }))
                  }
                >
                  {entityTypes.map((type) => (
                    <option key={type} value={type}>
                      {entityTypeConfig[type].pluralLabel}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Entity
                <select value={form.targetId} onChange={(event) => setForm((f) => ({ ...f, targetId: event.target.value }))}>
                  <option value="" disabled>
                    Select…
                  </option>
                  {availableTargets.map((ref) => (
                    <option key={ref.id} value={ref.id}>
                      {ref.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <TextField
            label="Label"
            value={form.label}
            onChange={(value) => setForm((f) => ({ ...f, label: value }))}
          />

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={form.directional}
              onChange={(event) => setForm((f) => ({ ...f, directional: event.target.checked }))}
            />
            Directional (different label in each direction)
          </label>

          {form.directional ? (
            <TextField
              label="Reverse label"
              value={form.reverseLabel}
              onChange={(value) => setForm((f) => ({ ...f, reverseLabel: value }))}
            />
          ) : null}

          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            Visibility
            <select
              value={form.visibility}
              onChange={(event) =>
                setForm((f) => ({ ...f, visibility: event.target.value as "hidden" | "revealed" }))
              }
            >
              <option value="revealed">Revealed</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>

          <TextField
            label="Notes"
            value={form.notes}
            onChange={(value) => setForm((f) => ({ ...f, notes: value }))}
            multiline
          />

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="text" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.label.trim() || (!editingLink && !form.targetId) || createLink.isPending || updateLink.isPending}
              onClick={save}
            >
              Save
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
