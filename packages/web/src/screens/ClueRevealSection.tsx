import { useState } from "react";
import type { Clue } from "@ttrpg/shared";
import { useActiveSession, useHideClue, useRevealClue } from "../api/clues.js";
import { clueHooks, pcHooks } from "../api/entities.js";
import { Button } from "../ui/Button.js";
import { Dialog } from "../ui/Dialog.js";

interface ClueRevealSectionProps {
  campaignId: string;
  /** A snapshot taken when the edit dialog opened; not reactive to server updates. */
  clue: Clue;
  readOnly?: boolean;
}

export function ClueRevealSection({ campaignId, clue: initialClue, readOnly }: ClueRevealSectionProps) {
  const { data: pcs } = pcHooks.useList(campaignId);
  // The parent dialog holds a static snapshot of the clue, so re-read it live
  // here — otherwise the reveal/hide status shown in this section never
  // updates after a successful mutation, even though the server has changed.
  const { data: clues } = clueHooks.useList(campaignId);
  const clue = clues?.find((c) => c.id === initialClue.id) ?? initialClue;
  const activeSession = useActiveSession(campaignId);
  const revealClue = useRevealClue(campaignId);
  const hideClue = useHideClue(campaignId);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const isRevealed = clue.visibility === "revealed";
  const nameFor = (id: string) => pcs?.find((pc) => pc.id === id)?.name ?? "Unknown";

  function openDialog() {
    setSelected([]);
    setOpen(true);
  }

  function confirmReveal() {
    revealClue.mutate({ id: clue.id, data: { visibleTo: selected } }, { onSuccess: () => setOpen(false) });
  }

  function hide() {
    hideClue.mutate({ id: clue.id });
  }

  function toggle(pcId: string) {
    setSelected((current) => (current.includes(pcId) ? current.filter((id) => id !== pcId) : [...current, pcId]));
  }

  return (
    <div>
      <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "var(--md-sys-color-on-surface-variant)" }}>
        Reveal Status
      </h3>
      <p style={{ fontSize: 13, margin: "0 0 8px" }}>
        {isRevealed
          ? clue.visibleTo.length === 0
            ? "Revealed to: Entire party"
            : `Revealed to: ${clue.visibleTo.map(nameFor).join(", ")}`
          : "Hidden"}
      </p>

      {readOnly ? null : (
        <>
          {isRevealed ? (
            <Button variant="text" onClick={hide} disabled={!activeSession || hideClue.isPending}>
              Hide Again
            </Button>
          ) : (
            <Button variant="text" onClick={openDialog} disabled={!activeSession || revealClue.isPending}>
              Reveal to Players
            </Button>
          )}
          {!activeSession ? (
            <p style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", margin: "4px 0 0" }}>
              Start a session to {isRevealed ? "hide" : "reveal"} clues to players.
            </p>
          ) : null}
        </>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} headline="Reveal to Players">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 280 }}>
          <p style={{ fontSize: 13, margin: 0 }}>Leave all unchecked to reveal to the entire party.</p>
          {!pcs || pcs.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>No PCs in this campaign.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {pcs.map((pc) => (
                <li key={pc.id}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input type="checkbox" checked={selected.includes(pc.id)} onChange={() => toggle(pc.id)} />
                    {pc.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="text" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmReveal} disabled={revealClue.isPending}>
              Confirm
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
