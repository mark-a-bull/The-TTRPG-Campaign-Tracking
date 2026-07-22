import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Player, PlayerCreate, PlayerUpdate } from "@ttrpg/shared";
import { apiFetch } from "./client.js";

const playersKey = ["players"] as const;
const playerKey = (id: string) => ["players", id] as const;

export function usePlayers() {
  return useQuery({
    queryKey: playersKey,
    queryFn: () => apiFetch<Player[]>("/players"),
  });
}

export function usePlayer(id: string | undefined) {
  return useQuery({
    queryKey: playerKey(id ?? ""),
    queryFn: () => apiFetch<Player>(`/players/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PlayerCreate) =>
      apiFetch<Player>("/players", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: playersKey }),
  });
}

export function useUpdatePlayer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PlayerUpdate) =>
      apiFetch<Player>(`/players/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playersKey });
      queryClient.invalidateQueries({ queryKey: playerKey(id) });
    },
  });
}

export function useDeletePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/players/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: playersKey }),
  });
}
