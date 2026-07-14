import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AwardXp, PC } from "@ttrpg/shared";
import { useActiveSession } from "./clues.js";
import { apiFetch } from "./client.js";

const pcsKey = (campaignId: string) => ["campaigns", campaignId, "pcs"] as const;
const sessionEventsKey = (campaignId: string, sessionId: string) =>
  ["campaigns", campaignId, "sessions", sessionId, "events"] as const;

export function useAwardXp(campaignId: string) {
  const queryClient = useQueryClient();
  const activeSession = useActiveSession(campaignId);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AwardXp }) =>
      apiFetch<PC>(`/campaigns/${campaignId}/pcs/${id}/award-xp`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pcsKey(campaignId) });
      if (activeSession) {
        queryClient.invalidateQueries({ queryKey: sessionEventsKey(campaignId, activeSession.id) });
      }
    },
  });
}
