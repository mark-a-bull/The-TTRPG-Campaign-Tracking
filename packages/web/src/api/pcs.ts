import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AwardXp, PC } from "@ttrpg/shared";
import { useActiveSession } from "./clues.js";
import { sessionSummaryKey } from "./sessions.js";
import { apiFetch } from "./client.js";

const pcsKey = (campaignId: string) => ["campaigns", campaignId, "pcs"] as const;
const sessionEventsKey = (campaignId: string, sessionId: string) =>
  ["campaigns", campaignId, "sessions", sessionId, "events"] as const;

/**
 * `sessionId`, when passed, targets that exact session instead of
 * auto-detecting the active one -- needed by the end-of-session summary's
 * bulk award panel, since by the time the summary is shown the session has
 * already ended and there's no "active" session left to auto-detect.
 */
export function useAwardXp(campaignId: string, sessionId?: string) {
  const queryClient = useQueryClient();
  const activeSession = useActiveSession(campaignId);
  const targetSessionId = sessionId ?? activeSession?.id;
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AwardXp }) =>
      apiFetch<PC>(`/campaigns/${campaignId}/pcs/${id}/award-xp`, {
        method: "POST",
        body: JSON.stringify(sessionId ? { ...data, sessionId } : data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pcsKey(campaignId) });
      if (targetSessionId) {
        queryClient.invalidateQueries({ queryKey: sessionEventsKey(campaignId, targetSessionId) });
        queryClient.invalidateQueries({ queryKey: sessionSummaryKey(campaignId, targetSessionId) });
      }
    },
  });
}
