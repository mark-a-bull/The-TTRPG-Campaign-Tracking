import type { EntityType } from "@ttrpg/shared";
import { prisma } from "./prisma.js";

// A switch (rather than dynamically indexing a record of Prisma delegates)
// because TS can't call through a union of delegate types with differing
// generic signatures. Covers all 6 entity types, unlike battles.ts's
// findActorInCampaign which is intentionally scoped to the 3 battle-actor
// types (pc/npc/monster) — kept separate rather than shared.
export function findEntityInCampaign(entityType: EntityType, id: string, campaignId: string) {
  switch (entityType) {
    case "pcs":
      return prisma.pc.findFirst({ where: { id, campaignId } });
    case "npcs":
      return prisma.npc.findFirst({ where: { id, campaignId } });
    case "monsters":
      return prisma.monster.findFirst({ where: { id, campaignId } });
    case "locations":
      return prisma.location.findFirst({ where: { id, campaignId } });
    case "mysteries":
      return prisma.mystery.findFirst({ where: { id, campaignId } });
    case "clues":
      return prisma.clue.findFirst({ where: { id, campaignId } });
  }
}
