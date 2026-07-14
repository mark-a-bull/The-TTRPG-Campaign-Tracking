import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { awardXpSchema, pcCreateSchema, pcSchema, pcUpdateSchema } from "@ttrpg/shared";
import { assertNotInActiveBattle } from "../battle-guards.js";
import { errorResponseSchema } from "../error-response.js";
import { prisma } from "../prisma.js";
import { appendSessionEvent } from "../session-events.js";
import { registerNestedEntityRoutes, serializeTimestamps } from "./nested-entity.js";

export function registerPcRoutes(app: FastifyInstance) {
  registerNestedEntityRoutes(app, {
    prefix: "pcs",
    delegate: prisma.pc,
    createSchema: pcCreateSchema,
    updateSchema: pcUpdateSchema,
    readSchema: pcSchema,
    beforeDelete: (id) => assertNotInActiveBattle("pc", id),
  });

  const typed = app.withTypeProvider<ZodTypeProvider>();
  const pcParams = z.object({ campaignId: z.string().uuid(), id: z.string().uuid() });

  typed.post(
    "/api/campaigns/:campaignId/pcs/:id/award-xp",
    {
      schema: {
        params: pcParams,
        body: awardXpSchema,
        response: { 200: pcSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const pc = await prisma.pc.findFirst({ where: { id, campaignId } });
      if (!pc) {
        return reply.code(404).send({ message: "Not found" });
      }

      const { amount, note } = request.body;
      const newXp = Math.max(0, pc.xp + amount);
      const updated = await prisma.pc.update({ where: { id }, data: { xp: newXp } });

      const activeSession = await prisma.session.findFirst({ where: { campaignId, status: "active" } });
      if (activeSession) {
        await appendSessionEvent(activeSession.id, campaignId, "XP_AWARDED", {
          payload: { pcId: pc.id, pcName: pc.name, amount, newXp, note },
        });
      }

      return serializeTimestamps(updated);
    },
  );
}
