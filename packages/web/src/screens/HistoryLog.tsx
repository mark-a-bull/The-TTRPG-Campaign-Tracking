import { useCallback, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SessionEvent } from "@ttrpg/shared";
import { useSession, useInfiniteSessionEvents } from "../api/sessions.js";
import { Button } from "../ui/Button.js";
import { TopAppBar } from "../ui/TopAppBar.js";
import { SessionSummaryDialog } from "./SessionSummaryDialog.js";

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
  CLUE_REVEALED: "Clue revealed",
  CLUE_HIDDEN: "Clue hidden",
  XP_AWARDED: "XP awarded",
  END_OF_SESSION_XP_AWARDED: "End-of-session XP awarded",
  END_OF_SESSION_LEVEL_AWARDED: "End-of-session level awarded",
};

function describeEvent(event: SessionEvent): string {
  const payload = event.payload;
  const name = typeof payload.targetName === "string" ? payload.targetName : undefined;
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
    case "CLUE_REVEALED":
      return typeof payload.clueTitle === "string" ? `Revealed: ${payload.clueTitle}` : "";
    case "CLUE_HIDDEN":
      return typeof payload.clueTitle === "string" ? `Hid: ${payload.clueTitle}` : "";
    case "XP_AWARDED": {
      if (typeof payload.pcName !== "string") return "";
      const parts: string[] = [];
      if (typeof payload.amount === "number" && payload.amount !== 0) {
        parts.push(`gained ${payload.amount} XP (total: ${payload.newXp})`);
      }
      if (typeof payload.newLevel === "number") {
        parts.push(`reached Level ${payload.newLevel}`);
      }
      return parts.length > 0 ? `${payload.pcName} ${parts.join(" and ")}` : payload.pcName;
    }
    case "END_OF_SESSION_XP_AWARDED":
      return typeof payload.pcName === "string"
        ? `${payload.pcName} gained ${payload.amount} XP (total: ${payload.newXp})`
        : "";
    case "END_OF_SESSION_LEVEL_AWARDED":
      return typeof payload.pcName === "string" ? `${payload.pcName} reached Level ${payload.newLevel}` : "";
    default:
      return "";
  }
}

export function HistoryLog() {
  const { campaignId, sessionId } = useParams<{ campaignId: string; sessionId: string }>();
  const navigate = useNavigate();
  const { data: session } = useSession(campaignId, sessionId);
  const [order, setOrder] = useState<"asc" | "desc">(() => {
    return (localStorage.getItem("ttrpg-history-sort") as "asc" | "desc") || "desc";
  });
  const [showSummary, setShowSummary] = useState(false);

  // Persist sort preference
  const handleSortChange = (newOrder: "asc" | "desc") => {
    setOrder(newOrder);
    localStorage.setItem("ttrpg-history-sort", newOrder);
  };

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteSessionEvents(campaignId, sessionId, order);

  const events = data?.pages.flatMap((page) => page.events) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  // Intersection Observer for infinite scroll
  const observer = useRef<IntersectionObserver | null>(null);
  const lastEventRef = useCallback(
    (node: HTMLLIElement | null) => {
      if (isFetchingNextPage) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });

      if (node) observer.current.observe(node);
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage],
  );

  return (
    <div>
      <TopAppBar
        title={session ? `${session.title || "Session"} — History` : "History"}
        leading={
          <Button variant="text" onClick={() => navigate(`/campaigns/${campaignId}`)}>
            ← Campaign
          </Button>
        }
        trailing={
          <>
            <Button variant="text" onClick={() => setShowSummary(true)}>
              Summary
            </Button>
            <Button
              variant="text"
              onClick={() => handleSortChange(order === "asc" ? "desc" : "asc")}
            >
              {order === "asc" ? "↓ Oldest first" : "↑ Newest first"}
            </Button>
          </>
        }
      />
      <div style={{ padding: 24, maxWidth: 720 }}>
        {isLoading ? <p>Loading…</p> : null}
        {events.length === 0 && !isLoading ? <p>No events logged yet.</p> : null}

        {total > 0 && (
          <div style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", marginBottom: 12 }}>
            Showing {events.length} of {total} events
          </div>
        )}

        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {events.map((event, index) => {
            const isLast = index === events.length - 1;
            return (
              <li
                key={event.id}
                ref={isLast ? lastEventRef : undefined}
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
            );
          })}
        </ul>

        {isFetchingNextPage && (
          <p style={{ textAlign: "center", color: "var(--md-sys-color-on-surface-variant)" }}>
            Loading more…
          </p>
        )}

        {!hasNextPage && events.length > 0 && (
          <p style={{ textAlign: "center", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", marginTop: 16 }}>
            End of history
          </p>
        )}
      </div>

      <SessionSummaryDialog
        campaignId={campaignId ?? ""}
        sessionId={showSummary ? sessionId ?? null : null}
        onClose={() => setShowSummary(false)}
      />
    </div>
  );
}
