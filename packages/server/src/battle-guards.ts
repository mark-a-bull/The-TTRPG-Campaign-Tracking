import type { ActorType } from "@ttrpg/shared";
import { prisma } from "./prisma.js";

/**
 * Blocks deleting a PC/NPC/Monster that's currently an InitiativeEntry in a
 * non-resolved battle — otherwise the battle console keeps functioning
 * against an orphaned entry (falls back to "Unknown combatant") instead of
 * failing loudly. Deletion is allowed once the battle is resolved.
 */
export async function assertNotInActiveBattle(actorType: ActorType, actorId: string) {
  const activeEntry = await prisma.initiativeEntry.findFirst({
    where: { actorType, actorId, battle: { status: { not: "resolved" } } },
  });
  return activeEntry
    ? { blocked: true as const, message: "Cannot delete a combatant that's part of an active battle" }
    : { blocked: false as const };
}
