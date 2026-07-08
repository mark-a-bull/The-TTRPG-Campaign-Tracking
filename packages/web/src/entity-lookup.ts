import { entityTypeConfig, type EntityType } from "@ttrpg/shared";
import {
  clueHooks,
  locationHooks,
  monsterHooks,
  mysteryHooks,
  npcHooks,
  pcHooks,
  type MinimalEntityRecord,
} from "./api/entities.js";

export interface EntityRef {
  type: EntityType;
  id: string;
  label: string;
}

/**
 * Name lookup across all 6 entity types, for rendering EntityLinks (which can
 * point at any type). BattleConsole.tsx has its own narrower 3-type version
 * scoped to battle actors (pc/npc/monster) — kept separate rather than
 * shared, since that one is already shipped and correctly scoped for battles.
 */
export function useEntityNameLookup(campaignId: string) {
  const lists: Record<EntityType, MinimalEntityRecord[] | undefined> = {
    pcs: pcHooks.useList(campaignId).data,
    npcs: npcHooks.useList(campaignId).data,
    monsters: monsterHooks.useList(campaignId).data,
    locations: locationHooks.useList(campaignId).data,
    mysteries: mysteryHooks.useList(campaignId).data,
    clues: clueHooks.useList(campaignId).data,
  };

  const refs: EntityRef[] = [];
  const lookup = new Map<string, string>();
  for (const entityType of Object.keys(lists) as EntityType[]) {
    const titleField = entityTypeConfig[entityType].titleField;
    for (const record of lists[entityType] ?? []) {
      const label = (record[titleField] as string) || "Untitled";
      lookup.set(`${entityType}:${record.id}`, label);
      refs.push({ type: entityType, id: record.id, label });
    }
  }

  return {
    /** All entities across all 6 types, for populating an "add link" target picker. */
    refs,
    nameFor: (entityType: EntityType, id: string) => lookup.get(`${entityType}:${id}`) ?? "Unknown",
  };
}
