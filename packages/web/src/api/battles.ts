import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AddCombatant, Battle, BattleAction, BattleDetail } from "@ttrpg/shared";
import { apiFetch } from "./client.js";

const battlesKey = (campaignId: string, sessionId: string) =>
  ["campaigns", campaignId, "sessions", sessionId, "battles"] as const;
const battleKey = (campaignId: string, sessionId: string, battleId: string) =>
  ["campaigns", campaignId, "sessions", sessionId, "battles", battleId] as const;
const sessionEventsKey = (campaignId: string, sessionId: string) =>
  ["campaigns", campaignId, "sessions", sessionId, "events"] as const;

function battlePath(campaignId: string, sessionId: string, battleId?: string) {
  const base = `/campaigns/${campaignId}/sessions/${sessionId}/battles`;
  return battleId ? `${base}/${battleId}` : base;
}

export function useBattles(campaignId: string | undefined, sessionId: string | undefined) {
  return useQuery({
    queryKey: battlesKey(campaignId ?? "", sessionId ?? ""),
    queryFn: () => apiFetch<Battle[]>(battlePath(campaignId!, sessionId!)),
    enabled: Boolean(campaignId && sessionId),
  });
}

export function useBattle(
  campaignId: string | undefined,
  sessionId: string | undefined,
  battleId: string | undefined,
) {
  return useQuery({
    queryKey: battleKey(campaignId ?? "", sessionId ?? "", battleId ?? ""),
    queryFn: () => apiFetch<BattleDetail>(battlePath(campaignId!, sessionId!, battleId)),
    enabled: Boolean(campaignId && sessionId && battleId),
  });
}

export function useCreateBattle(campaignId: string, sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<Battle>(battlePath(campaignId, sessionId), { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: battlesKey(campaignId, sessionId) }),
  });
}

/**
 * Every battle mutation endpoint returns the full BattleDetail, so mutations
 * write that response straight into the query cache with setQueryData rather
 * than invalidating and refetching — the console stays snappy turn to turn.
 */
function useBattleMutation<TInput>(
  campaignId: string,
  sessionId: string,
  battleId: string,
  request: (input: TInput) => Promise<BattleDetail>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (data) => {
      queryClient.setQueryData(battleKey(campaignId, sessionId, battleId), data);
      queryClient.invalidateQueries({ queryKey: sessionEventsKey(campaignId, sessionId) });
    },
  });
}

export function useAddCombatant(campaignId: string, sessionId: string, battleId: string) {
  return useBattleMutation<AddCombatant>(campaignId, sessionId, battleId, (data) =>
    apiFetch<BattleDetail>(`${battlePath(campaignId, sessionId, battleId)}/entries`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  );
}

export function useRemoveCombatant(campaignId: string, sessionId: string, battleId: string) {
  return useBattleMutation<string>(campaignId, sessionId, battleId, (entryId) =>
    apiFetch<BattleDetail>(`${battlePath(campaignId, sessionId, battleId)}/entries/${entryId}`, {
      method: "DELETE",
    }),
  );
}

export function useRollNpcInitiative(campaignId: string, sessionId: string, battleId: string) {
  return useBattleMutation<void>(campaignId, sessionId, battleId, () =>
    apiFetch<BattleDetail>(`${battlePath(campaignId, sessionId, battleId)}/roll-npc-initiative`, {
      method: "POST",
    }),
  );
}

export function useStartBattle(campaignId: string, sessionId: string, battleId: string) {
  return useBattleMutation<void>(campaignId, sessionId, battleId, () =>
    apiFetch<BattleDetail>(`${battlePath(campaignId, sessionId, battleId)}/start`, { method: "POST" }),
  );
}

export function useAdvanceTurn(campaignId: string, sessionId: string, battleId: string) {
  return useBattleMutation<void>(campaignId, sessionId, battleId, () =>
    apiFetch<BattleDetail>(`${battlePath(campaignId, sessionId, battleId)}/advance-turn`, { method: "POST" }),
  );
}

export function useResolveBattle(campaignId: string, sessionId: string, battleId: string) {
  return useBattleMutation<void>(campaignId, sessionId, battleId, () =>
    apiFetch<BattleDetail>(`${battlePath(campaignId, sessionId, battleId)}/resolve`, { method: "POST" }),
  );
}

export function useBattleAction(campaignId: string, sessionId: string, battleId: string) {
  return useBattleMutation<{ entryId: string; action: BattleAction }>(
    campaignId,
    sessionId,
    battleId,
    ({ entryId, action }) =>
      apiFetch<BattleDetail>(`${battlePath(campaignId, sessionId, battleId)}/entries/${entryId}/actions`, {
        method: "POST",
        body: JSON.stringify(action),
      }),
  );
}
