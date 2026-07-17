import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  addGmNoteSchema,
  sessionCreateSchema,
  sessionEventSchema,
  sessionSchema,
  sessionSummarySchema,
  setLocationSchema,
  type SessionStatus,
} from "@ttrpg/shared";
import { errorResponseSchema } from "../error-response.js";
import { prisma } from "../prisma.js";
import { appendSessionEvent, serializeSessionEvent } from "../session-events.js";

/** Builds "Sunken Keep > Basement > Treasury" for a location, walking up
 * through parentLocationId. History log events snapshot this full breadcrumb
 * at logging time (not just the leaf name) since event payloads are already
 * point-in-time snapshots, same as everywhere else in the history log. */
async function buildLocationBreadcrumb(campaignId: string, locationId: string): Promise<string> {
  const locations = await prisma.location.findMany({
    where: { campaignId },
    select: { id: true, name: true, parentLocationId: true },
  });
  const byId = new Map(locations.map((location) => [location.id, location]));
  const names: string[] = [];
  let currentId: string | null = locationId;
  while (currentId) {
    const current = byId.get(currentId);
    if (!current) break;
    names.unshift(current.name);
    currentId = current.parentLocationId;
  }
  return names.join(" > ");
}

// `status` is a plain `string` in Prisma (SQLite has no native enum); the cast
// narrows to the literal union the Zod response schema expects. Runtime values
// are always one of the literals since they're only ever written as literals.
export function serializeSession<
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

// Aggregates the full event log for a session into a structured recap. This
// intentionally bypasses the paginated /events route (offset/limit, max 100)
// since a summary needs the whole log, not a page of it. Payload field names
// mirror packages/web/src/screens/HistoryLog.tsx's describeEvent, which reads
// the same event types.
async function buildSessionSummary(session: { id: string; title: string; startedAt: Date; endedAt: Date | null }) {
  const events = await prisma.sessionEvent.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
  });

  const locationsVisited: string[] = [];
  const gmNotes: string[] = [];
  const cluesRevealed: string[] = [];
  const cluesHidden: string[] = [];
  const knockouts: string[] = [];
  const xpAwards: { pcName: string; amount: number }[] = [];
  const levelChanges: { pcName: string; newLevel: number }[] = [];
  let battlesFought = 0;
  let totalDamage = 0;
  let totalHealing = 0;

  for (const event of events) {
    const payload = JSON.parse(event.payload) as Record<string, unknown>;
    switch (event.type) {
      case "LOCATION_CHANGED":
        if (
          typeof payload.locationName === "string" &&
          locationsVisited[locationsVisited.length - 1] !== payload.locationName
        ) {
          locationsVisited.push(payload.locationName);
        }
        break;
      case "GM_NOTE":
        if (typeof payload.note === "string") gmNotes.push(payload.note);
        break;
      case "CLUE_REVEALED":
        if (typeof payload.clueTitle === "string") cluesRevealed.push(payload.clueTitle);
        break;
      case "CLUE_HIDDEN":
        if (typeof payload.clueTitle === "string") cluesHidden.push(payload.clueTitle);
        break;
      case "BATTLE_STARTED":
        battlesFought += 1;
        break;
      case "DAMAGE_APPLIED":
        if (payload.applied !== false && typeof payload.amount === "number") totalDamage += payload.amount;
        break;
      case "HEALING_APPLIED":
        if (payload.applied !== false && typeof payload.amount === "number") totalHealing += payload.amount;
        break;
      case "KO":
        if (typeof payload.targetName === "string") knockouts.push(payload.targetName);
        break;
      case "XP_AWARDED":
      case "END_OF_SESSION_XP_AWARDED":
        if (typeof payload.pcName === "string" && typeof payload.amount === "number") {
          xpAwards.push({ pcName: payload.pcName, amount: payload.amount });
        }
        if (typeof payload.pcName === "string" && typeof payload.newLevel === "number") {
          levelChanges.push({ pcName: payload.pcName, newLevel: payload.newLevel });
        }
        break;
      case "END_OF_SESSION_LEVEL_AWARDED":
        if (typeof payload.pcName === "string" && typeof payload.newLevel === "number") {
          levelChanges.push({ pcName: payload.pcName, newLevel: payload.newLevel });
        }
        break;
    }
  }

  return {
    sessionId: session.id,
    title: session.title,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
    eventCount: events.length,
    locationsVisited,
    gmNotes,
    cluesRevealed,
    cluesHidden,
    battlesFought,
    totalDamage,
    totalHealing,
    knockouts,
    xpAwards,
    totalXpAwarded: xpAwards.reduce((sum, award) => sum + award.amount, 0),
    levelChanges,
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
      const breadcrumb = await buildLocationBreadcrumb(campaignId, location.id);
      await appendSessionEvent(id, campaignId, "LOCATION_CHANGED", {
        payload: { locationId: location.id, locationName: breadcrumb },
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

  typed.get(
    "/api/campaigns/:campaignId/sessions/:id/summary",
    {
      schema: {
        params: sessionParams,
        response: { 200: sessionSummarySchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const session = await prisma.session.findFirst({ where: { id, campaignId } });
      if (!session) {
        return reply.code(404).send({ message: "Session not found" });
      }
      return buildSessionSummary(session);
    },
  );
}
