import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import type { AddGmNote, SessionCreate, SessionEvent, Session, SetLocation, PaginatedSessionEvents } from "@ttrpg/shared";
import { apiFetch } from "./client.js";

const sessionsKey = (campaignId: string) => ["campaigns", campaignId, "sessions"] as const;
const sessionKey = (campaignId: string, sessionId: string) =>
  ["campaigns", campaignId, "sessions", sessionId] as const;
const sessionEventsKey = (campaignId: string, sessionId: string) =>
  ["campaigns", campaignId, "sessions", sessionId, "events"] as const;

export function useSessions(campaignId: string | undefined) {
  return useQuery({
    queryKey: sessionsKey(campaignId ?? ""),
    queryFn: () => apiFetch<Session[]>(`/campaigns/${campaignId}/sessions`),
    enabled: Boolean(campaignId),
  });
}

export function useSession(campaignId: string | undefined, sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionKey(campaignId ?? "", sessionId ?? ""),
    queryFn: () => apiFetch<Session>(`/campaigns/${campaignId}/sessions/${sessionId}`),
    enabled: Boolean(campaignId && sessionId),
  });
}

export function useSessionEvents(campaignId: string | undefined, sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionEventsKey(campaignId ?? "", sessionId ?? ""),
    queryFn: () => apiFetch<SessionEvent[]>(`/campaigns/${campaignId}/sessions/${sessionId}/events`),
    enabled: Boolean(campaignId && sessionId),
  });
}

export function useInfiniteSessionEvents(
  campaignId: string | undefined,
  sessionId: string | undefined,
  order: "asc" | "desc" = "asc",
) {
  return useInfiniteQuery<PaginatedSessionEvents>({
    queryKey: [...sessionEventsKey(campaignId ?? "", sessionId ?? ""), { order }],
    queryFn: ({ pageParam = 0 }) =>
      apiFetch<PaginatedSessionEvents>(
        `/campaigns/${campaignId}/sessions/${sessionId}/events?offset=${pageParam}&limit=20&order=${order}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.length * 20;
    },
    enabled: Boolean(campaignId && sessionId),
  });
}

export function useStartSession(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SessionCreate) =>
      apiFetch<Session>(`/campaigns/${campaignId}/sessions`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsKey(campaignId) }),
  });
}

export function useEndSession(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<Session>(`/campaigns/${campaignId}/sessions/${sessionId}/end`, { method: "POST" }),
    onSuccess: (_data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: sessionsKey(campaignId) });
      queryClient.invalidateQueries({ queryKey: sessionKey(campaignId, sessionId) });
    },
  });
}

export function useSetSessionLocation(campaignId: string, sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SetLocation) =>
      apiFetch<Session>(`/campaigns/${campaignId}/sessions/${sessionId}/location`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // SessionBanner derives the active session from the list query, not
      // useSession, so the list must be invalidated too or it'll keep
      // showing the pre-update currentLocationId.
      queryClient.invalidateQueries({ queryKey: sessionsKey(campaignId) });
      queryClient.invalidateQueries({ queryKey: sessionKey(campaignId, sessionId) });
      queryClient.invalidateQueries({ queryKey: sessionEventsKey(campaignId, sessionId) });
    },
  });
}

export function useAddGmNote(campaignId: string, sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddGmNote) =>
      apiFetch<SessionEvent>(`/campaigns/${campaignId}/sessions/${sessionId}/notes`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionEventsKey(campaignId, sessionId) }),
  });
}
