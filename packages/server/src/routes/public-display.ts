import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { publicDisplaySchema } from "@ttrpg/shared";
import { errorResponseSchema } from "../error-response.js";
import { prisma } from "../prisma.js";

async function buildPublicDisplay(campaignId: string) {
  const [campaign, pcs, activeSession] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId } }),
    prisma.pc.findMany({ where: { campaignId } }),
    prisma.session.findFirst({ where: { campaignId, status: "active" } }),
  ]);
  if (!campaign) return null;

  const partyMembers = pcs.map((pc) => ({ id: pc.id, name: pc.name, portraitImageUrl: pc.portraitImageUrl }));

  if (!activeSession) {
    return { campaignName: campaign.name, partyMembers, session: null };
  }

  const [location, clues, battle, npcs, monsters] = await Promise.all([
    activeSession.currentLocationId
      ? prisma.location.findUnique({ where: { id: activeSession.currentLocationId } })
      : Promise.resolve(null),
    prisma.clue.findMany({ where: { campaignId, visibility: "revealed" } }),
    prisma.battleEncounter.findFirst({
      where: { sessionId: activeSession.id, status: "active" },
      include: { entries: { orderBy: { order: "asc" } } },
    }),
    prisma.npc.findMany({ where: { campaignId } }),
    prisma.monster.findMany({ where: { campaignId } }),
  ]);

  // Only party-wide reveals (empty/null visibleTo) are shown -- a clue
  // scoped to specific PCs stays private, since the public screen has no
  // way to know which player is looking at it.
  const revealedClues = clues
    .filter((clue) => {
      const visibleTo = clue.visibleTo ? (JSON.parse(clue.visibleTo) as string[]) : [];
      return visibleTo.length === 0;
    })
    .map((clue) => ({ id: clue.id, title: clue.title, content: clue.content }));

  let battleSummary: { status: "building" | "active" | "resolved"; entries: { id: string; label: string; isCurrent: boolean }[] } | null = null;
  if (battle) {
    const nameLookup = new Map<string, string>();
    for (const record of [...pcs, ...npcs, ...monsters]) nameLookup.set(record.id, record.name);
    battleSummary = {
      status: battle.status as "building" | "active" | "resolved",
      // Deliberately no currentHp/maxHp in the response -- the public
      // screen shows turn order only, not damage/HP numbers.
      entries: battle.entries.map((entry, index) => ({
        id: entry.id,
        label: entry.adHocName ?? (entry.actorId ? (nameLookup.get(entry.actorId) ?? "Unknown combatant") : "Unknown combatant"),
        isCurrent: index === battle.currentTurnIndex,
      })),
    };
  }

  return {
    campaignName: campaign.name,
    partyMembers,
    session: {
      title: activeSession.title,
      currentLocation: location ? { name: location.name, imageUrl: location.imageUrl } : null,
      revealedClues,
      battle: battleSummary,
    },
  };
}

export function registerPublicDisplayRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/campaigns/:id/public-display",
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: publicDisplaySchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const data = await buildPublicDisplay(request.params.id);
      if (!data) {
        return reply.code(404).send({ message: "Campaign not found" });
      }
      return data;
    },
  );
}
