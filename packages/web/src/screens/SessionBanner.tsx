import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { locationHooks } from "../api/entities.js";
import { useBattles, useCreateBattle } from "../api/battles.js";
import { useAddGmNote, useEndSession, useSessions, useSetSessionLocation, useStartSession } from "../api/sessions.js";
import { Button } from "../ui/Button.js";
import { ErrorBanner, errorMessage } from "../ui/ErrorBanner.js";
import { TextField } from "../ui/TextField.js";

interface SessionBannerProps {
  campaignId: string;
}

export function SessionBanner({ campaignId }: SessionBannerProps) {
  const navigate = useNavigate();
  const { data: sessions } = useSessions(campaignId);
  const activeSession = sessions?.find((session) => session.status === "active");
  const activeSessionId = activeSession?.id ?? "";

  const [newTitle, setNewTitle] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const startSession = useStartSession(campaignId);
  const endSession = useEndSession(campaignId);
  const setLocation = useSetSessionLocation(campaignId, activeSessionId);
  const addGmNote = useAddGmNote(campaignId, activeSessionId);
  const { data: locations } = locationHooks.useList(campaignId);
  const { data: battles } = useBattles(campaignId, activeSessionId || undefined);
  const createBattle = useCreateBattle(campaignId, activeSessionId);

  const currentLocationName = locations?.find((location) => location.id === activeSession?.currentLocationId)
    ?.name;
  const openBattle = battles?.find((battle) => battle.status !== "resolved");

  if (!activeSession) {
    return (
      <div style={{ borderBottom: "1px solid var(--md-sys-color-outline-variant)" }}>
        {error ? (
          <div style={{ padding: "8px 16px" }}>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        ) : null}
        <div style={{ padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ flex: 1, maxWidth: 280 }}>
            <TextField label="Session title (optional)" value={newTitle} onChange={setNewTitle} />
          </div>
          <Button
            disabled={startSession.isPending}
            onClick={() =>
              startSession.mutate(
                { title: newTitle },
                { onSuccess: () => setNewTitle(""), onError: (err) => setError(errorMessage(err)) },
              )
            }
          >
            Start Session
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, borderBottom: "1px solid var(--md-sys-color-outline-variant)" }}>
      {error ? (
        <div style={{ marginBottom: 12 }}>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 500 }}>{activeSession.title || "Untitled session"} — active</div>
        {currentLocationName ? <div style={{ color: "var(--md-sys-color-on-surface-variant)" }}>@ {currentLocationName}</div> : null}
        <div style={{ flex: 1 }} />
        <Button variant="text" onClick={() => navigate(`/campaigns/${campaignId}/sessions/${activeSession.id}`)}>
          History Log
        </Button>
        {openBattle ? (
          <Button
            onClick={() =>
              navigate(`/campaigns/${campaignId}/sessions/${activeSession.id}/battles/${openBattle.id}`)
            }
          >
            Continue Battle
          </Button>
        ) : (
          <Button
            disabled={createBattle.isPending}
            onClick={() =>
              createBattle.mutate(undefined, {
                onSuccess: (battle) =>
                  navigate(`/campaigns/${campaignId}/sessions/${activeSession.id}/battles/${battle.id}`),
                onError: (err) => setError(errorMessage(err)),
              })
            }
          >
            Start Battle
          </Button>
        )}
        <Button
          variant="outlined"
          disabled={endSession.isPending}
          onClick={() =>
            endSession.mutate(activeSession.id, { onError: (err) => setError(errorMessage(err)) })
          }
        >
          End Session
        </Button>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
        {locations && locations.length > 0 ? (
          <select
            value={activeSession.currentLocationId ?? ""}
            onChange={(event) => {
              if (event.target.value) {
                setLocation.mutate(
                  { locationId: event.target.value },
                  { onError: (err) => setError(errorMessage(err)) },
                );
              }
            }}
          >
            <option value="" disabled>
              Set location…
            </option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        ) : null}
        <div style={{ maxWidth: 320, flex: 1 }}>
          <TextField label="Quick GM note" value={note} onChange={setNote} />
        </div>
        <Button
          variant="text"
          disabled={!note.trim() || addGmNote.isPending}
          onClick={() =>
            addGmNote.mutate(
              { note },
              { onSuccess: () => setNote(""), onError: (err) => setError(errorMessage(err)) },
            )
          }
        >
          Log Note
        </Button>
      </div>
    </div>
  );
}
