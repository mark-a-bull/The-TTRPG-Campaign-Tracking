import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import type {
  Clue,
  ClueCreate,
  ClueUpdate,
  EntityType,
  Location,
  LocationCreate,
  LocationUpdate,
  Monster,
  MonsterCreate,
  MonsterUpdate,
  Mystery,
  MysteryCreate,
  MysteryUpdate,
  NPC,
  NPCCreate,
  NPCUpdate,
  Organization,
  OrganizationCreate,
  OrganizationUpdate,
  PC,
  PCCreate,
  PCUpdate,
} from "@ttrpg/shared";
import { apiFetch } from "./client.js";

function createEntityHooks<TRecord extends { id: string }, TCreate, TUpdate>(entityType: EntityType) {
  const listKey = (campaignId: string) => ["campaigns", campaignId, entityType] as const;

  function useList(campaignId: string | undefined) {
    return useQuery({
      queryKey: listKey(campaignId ?? ""),
      queryFn: () => apiFetch<TRecord[]>(`/campaigns/${campaignId}/${entityType}`),
      enabled: Boolean(campaignId),
    });
  }

  function useCreate(campaignId: string) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (data: TCreate) =>
        apiFetch<TRecord>(`/campaigns/${campaignId}/${entityType}`, {
          method: "POST",
          body: JSON.stringify(data),
        }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey(campaignId) }),
    });
  }

  function useUpdate(campaignId: string) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ id, data }: { id: string; data: TUpdate }) =>
        apiFetch<TRecord>(`/campaigns/${campaignId}/${entityType}/${id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey(campaignId) }),
    });
  }

  function useDelete(campaignId: string) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (id: string) =>
        apiFetch<void>(`/campaigns/${campaignId}/${entityType}/${id}`, { method: "DELETE" }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey(campaignId) }),
    });
  }

  return { useList, useCreate, useUpdate, useDelete };
}

export const pcHooks = createEntityHooks<PC, PCCreate, PCUpdate>("pcs");
export const npcHooks = createEntityHooks<NPC, NPCCreate, NPCUpdate>("npcs");
export const monsterHooks = createEntityHooks<Monster, MonsterCreate, MonsterUpdate>("monsters");
export const locationHooks = createEntityHooks<Location, LocationCreate, LocationUpdate>("locations");
export const mysteryHooks = createEntityHooks<Mystery, MysteryCreate, MysteryUpdate>("mysteries");
export const clueHooks = createEntityHooks<Clue, ClueCreate, ClueUpdate>("clues");
export const organizationHooks = createEntityHooks<Organization, OrganizationCreate, OrganizationUpdate>(
  "organizations",
);

/** A record shape wide enough for the generic (type-erased) entity list view. */
export interface MinimalEntityRecord {
  id: string;
  campaignId: string;
  [key: string]: unknown;
}

interface GenericEntityHooks {
  useList: (campaignId: string | undefined) => UseQueryResult<MinimalEntityRecord[], Error>;
  useDelete: (campaignId: string) => UseMutationResult<void, Error, string, unknown>;
}

// useList/useDelete don't depend on the per-entity TCreate/TUpdate generics, so
// widening their record type to MinimalEntityRecord is safe for the generic list
// view; useCreate/useUpdate stay on the fully-typed exports above for per-type forms.
export const entityHooksByType: Record<EntityType, GenericEntityHooks> = {
  pcs: pcHooks as unknown as GenericEntityHooks,
  npcs: npcHooks as unknown as GenericEntityHooks,
  monsters: monsterHooks as unknown as GenericEntityHooks,
  locations: locationHooks as unknown as GenericEntityHooks,
  mysteries: mysteryHooks as unknown as GenericEntityHooks,
  clues: clueHooks as unknown as GenericEntityHooks,
  organizations: organizationHooks as unknown as GenericEntityHooks,
};
