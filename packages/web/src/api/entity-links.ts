import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EntityLink, EntityLinkCreate, EntityLinkUpdate, EntityType } from "@ttrpg/shared";
import { apiFetch } from "./client.js";

const linksKey = (campaignId: string, entityType?: EntityType, entityId?: string) =>
  ["campaigns", campaignId, "links", entityType ?? "", entityId ?? ""] as const;

export function useEntityLinks(campaignId: string, entityType?: EntityType, entityId?: string) {
  return useQuery({
    queryKey: linksKey(campaignId, entityType, entityId),
    queryFn: () => {
      const query = entityType && entityId ? `?entityType=${entityType}&entityId=${entityId}` : "";
      return apiFetch<EntityLink[]>(`/campaigns/${campaignId}/links${query}`);
    },
    enabled: Boolean(campaignId && entityType && entityId),
  });
}

function useInvalidateLinks(campaignId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "links"] });
}

export function useCreateLink(campaignId: string) {
  const invalidate = useInvalidateLinks(campaignId);
  return useMutation({
    mutationFn: (data: EntityLinkCreate) =>
      apiFetch<EntityLink>(`/campaigns/${campaignId}/links`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });
}

export function useUpdateLink(campaignId: string) {
  const invalidate = useInvalidateLinks(campaignId);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EntityLinkUpdate }) =>
      apiFetch<EntityLink>(`/campaigns/${campaignId}/links/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteLink(campaignId: string) {
  const invalidate = useInvalidateLinks(campaignId);
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/campaigns/${campaignId}/links/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
