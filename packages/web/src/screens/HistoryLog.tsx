import { useNavigate, useParams } from "react-router-dom";
import type { SessionEvent } from "@ttrpg/shared";
import { useSession, useSessionEvents } from "../api/sessions.js";
import { Button } from "../ui/Button.js";
import { TopAppBar } from "../ui/TopAppBar.js";

const EVENT_LABELS: Record<string, string> = {
  SESSION_STARTED: "Session started",
  SESSION_ENDED: "Session ended",
  LOCATION_CHANGED: "Location changed",
  GM_NOTE: "GM note",
  BATTLE_STARTED: "Battle started",
  BATTLE_ENDED: "Battle ended",
  TURN_ADVANCED: "Turn advanced",
  DAMAGE_APPLIED: "Damage applied",
  HEALING_APPLIED: "Healing applied",
  STATUS_APPLIED: "Status applied",
  STATUS_EXPIRED: "Status expired",
  KO: "Knocked out",
};

function describeEvent(event: SessionEvent): string {
  const payload = event.payload;
  const name = typeof payload.targetName === "string" ? payload.targetName : undefined;
  // DAMAGE_APPLIED/HEALING_APPLIED are still logged for combatants with no HP
  // tracked (e.g. an ad-hoc entry added without a max HP), since the action
  // was still taken — but `applied` says whether HP actually moved, so the
  // wording doesn't claim a change that didn't happen.
  const applied = payload.applied !== false;

  switch (event.type) {
    case "GM_NOTE":
      return typeof payload.note === "string" ? payload.note : "";
    case "LOCATION_CHANGED":
      return typeof payload.locationName === "string" ? `Moved to ${payload.locationName}` : "";
    case "BATTLE_STARTED":
      return typeof payload.combatantCount === "number"
        ? `${payload.combatantCount} combatant(s) entered the fray`
        : "";
    case "TURN_ADVANCED":
      return name ? `${name}'s turn` : "";
    case "DAMAGE_APPLIED":
      return applied
        ? `${name ?? "Someone"} took ${payload.amount ?? "?"} damage`
        : `Attempted ${payload.amount ?? "?"} damage on ${name ?? "someone"} (no HP tracked)`;
    case "HEALING_APPLIED":
      return applied
        ? `${name ?? "Someone"} healed ${payload.amount ?? "?"}`
        : `Attempted to heal ${name ?? "someone"} for ${payload.amount ?? "?"} (no HP tracked)`;
    case "STATUS_APPLIED":
      return `${name ?? "Someone"} gained status: ${payload.label ?? "?"}`;
    case "STATUS_EXPIRED":
      return `${name ?? "Someone"}'s status expired: ${payload.label ?? "?"}`;
    case "KO":
      return `${name ?? "Someone"} was knocked out`;
    default:
      return "";
  }
}

export function HistoryLog() {
  const { campaignId, sessionId } = useParams<{ campaignId: string; sessionId: string }>();
  const navigate = useNavigate();
  const { data: session } = useSession(campaignId, sessionId);
  const { data: events, isLoading } = useSessionEvents(campaignId, sessionId);

  return (
    <div>
      <TopAppBar
        title={session ? `${session.title || "Session"} — History` : "History"}
        leading={
          <Button variant="text" onClick={() => navigate(`/campaigns/${campaignId}`)}>
            ← Campaign
          </Button>
        }
      />
      <div style={{ padding: 24, maxWidth: 720 }}>
        {isLoading ? <p>Loading…</p> : null}
        {events && events.length === 0 ? <p>No events logged yet.</p> : null}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {events?.map((event) => (
            <li
              key={event.id}
              style={{
                padding: 12,
                borderRadius: 8,
                background: "var(--md-sys-color-surface-variant)",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>
                {EVENT_LABELS[event.type] ?? event.type} ·{" "}
                {new Date(event.createdAt).toLocaleTimeString()}
              </div>
              <div>{describeEvent(event)}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
