import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Item,
  ItemCreate,
  ItemOwnerType,
  ItemUpdate,
  InventoryVisibility,
  SetInventoryVisibility,
  TransferItem,
} from "@ttrpg/shared";
import { useActiveSession } from "./clues.js";
import { apiFetch } from "./client.js";

const itemsKey = (campaignId: string, ownerType: ItemOwnerType, ownerId: string) =>
  ["campaigns", campaignId, "items", ownerType, ownerId] as const;
const inventoryVisibilityKey = (campaignId: string, ownerType: ItemOwnerType, ownerId: string) =>
  ["campaigns", campaignId, "inventory-visibility", ownerType, ownerId] as const;
const sessionEventsKey = (campaignId: string, sessionId: string) =>
  ["campaigns", campaignId, "sessions", sessionId, "events"] as const;

export function useItemsForOwner(campaignId: string, ownerType: ItemOwnerType, ownerId: string) {
  return useQuery({
    queryKey: itemsKey(campaignId, ownerType, ownerId),
    queryFn: () =>
      apiFetch<Item[]>(`/campaigns/${campaignId}/items?ownerType=${ownerType}&ownerId=${ownerId}`),
  });
}

function invalidateOwnerItems(
  queryClient: ReturnType<typeof useQueryClient>,
  campaignId: string,
  ownerType: ItemOwnerType,
  ownerId: string,
) {
  queryClient.invalidateQueries({ queryKey: itemsKey(campaignId, ownerType, ownerId) });
}

function invalidateActiveSessionEvents(
  queryClient: ReturnType<typeof useQueryClient>,
  campaignId: string,
  activeSession: { id: string } | undefined,
) {
  if (activeSession) {
    queryClient.invalidateQueries({ queryKey: sessionEventsKey(campaignId, activeSession.id) });
  }
}

export function useCreateItem(campaignId: string, ownerType: ItemOwnerType, ownerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ItemCreate) =>
      apiFetch<Item>(`/campaigns/${campaignId}/items`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => invalidateOwnerItems(queryClient, campaignId, ownerType, ownerId),
  });
}

export function useUpdateItem(campaignId: string, ownerType: ItemOwnerType, ownerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ItemUpdate }) =>
      apiFetch<Item>(`/campaigns/${campaignId}/items/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => invalidateOwnerItems(queryClient, campaignId, ownerType, ownerId),
  });
}

export function useDeleteItem(campaignId: string, ownerType: ItemOwnerType, ownerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/campaigns/${campaignId}/items/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateOwnerItems(queryClient, campaignId, ownerType, ownerId),
  });
}

export function useTransferItem(campaignId: string, ownerType: ItemOwnerType, ownerId: string) {
  const queryClient = useQueryClient();
  const activeSession = useActiveSession(campaignId);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransferItem }) =>
      apiFetch<Item>(`/campaigns/${campaignId}/items/${id}/transfer`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, variables) => {
      // Invalidate both sides -- the item just left this owner's list and
      // joined the target's, and the target's owner/type may not be this
      // hook's own owner (e.g. transferring away from the currently open form).
      invalidateOwnerItems(queryClient, campaignId, ownerType, ownerId);
      invalidateOwnerItems(queryClient, campaignId, variables.data.ownerType, variables.data.ownerId);
      invalidateActiveSessionEvents(queryClient, campaignId, activeSession);
    },
  });
}

function useItemVisibilityMutation(
  campaignId: string,
  ownerType: ItemOwnerType,
  ownerId: string,
  action: "reveal" | "hide",
) {
  const queryClient = useQueryClient();
  const activeSession = useActiveSession(campaignId);
  return useMutation({
    mutationFn: (id: string) => apiFetch<Item>(`/campaigns/${campaignId}/items/${id}/${action}`, { method: "POST" }),
    onSuccess: () => {
      invalidateOwnerItems(queryClient, campaignId, ownerType, ownerId);
      invalidateActiveSessionEvents(queryClient, campaignId, activeSession);
    },
  });
}

export function useRevealItem(campaignId: string, ownerType: ItemOwnerType, ownerId: string) {
  return useItemVisibilityMutation(campaignId, ownerType, ownerId, "reveal");
}

export function useHideItem(campaignId: string, ownerType: ItemOwnerType, ownerId: string) {
  return useItemVisibilityMutation(campaignId, ownerType, ownerId, "hide");
}

export function useInventoryVisibility(campaignId: string, ownerType: ItemOwnerType, ownerId: string) {
  return useQuery({
    queryKey: inventoryVisibilityKey(campaignId, ownerType, ownerId),
    queryFn: () =>
      apiFetch<InventoryVisibility>(
        `/campaigns/${campaignId}/inventory-visibility?ownerType=${ownerType}&ownerId=${ownerId}`,
      ),
  });
}

function useInventoryVisibilityMutation(campaignId: string, action: "reveal" | "hide") {
  const queryClient = useQueryClient();
  const activeSession = useActiveSession(campaignId);
  return useMutation({
    mutationFn: (data: SetInventoryVisibility) =>
      apiFetch<InventoryVisibility>(`/campaigns/${campaignId}/inventory-visibility/${action}`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: inventoryVisibilityKey(campaignId, variables.ownerType, variables.ownerId),
      });
      invalidateActiveSessionEvents(queryClient, campaignId, activeSession);
    },
  });
}

export function useRevealInventory(campaignId: string) {
  return useInventoryVisibilityMutation(campaignId, "reveal");
}

export function useHideInventory(campaignId: string) {
  return useInventoryVisibilityMutation(campaignId, "hide");
}
