import { useState } from "react";
import type { ItemOwnerType } from "@ttrpg/shared";
import {
  useCreateItem,
  useDeleteItem,
  useHideInventory,
  useHideItem,
  useInventoryVisibility,
  useItemsForOwner,
  useRevealInventory,
  useRevealItem,
  useTransferItem,
} from "../api/items.js";
import { useActiveSession } from "../api/clues.js";
import { useEntityNameLookup } from "../entity-lookup.js";
import { Button } from "../ui/Button.js";
import { Dialog } from "../ui/Dialog.js";
import { ErrorBanner, errorMessage } from "../ui/ErrorBanner.js";
import { IconButton } from "../ui/IconButton.js";
import { TextField } from "../ui/TextField.js";

interface InventorySectionProps {
  campaignId: string;
  ownerType: ItemOwnerType;
  ownerId: string;
  readOnly?: boolean;
}

const ownerTypeToEntityType = {
  pc: "pcs",
  npc: "npcs",
  monster: "monsters",
  location: "locations",
} as const;

const emptyItemForm = { name: "", quantity: 1, description: "", notes: "" };

export function InventorySection({ campaignId, ownerType, ownerId, readOnly }: InventorySectionProps) {
  const { data: visibility } = useInventoryVisibility(campaignId, ownerType, ownerId);
  const { data: items } = useItemsForOwner(campaignId, ownerType, ownerId);
  const { refs } = useEntityNameLookup(campaignId);
  const activeSession = useActiveSession(campaignId);

  const revealInventory = useRevealInventory(campaignId);
  const hideInventory = useHideInventory(campaignId);
  const createItem = useCreateItem(campaignId, ownerType, ownerId);
  const deleteItem = useDeleteItem(campaignId, ownerType, ownerId);
  const revealItem = useRevealItem(campaignId, ownerType, ownerId);
  const hideItem = useHideItem(campaignId, ownerType, ownerId);
  const transferItem = useTransferItem(campaignId, ownerType, ownerId);

  const [addOpen, setAddOpen] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [transferTargetType, setTransferTargetType] = useState<ItemOwnerType>("pc");
  const [transferTargetId, setTransferTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const hidden = visibility?.hidden ?? false;
  const transferTargets = refs.filter(
    (ref) =>
      ref.type === ownerTypeToEntityType[transferTargetType] && !(ref.type === ownerTypeToEntityType[ownerType] && ref.id === ownerId),
  );

  function openTransfer(itemId: string) {
    setTransferringId(itemId);
    setTransferTargetType("pc");
    setTransferTargetId("");
  }

  function confirmTransfer() {
    if (!transferringId || !transferTargetId) return;
    transferItem.mutate(
      { id: transferringId, data: { ownerType: transferTargetType, ownerId: transferTargetId } },
      { onSuccess: () => setTransferringId(null), onError: (err) => setError(errorMessage(err)) },
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: "var(--md-sys-color-on-surface-variant)" }}>Inventory</h3>
        {readOnly ? null : (
          <Button
            variant="text"
            onClick={() => (hidden ? revealInventory : hideInventory).mutate({ ownerType, ownerId })}
            disabled={!activeSession || revealInventory.isPending || hideInventory.isPending}
          >
            {hidden ? "Reveal Inventory" : "Hide Inventory"}
          </Button>
        )}
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {hidden ? (
        <p style={{ fontSize: 13, color: "var(--md-sys-color-error)", margin: "0 0 8px" }}>
          Hidden from players.
        </p>
      ) : null}

      {!activeSession && !readOnly ? (
        <p style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", margin: "0 0 8px" }}>
          Start a session to hide/reveal this inventory or items, or transfer items.
        </p>
      ) : null}

      {!items || items.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>No items.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => (
            <li
              key={item.id}
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
                <strong>{item.name}</strong>
                {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                {item.hidden ? (
                  <span style={{ marginLeft: 6, fontSize: 11, color: "var(--md-sys-color-error)" }}>hidden</span>
                ) : null}
              </div>
              {readOnly ? null : (
                <>
                  <Button
                    variant="text"
                    onClick={() => (item.hidden ? revealItem : hideItem).mutate(item.id)}
                    disabled={!activeSession || revealItem.isPending || hideItem.isPending}
                  >
                    {item.hidden ? "Reveal" : "Hide"}
                  </Button>
                  <Button variant="text" onClick={() => openTransfer(item.id)} disabled={!activeSession}>
                    Move to…
                  </Button>
                  <IconButton icon="delete" label={`Delete ${item.name}`} onClick={() => deleteItem.mutate(item.id)} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {readOnly ? null : (
        <Button variant="text" onClick={() => setAddOpen(true)}>
          Add Item
        </Button>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} headline="Add Item">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 280 }}>
          <TextField label="Name" value={itemForm.name} onChange={(v) => setItemForm((f) => ({ ...f, name: v }))} />
          <TextField
            label="Quantity"
            type="number"
            value={String(itemForm.quantity)}
            onChange={(v) => setItemForm((f) => ({ ...f, quantity: Number(v) || 1 }))}
          />
          <TextField
            label="Description"
            value={itemForm.description}
            onChange={(v) => setItemForm((f) => ({ ...f, description: v }))}
            multiline
          />
          <TextField
            label="Notes"
            value={itemForm.notes}
            onChange={(v) => setItemForm((f) => ({ ...f, notes: v }))}
            multiline
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="text" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!itemForm.name.trim() || createItem.isPending}
              onClick={() =>
                createItem.mutate(
                  { ownerType, ownerId, ...itemForm },
                  {
                    onSuccess: () => {
                      setItemForm(emptyItemForm);
                      setAddOpen(false);
                    },
                    onError: (err) => setError(errorMessage(err)),
                  },
                )
              }
            >
              Add
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={transferringId !== null} onClose={() => setTransferringId(null)} headline="Move Item">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 280 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            Owner type
            <select
              value={transferTargetType}
              onChange={(event) => {
                setTransferTargetType(event.target.value as ItemOwnerType);
                setTransferTargetId("");
              }}
            >
              <option value="pc">Player Character</option>
              <option value="npc">NPC</option>
              <option value="monster">Monster</option>
              <option value="location">Location</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            Owner
            <select value={transferTargetId} onChange={(event) => setTransferTargetId(event.target.value)}>
              <option value="" disabled>
                Select…
              </option>
              {transferTargets.map((ref) => (
                <option key={ref.id} value={ref.id}>
                  {ref.label}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="text" onClick={() => setTransferringId(null)}>
              Cancel
            </Button>
            <Button disabled={!transferTargetId || transferItem.isPending} onClick={confirmTransfer}>
              Confirm
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
