import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { InitiativeEntry } from "@ttrpg/shared";
import {
  useAddCombatant,
  useAdvanceTurn,
  useBattle,
  useBattleAction,
  useRemoveCombatant,
  useResolveBattle,
  useRollNpcInitiative,
  useStartBattle,
} from "../api/battles.js";
import { monsterHooks, npcHooks, pcHooks } from "../api/entities.js";
import { Button } from "../ui/Button.js";
import { ErrorBanner, errorMessage } from "../ui/ErrorBanner.js";
import { TextField } from "../ui/TextField.js";
import { TopAppBar } from "../ui/TopAppBar.js";

function useEntityNameLookup(campaignId: string) {
  const { data: pcs } = pcHooks.useList(campaignId);
  const { data: npcs } = npcHooks.useList(campaignId);
  const { data: monsters } = monsterHooks.useList(campaignId);
  const lookup = new Map<string, string>();
  for (const record of [...(pcs ?? []), ...(npcs ?? []), ...(monsters ?? [])]) {
    lookup.set(record.id, record.name);
  }
  return lookup;
}

function entryLabel(entry: InitiativeEntry, nameLookup: Map<string, string>): string {
  if (entry.adHocName) return entry.adHocName;
  if (entry.actorId) return nameLookup.get(entry.actorId) ?? "Unknown";
  return "Unknown";
}

export function BattleConsole() {
  const { campaignId, sessionId, battleId } = useParams<{
    campaignId: string;
    sessionId: string;
    battleId: string;
  }>();
  const navigate = useNavigate();
  const { data: battle, isLoading } = useBattle(campaignId, sessionId, battleId);
  const nameLookup = useEntityNameLookup(campaignId!);

  if (isLoading || !battle) {
    return <p style={{ padding: 24 }}>Loading battle…</p>;
  }

  return (
    <div>
      <TopAppBar
        title={`Battle — ${battle.status}`}
        leading={
          <Button variant="text" onClick={() => navigate(`/campaigns/${campaignId}`)}>
            ← Campaign
          </Button>
        }
      />
      <div style={{ padding: 24, maxWidth: 800 }}>
        {battle.status === "building" ? (
          <BuildingView campaignId={campaignId!} sessionId={sessionId!} battleId={battleId!} battle={battle} nameLookup={nameLookup} />
        ) : null}
        {battle.status === "active" ? (
          <ActiveView campaignId={campaignId!} sessionId={sessionId!} battleId={battleId!} battle={battle} nameLookup={nameLookup} />
        ) : null}
        {battle.status === "resolved" ? <ResolvedView battle={battle} nameLookup={nameLookup} /> : null}
      </div>
    </div>
  );
}

interface ViewProps {
  campaignId: string;
  sessionId: string;
  battleId: string;
  battle: { entries: InitiativeEntry[]; currentTurnIndex: number };
  nameLookup: Map<string, string>;
}

function BuildingView({ campaignId, sessionId, battleId, battle, nameLookup }: ViewProps) {
  const { data: pcs } = pcHooks.useList(campaignId);
  const { data: npcs } = npcHooks.useList(campaignId);
  const { data: monsters } = monsterHooks.useList(campaignId);
  const addCombatant = useAddCombatant(campaignId, sessionId, battleId);
  const removeCombatant = useRemoveCombatant(campaignId, sessionId, battleId);
  const rollNpcInitiative = useRollNpcInitiative(campaignId, sessionId, battleId);
  const startBattle = useStartBattle(campaignId, sessionId, battleId);
  const [adHocName, setAdHocName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addedActorIds = new Set(battle.entries.map((entry) => entry.actorId).filter(Boolean));

  return (
    <div>
      {error ? (
        <div style={{ marginBottom: 16 }}>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}
      <h2>Add Combatants</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {(
          [
            ["pc", "Player Character", pcs],
            ["npc", "NPC", npcs],
            ["monster", "Monster", monsters],
          ] as const
        ).map(([actorType, label, records]) => {
          const available = (records ?? []).filter((record) => !addedActorIds.has(record.id));
          if (available.length === 0) return null;
          return (
            <div key={actorType} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                onChange={(event) => {
                  if (event.target.value) {
                    addCombatant.mutate(
                      { kind: "entity", actorType, actorId: event.target.value },
                      { onError: (err) => setError(errorMessage(err)) },
                    );
                    event.target.value = "";
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  Add {label}…
                </option>
                {available.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 320 }}>
          <TextField label="Ad-hoc combatant name" value={adHocName} onChange={setAdHocName} />
          <Button
            disabled={!adHocName.trim()}
            onClick={() => {
              addCombatant.mutate(
                { kind: "adHoc", adHocName },
                { onSuccess: () => setAdHocName(""), onError: (err) => setError(errorMessage(err)) },
              );
            }}
          >
            Add
          </Button>
        </div>
      </div>

      <h2>Combatants</h2>
      {battle.entries.length === 0 ? <p>No combatants yet.</p> : null}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {battle.entries.map((entry) => (
          <li
            key={entry.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderRadius: 8,
              background: "var(--md-sys-color-surface-variant)",
            }}
          >
            <div style={{ flex: 1 }}>{entryLabel(entry, nameLookup)}</div>
            <div>Initiative: {entry.initiative}</div>
            <Button
              variant="text"
              onClick={() => removeCombatant.mutate(entry.id, { onError: (err) => setError(errorMessage(err)) })}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Button
          variant="outlined"
          onClick={() => rollNpcInitiative.mutate(undefined, { onError: (err) => setError(errorMessage(err)) })}
        >
          Auto-roll NPCs/Monsters
        </Button>
        <Button
          disabled={battle.entries.length === 0}
          onClick={() => startBattle.mutate(undefined, { onError: (err) => setError(errorMessage(err)) })}
        >
          Start Battle
        </Button>
      </div>
    </div>
  );
}

function ActiveView({ campaignId, sessionId, battleId, battle, nameLookup }: ViewProps) {
  const advanceTurn = useAdvanceTurn(campaignId, sessionId, battleId);
  const resolveBattle = useResolveBattle(campaignId, sessionId, battleId);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {error ? (
        <div style={{ marginBottom: 16 }}>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Button onClick={() => advanceTurn.mutate(undefined, { onError: (err) => setError(errorMessage(err)) })}>
          Advance Turn
        </Button>
        <Button
          variant="outlined"
          onClick={() => resolveBattle.mutate(undefined, { onError: (err) => setError(errorMessage(err)) })}
        >
          Resolve Battle
        </Button>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {battle.entries.map((entry, index) => (
          <EntryRow
            key={entry.id}
            campaignId={campaignId}
            sessionId={sessionId}
            battleId={battleId}
            entry={entry}
            isCurrent={index === battle.currentTurnIndex}
            label={entryLabel(entry, nameLookup)}
          />
        ))}
      </ul>
    </div>
  );
}

function EntryRow({
  campaignId,
  sessionId,
  battleId,
  entry,
  isCurrent,
  label,
}: {
  campaignId: string;
  sessionId: string;
  battleId: string;
  entry: InitiativeEntry;
  isCurrent: boolean;
  label: string;
}) {
  const applyAction = useBattleAction(campaignId, sessionId, battleId);
  const [amount, setAmount] = useState("1");
  const [statusLabel, setStatusLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = Math.max(1, Number.parseInt(amount, 10) || 1);
  const onActionError = (err: unknown) => setError(errorMessage(err));

  return (
    <li
      style={{
        padding: 16,
        borderRadius: 8,
        background: isCurrent ? "var(--md-sys-color-primary-container)" : "var(--md-sys-color-surface-variant)",
        border: isCurrent ? "2px solid var(--md-sys-color-primary)" : "2px solid transparent",
      }}
    >
      {error ? (
        <div style={{ marginBottom: 12 }}>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 500 }}>{label}</div>
        <div>Initiative: {entry.initiative}</div>
        {entry.currentHp !== null ? (
          <div>
            HP: {entry.currentHp}
            {entry.maxHp !== null ? ` / ${entry.maxHp}` : ""}
          </div>
        ) : null}
        {isCurrent ? <div style={{ fontWeight: 600 }}>Current Turn</div> : null}
      </div>

      {entry.statuses.filter((status) => !status.expired).length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {entry.statuses
            .filter((status) => !status.expired)
            .map((status) => (
              <span
                key={status.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 8px",
                  borderRadius: 12,
                  background: "var(--md-sys-color-surface)",
                  fontSize: 12,
                }}
              >
                {status.label}
                <button
                  onClick={() =>
                    applyAction.mutate(
                      { entryId: entry.id, action: { type: "status-expire", statusId: status.id } },
                      { onError: onActionError },
                    )
                  }
                  style={{ border: "none", background: "none", cursor: "pointer" }}
                >
                  ×
                </button>
              </span>
            ))}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          style={{ width: 64 }}
        />
        <Button
          variant="text"
          onClick={() =>
            applyAction.mutate(
              { entryId: entry.id, action: { type: "damage", amount: parsedAmount } },
              { onError: onActionError },
            )
          }
        >
          Damage
        </Button>
        <Button
          variant="text"
          onClick={() =>
            applyAction.mutate(
              { entryId: entry.id, action: { type: "heal", amount: parsedAmount } },
              { onError: onActionError },
            )
          }
        >
          Heal
        </Button>
        <input
          type="text"
          placeholder="Status label"
          value={statusLabel}
          onChange={(event) => setStatusLabel(event.target.value)}
          style={{ width: 140 }}
        />
        <Button
          variant="text"
          disabled={!statusLabel.trim()}
          onClick={() => {
            applyAction.mutate(
              { entryId: entry.id, action: { type: "status-apply", label: statusLabel, note: "" } },
              { onError: onActionError },
            );
            setStatusLabel("");
          }}
        >
          Add Status
        </Button>
        <Button
          variant="text"
          onClick={() => applyAction.mutate({ entryId: entry.id, action: { type: "ko" } }, { onError: onActionError })}
        >
          KO
        </Button>
      </div>
    </li>
  );
}

function ResolvedView({
  battle,
  nameLookup,
}: {
  battle: { entries: InitiativeEntry[] };
  nameLookup: Map<string, string>;
}) {
  return (
    <div>
      <h2>Battle Resolved</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {battle.entries.map((entry) => (
          <li key={entry.id} style={{ padding: 12, borderRadius: 8, background: "var(--md-sys-color-surface-variant)" }}>
            {entryLabel(entry, nameLookup)}
            {entry.currentHp !== null ? ` — ${entry.currentHp}${entry.maxHp !== null ? `/${entry.maxHp}` : ""} HP` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
