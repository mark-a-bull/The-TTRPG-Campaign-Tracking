import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Clue, RevealClue } from "@ttrpg/shared";
import { useSessions } from "./sessions.js";
import { apiFetch } from "./client.js";

const cluesKey = (campaignId: string) => ["campaigns", campaignId, "clues"] as const;
const sessionEventsKey = (campaignId: string, sessionId: string) =>
  ["campaigns", campaignId, "sessions", sessionId, "events"] as const;

/** The active session, if any — reveal/hide only succeed while one exists. */
export function useActiveSession(campaignId: string | undefined) {
  const { data: sessions } = useSessions(campaignId);
  return sessions?.find((session) => session.status === "active");
}

function useClueRevealMutation(campaignId: string, action: "reveal" | "hide") {
  const queryClient = useQueryClient();
  const activeSession = useActiveSession(campaignId);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: RevealClue }) =>
      apiFetch<Clue>(`/campaigns/${campaignId}/clues/${id}/${action}`, {
        method: "POST",
        body: data ? JSON.stringify(data) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cluesKey(campaignId) });
      if (activeSession) {
        queryClient.invalidateQueries({ queryKey: sessionEventsKey(campaignId, activeSession.id) });
      }
    },
  });
}

export function useRevealClue(campaignId: string) {
  return useClueRevealMutation(campaignId, "reveal");
}

export function useHideClue(campaignId: string) {
  return useClueRevealMutation(campaignId, "hide");
}
