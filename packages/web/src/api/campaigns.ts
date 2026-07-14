import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Campaign, CampaignCreate, CampaignUpdate } from "@ttrpg/shared";
import { apiFetch, ApiError } from "./client.js";

const campaignsKey = ["campaigns"] as const;
const campaignKey = (id: string) => ["campaigns", id] as const;

export function useCampaigns() {
  return useQuery({
    queryKey: campaignsKey,
    queryFn: () => apiFetch<Campaign[]>("/campaigns"),
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: campaignKey(id ?? ""),
    queryFn: () => apiFetch<Campaign>(`/campaigns/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CampaignCreate) =>
      apiFetch<Campaign>("/campaigns", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignsKey }),
  });
}

export function useUpdateCampaign(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CampaignUpdate) =>
      apiFetch<Campaign>(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignsKey });
      queryClient.invalidateQueries({ queryKey: campaignKey(id) });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignsKey }),
  });
}

/** Not routed through apiFetch -- this is a browser-navigated file download, not a JSON call. */
export function exportCampaignUrl(id: string): string {
  return `/api/campaigns/${id}/export`;
}

async function importCampaign(file: File): Promise<Campaign> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/campaigns/import", { method: "POST", body: formData });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(response.status, body.message ?? response.statusText);
  }
  return response.json();
}

export function useImportCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importCampaign,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignsKey }),
  });
}
