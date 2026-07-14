import { useEffect, useState } from "react";
import { pcHooks } from "../api/entities.js";
import { useAwardXp } from "../api/pcs.js";
import { Button } from "../ui/Button.js";
import { TextField } from "../ui/TextField.js";

interface SessionAwardsSectionProps {
  campaignId: string;
  sessionId: string;
}

interface Draft {
  amount: string;
  level: string;
}

export function SessionAwardsSection({ campaignId, sessionId }: SessionAwardsSectionProps) {
  const { data: pcs } = pcHooks.useList(campaignId);
  const awardXp = useAwardXp(campaignId, sessionId);

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  // Reopening the summary for a different session should start from a clean
  // slate rather than showing edits made against a previous session.
  useEffect(() => {
    setDrafts({});
  }, [sessionId]);

  if (!pcs || pcs.length === 0) return null;

  function draftFor(pcId: string, currentLevel: number): Draft {
    return drafts[pcId] ?? { amount: "0", level: String(currentLevel) };
  }

  function updateDraft(pcId: string, patch: Partial<Draft>) {
    const currentLevel = pcs?.find((pc) => pc.id === pcId)?.level ?? 1;
    setDrafts((current) => ({ ...current, [pcId]: { ...draftFor(pcId, currentLevel), ...patch } }));
  }

  const changedPcs = pcs.filter((pc) => {
    const draft = draftFor(pc.id, pc.level);
    return Number(draft.amount) !== 0 || Number(draft.level) !== pc.level;
  });

  async function confirmAwards() {
    await Promise.all(
      changedPcs.map((pc) => {
        const draft = draftFor(pc.id, pc.level);
        const level = Number(draft.level);
        return awardXp.mutateAsync({
          id: pc.id,
          data: {
            amount: Number(draft.amount) || 0,
            level: level !== pc.level ? level : undefined,
          },
        });
      }),
    );
    setDrafts({});
  }

  return (
    <div>
      <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "var(--md-sys-color-on-surface-variant)" }}>
        Award XP & Levels
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {pcs.map((pc) => {
          const draft = draftFor(pc.id, pc.level);
          return (
            <div key={pc.id} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1, fontSize: 14 }}>
                {pc.name}
                <div style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>
                  {pc.xp} XP, Level {pc.level}
                </div>
              </div>
              <div style={{ width: 100 }}>
                <TextField
                  label="XP to award"
                  type="number"
                  value={draft.amount}
                  onChange={(value) => updateDraft(pc.id, { amount: value })}
                />
              </div>
              <div style={{ width: 80 }}>
                <TextField
                  label="Level"
                  type="number"
                  value={draft.level}
                  onChange={(value) => updateDraft(pc.id, { level: value })}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12 }}>
        <Button variant="outlined" onClick={confirmAwards} disabled={changedPcs.length === 0 || awardXp.isPending}>
          Confirm Awards
        </Button>
      </div>
    </div>
  );
}
