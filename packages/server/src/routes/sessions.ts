import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  addGmNoteSchema,
  sessionCreateSchema,
  sessionEventSchema,
  sessionSchema,
  setLocationSchema,
  type SessionStatus,
} from "@ttrpg/shared";
import { errorResponseSchema } from "../error-response.js";
import { prisma } from "../prisma.js";
import { appendSessionEvent, serializeSessionEvent } from "../session-events.js";

// `status` is a plain `string` in Prisma (SQLite has no native enum); the cast
// narrows to the literal union the Zod response schema expects. Runtime values
// are always one of the literals since they're only ever written as literals.
function serializeSession<
  T extends { status: string; startedAt: Date; endedAt: Date | null; createdAt: Date; updatedAt: Date },
>(session: T) {
  return {
    ...session,
    status: session.status as SessionStatus,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export function registerSessionRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const campaignParams = z.object({ campaignId: z.string().uuid() });
  const sessionParams = z.object({ campaignId: z.string().uuid(), id: z.string().uuid() });

  async function assertCampaignExists(campaignId: string) {
    return (await prisma.campaign.findUnique({ where: { id: campaignId } })) !== null;
  }

  typed.get(
    "/api/campaigns/:campaignId/sessions",
    {
      schema: {
        params: campaignParams,
        response: { 200: z.array(sessionSchema), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId } = request.params;
      if (!(await assertCampaignExists(campaignId))) {
        return reply.code(404).send({ message: "Campaign not found" });
      }
      const sessions = await prisma.session.findMany({
        where: { campaignId },
        orderBy: { startedAt: "desc" },
      });
      return sessions.map(serializeSession);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/sessions",
    {
      schema: {
        params: campaignParams,
        body: sessionCreateSchema,
        response: { 201: sessionSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId } = request.params;
      if (!(await assertCampaignExists(campaignId))) {
        return reply.code(404).send({ message: "Campaign not found" });
      }
      const activeSession = await prisma.session.findFirst({ where: { campaignId, status: "active" } });
      if (activeSession) {
        return reply.code(409).send({ message: "A session is already active for this campaign" });
      }
      const title = request.body.title.trim() || new Date().toLocaleString();
      const session = await prisma.session.create({
        data: { campaignId, title },
      });
      await appendSessionEvent(session.id, campaignId, "SESSION_STARTED");
      return reply.code(201).send(serializeSession(session));
    },
  );

  typed.get(
    "/api/campaigns/:campaignId/sessions/:id",
    {
      schema: {
        params: sessionParams,
        response: { 200: sessionSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const session = await prisma.session.findFirst({ where: { id, campaignId } });
      if (!session) {
        return reply.code(404).send({ message: "Session not found" });
      }
      return serializeSession(session);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/sessions/:id/end",
    {
      schema: {
        params: sessionParams,
        response: { 200: sessionSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const session = await prisma.session.findFirst({ where: { id, campaignId } });
      if (!session) {
        return reply.code(404).send({ message: "Session not found" });
      }
      if (session.status !== "active") {
        return reply.code(409).send({ message: "Session is not active" });
      }
      const updated = await prisma.session.update({
        where: { id },
        data: { status: "ended", endedAt: new Date() },
      });
      await appendSessionEvent(id, campaignId, "SESSION_ENDED");
      return serializeSession(updated);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/sessions/:id/location",
    {
      schema: {
        params: sessionParams,
        body: setLocationSchema,
        response: { 200: sessionSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const session = await prisma.session.findFirst({ where: { id, campaignId } });
      if (!session) {
        return reply.code(404).send({ message: "Session not found" });
      }
      const location = await prisma.location.findFirst({
        where: { id: request.body.locationId, campaignId },
      });
      if (!location) {
        return reply.code(404).send({ message: "Location not found" });
      }
      const updated = await prisma.session.update({
        where: { id },
        data: { currentLocationId: location.id },
      });
      await appendSessionEvent(id, campaignId, "LOCATION_CHANGED", {
        payload: { locationId: location.id, locationName: location.name },
      });
      return serializeSession(updated);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/sessions/:id/notes",
    {
      schema: {
        params: sessionParams,
        body: addGmNoteSchema,
        response: { 201: sessionEventSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const session = await prisma.session.findFirst({ where: { id, campaignId } });
      if (!session) {
        return reply.code(404).send({ message: "Session not found" });
      }
      const event = await appendSessionEvent(id, campaignId, "GM_NOTE", {
        payload: { note: request.body.note },
      });
      return reply.code(201).send(serializeSessionEvent(event));
    },
  );

  typed.get(
    "/api/campaigns/:campaignId/sessions/:id/events",
    {
      schema: {
        params: sessionParams,
        querystring: z.object({
          offset: z.coerce.number().int().min(0).default(0),
          limit: z.coerce.number().int().min(1).max(100).default(20),
          order: z.enum(["asc", "desc"]).default("asc"),
        }),
        response: {
          200: z.object({
            events: z.array(sessionEventSchema),
            total: z.number(),
            hasMore: z.boolean(),
          }),
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const { offset, limit, order } = request.query;
      const session = await prisma.session.findFirst({ where: { id, campaignId } });
      if (!session) {
        return reply.code(404).send({ message: "Session not found" });
      }
      const [events, total] = await Promise.all([
        prisma.sessionEvent.findMany({
          where: { sessionId: id },
          orderBy: { createdAt: order },
          skip: offset,
          take: limit,
        }),
        prisma.sessionEvent.count({ where: { sessionId: id } }),
      ]);
      return {
        events: events.map(serializeSessionEvent),
        total,
        hasMore: offset + limit < total,
      };
    },
  );
}
