import { useState } from "react";
import type { PC } from "@ttrpg/shared";
import { useAwardXp } from "../api/pcs.js";
import { useActiveSession } from "../api/clues.js";
import { pcHooks } from "../api/entities.js";
import { Button } from "../ui/Button.js";
import { Dialog } from "../ui/Dialog.js";
import { TextField } from "../ui/TextField.js";

interface XpAwardSectionProps {
  campaignId: string;
  /** A snapshot taken when the edit dialog opened; not reactive to server updates. */
  pc: PC;
  readOnly?: boolean;
}

export function XpAwardSection({ campaignId, pc: initialPc, readOnly }: XpAwardSectionProps) {
  // The parent dialog holds a static snapshot of the PC, so re-read it live
  // here — otherwise the XP total shown in this section never updates after
  // a successful award, even though the server has changed.
  const { data: pcs } = pcHooks.useList(campaignId);
  const pc = pcs?.find((p) => p.id === initialPc.id) ?? initialPc;
  const activeSession = useActiveSession(campaignId);
  const awardXp = useAwardXp(campaignId);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  function openDialog() {
    setAmount("");
    setNote("");
    setOpen(true);
  }

  function confirmAward() {
    const parsed = Number(amount);
    if (!amount || Number.isNaN(parsed)) return;
    awardXp.mutate(
      { id: pc.id, data: { amount: parsed, note: note.trim() || undefined } },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <div>
      <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "var(--md-sys-color-on-surface-variant)" }}>
        Experience
      </h3>
      <p style={{ fontSize: 13, margin: "0 0 8px" }}>{pc.xp} XP</p>

      {readOnly ? null : (
        <>
          <Button variant="text" onClick={openDialog} disabled={awardXp.isPending}>
            Award XP
          </Button>
          <p style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", margin: "4px 0 0" }}>
            {activeSession
              ? "Will be logged to this session's history."
              : "No active session — XP will update without a history log entry."}
          </p>
        </>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} headline="Award XP">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 280 }}>
          <TextField label="Amount (negative to correct)" type="number" value={amount} onChange={setAmount} />
          <TextField label="Note (optional)" value={note} onChange={setNote} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="text" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAward} disabled={awardXp.isPending || !amount}>
              Confirm
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
