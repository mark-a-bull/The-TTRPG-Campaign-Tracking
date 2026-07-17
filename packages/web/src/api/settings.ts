import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Settings, SettingsUpdate } from "@ttrpg/shared";
import { apiFetch } from "./client.js";

const settingsKey = ["settings"] as const;

export function useSettingsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: settingsKey,
    queryFn: () => apiFetch<Settings>("/settings"),
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SettingsUpdate) =>
      apiFetch<Settings>("/settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: (data) => queryClient.setQueryData(settingsKey, data),
  });
}
