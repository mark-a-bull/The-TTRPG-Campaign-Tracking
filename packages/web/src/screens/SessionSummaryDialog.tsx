import { useSessionSummary } from "../api/sessions.js";
import { Button } from "../ui/Button.js";
import { Dialog } from "../ui/Dialog.js";
import { SessionAwardsSection } from "./SessionAwardsSection.js";

interface SessionSummaryDialogProps {
  campaignId: string;
  sessionId: string | null;
  onClose: () => void;
}

function Section({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>{label}</div>
      <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
        {items.map((item, index) => (
          <li key={index} style={{ fontSize: 14 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SessionSummaryDialog({ campaignId, sessionId, onClose }: SessionSummaryDialogProps) {
  const { data: summary, isLoading } = useSessionSummary(campaignId, sessionId ?? undefined);

  return (
    <Dialog
      open={sessionId !== null}
      onClose={onClose}
      headline={summary ? `${summary.title || "Session"} — Summary` : "Session Summary"}
      actions={
        <Button variant="text" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 320, maxWidth: 480 }}>
        {isLoading || !summary ? (
          <p>Loading…</p>
        ) : (
          <>
            {summary.eventCount === 0 ? (
              <p>Nothing happened this session.</p>
            ) : (
              <>
                <Section label="Locations Visited" items={summary.locationsVisited} />
                <Section label="GM Notes" items={summary.gmNotes} />
                <Section label="Clues Revealed" items={summary.cluesRevealed} />
                <Section label="Clues Hidden" items={summary.cluesHidden} />
                {summary.battlesFought > 0 ? (
                  <div>
                    <div style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>Battles</div>
                    <p style={{ fontSize: 14, margin: "4px 0 0" }}>
                      {summary.battlesFought} battle(s) fought — {summary.totalDamage} damage dealt,{" "}
                      {summary.totalHealing} healing done
                    </p>
                  </div>
                ) : null}
                <Section label="Knocked Out" items={summary.knockouts} />
                {summary.xpAwards.length > 0 ? (
                  <div>
                    <div style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>XP Awarded</div>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                      {summary.xpAwards.map((award, index) => (
                        <li key={index} style={{ fontSize: 14 }}>
                          {award.pcName}: {award.amount} XP
                        </li>
                      ))}
                    </ul>
                    <p style={{ fontSize: 13, margin: "4px 0 0" }}>Total: {summary.totalXpAwarded} XP</p>
                  </div>
                ) : null}
                <Section
                  label="Level Changes"
                  items={summary.levelChanges.map((change) => `${change.pcName}: Level ${change.newLevel}`)}
                />
              </>
            )}
            {sessionId ? <SessionAwardsSection campaignId={campaignId} sessionId={sessionId} /> : null}
          </>
        )}
      </div>
    </Dialog>
  );
}
