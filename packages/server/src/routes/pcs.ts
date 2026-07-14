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

      const { amount, note, level, sessionId } = request.body;
      const newXp = Math.max(0, pc.xp + amount);
      const levelChanged = level !== undefined && level !== pc.level;

      const updated = await prisma.pc.update({
        where: { id },
        data: { xp: newXp, ...(levelChanged ? { level } : {}) },
      });

      // An explicit sessionId (e.g. from the end-of-session summary's bulk
      // award panel) targets that session directly, regardless of its
      // status -- the summary is shown right after a session ends, so by
      // then there's no "active" session left for the fallback below to
      // find. Without an explicit sessionId, fall back to the active
      // session (the standalone per-PC Award XP action's behavior).
      let targetSession: { id: string } | null;
      if (sessionId) {
        targetSession = await prisma.session.findFirst({ where: { id: sessionId, campaignId } });
        if (!targetSession) {
          return reply.code(404).send({ message: "Session not found" });
        }
      } else {
        targetSession = await prisma.session.findFirst({ where: { campaignId, status: "active" } });
      }

      if (targetSession) {
        if (sessionId) {
          // Came from the end-of-session summary's bulk award panel -- log
          // XP and level changes as their own distinct event types rather
          // than the standalone flow's combined XP_AWARDED, so the history
          // log (and anything reading it later) can tell end-of-session
          // awards apart from a mid-session Award XP action.
          if (amount !== 0) {
            await appendSessionEvent(targetSession.id, campaignId, "END_OF_SESSION_XP_AWARDED", {
              payload: { pcId: pc.id, pcName: pc.name, amount, newXp, note },
            });
          }
          if (levelChanged) {
            await appendSessionEvent(targetSession.id, campaignId, "END_OF_SESSION_LEVEL_AWARDED", {
              payload: { pcId: pc.id, pcName: pc.name, previousLevel: pc.level, newLevel: level },
            });
          }
        } else {
          await appendSessionEvent(targetSession.id, campaignId, "XP_AWARDED", {
            payload: {
              pcId: pc.id,
              pcName: pc.name,
              amount,
              newXp,
              note,
              ...(levelChanged ? { previousLevel: pc.level, newLevel: level } : {}),
            },
          });
        }
      }

      return serializeTimestamps(updated);
    },
  );
}
