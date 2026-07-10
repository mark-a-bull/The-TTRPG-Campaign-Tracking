import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { clueCreateSchema, clueSchema, clueUpdateSchema, revealClueSchema, type ClueVisibility } from "@ttrpg/shared";
import { errorResponseSchema } from "../error-response.js";
import { prisma } from "../prisma.js";
import { appendSessionEvent } from "../session-events.js";

interface ClueRecord {
  id: string;
  campaignId: string;
  mysteryId: string | null;
  title: string;
  content: string;
  gmNotes: string;
  visibility: string;
  visibleTo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// `visibility` is a plain `string` in Prisma (SQLite has no native enum); the
// cast narrows to the literal union the Zod response schema expects, same
// approach as serializeSession/serializeSessionEvent. `visibleTo` is stored as
// a JSON-encoded array of PC ids (empty/null both mean "not scoped" — whole
// party) since Prisma has no array column type on SQLite. Always serialized
// back out as `[]` rather than `null`: a nullable array in the response
// schema compiles to a JSON-schema `anyOf` that fast-json-stringify silently
// drops the field for, so the DB-level null is normalized away here.
function serializeClue(clue: ClueRecord) {
  return {
    ...clue,
    visibility: clue.visibility as ClueVisibility,
    visibleTo: clue.visibleTo ? (JSON.parse(clue.visibleTo) as string[]) : [],
    createdAt: clue.createdAt.toISOString(),
    updatedAt: clue.updatedAt.toISOString(),
  };
}

function toPrismaData(body: Record<string, unknown>) {
  if (!("visibleTo" in body)) return body;
  const { visibleTo, ...rest } = body;
  return { ...rest, visibleTo: visibleTo === undefined ? null : JSON.stringify(visibleTo) };
}

export function registerClueRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const campaignParams = z.object({ campaignId: z.string().uuid() });
  const clueParams = z.object({ campaignId: z.string().uuid(), id: z.string().uuid() });

  async function assertCampaignExists(campaignId: string) {
    return (await prisma.campaign.findUnique({ where: { id: campaignId } })) !== null;
  }

  typed.get(
    "/api/campaigns/:campaignId/clues",
    {
      schema: { params: campaignParams, response: { 200: z.array(clueSchema), 404: errorResponseSchema } },
    },
    async (request, reply) => {
      const { campaignId } = request.params;
      if (!(await assertCampaignExists(campaignId))) {
        return reply.code(404).send({ message: "Campaign not found" });
      }
      const clues = await prisma.clue.findMany({ where: { campaignId } });
      return clues.map(serializeClue);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/clues",
    {
      schema: { params: campaignParams, body: clueCreateSchema, response: { 201: clueSchema, 404: errorResponseSchema } },
    },
    async (request, reply) => {
      const { campaignId } = request.params;
      if (!(await assertCampaignExists(campaignId))) {
        return reply.code(404).send({ message: "Campaign not found" });
      }
      const clue = await prisma.clue.create({
        data: toPrismaData({ ...request.body, campaignId }),
      });
      return reply.code(201).send(serializeClue(clue));
    },
  );

  typed.get(
    "/api/campaigns/:campaignId/clues/:id",
    {
      schema: { params: clueParams, response: { 200: clueSchema, 404: errorResponseSchema } },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const clue = await prisma.clue.findFirst({ where: { id, campaignId } });
      if (!clue) {
        return reply.code(404).send({ message: "Not found" });
      }
      return serializeClue(clue);
    },
  );

  typed.patch(
    "/api/campaigns/:campaignId/clues/:id",
    {
      schema: { params: clueParams, body: clueUpdateSchema, response: { 200: clueSchema, 404: errorResponseSchema } },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const existing = await prisma.clue.findFirst({ where: { id, campaignId } });
      if (!existing) {
        return reply.code(404).send({ message: "Not found" });
      }
      const clue = await prisma.clue.update({ where: { id }, data: toPrismaData(request.body) });
      return serializeClue(clue);
    },
  );

  typed.delete(
    "/api/campaigns/:campaignId/clues/:id",
    {
      schema: { params: clueParams, response: { 204: z.null(), 404: errorResponseSchema } },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const existing = await prisma.clue.findFirst({ where: { id, campaignId } });
      if (!existing) {
        return reply.code(404).send({ message: "Not found" });
      }
      await prisma.clue.delete({ where: { id } });
      return reply.code(204).send(null);
    },
  );

  async function findActiveSession(campaignId: string) {
    return prisma.session.findFirst({ where: { campaignId, status: "active" } });
  }

  typed.post(
    "/api/campaigns/:campaignId/clues/:id/reveal",
    {
      schema: {
        params: clueParams,
        body: revealClueSchema.nullish(),
        response: { 200: clueSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const clue = await prisma.clue.findFirst({ where: { id, campaignId } });
      if (!clue) {
        return reply.code(404).send({ message: "Not found" });
      }
      if (clue.visibility === "revealed") {
        return reply.code(409).send({ message: "Clue is already revealed" });
      }
      const activeSession = await findActiveSession(campaignId);
      if (!activeSession) {
        return reply.code(409).send({ message: "No active session — start a session to reveal clues to players" });
      }
      const visibleTo = request.body?.visibleTo ?? [];
      const updated = await prisma.clue.update({
        where: { id },
        data: { visibility: "revealed", visibleTo: JSON.stringify(visibleTo) },
      });
      await appendSessionEvent(activeSession.id, campaignId, "CLUE_REVEALED", {
        payload: { clueId: clue.id, clueTitle: clue.title, mysteryId: clue.mysteryId, visibleTo },
      });
      return serializeClue(updated);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/clues/:id/hide",
    {
      schema: {
        params: clueParams,
        response: { 200: clueSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const clue = await prisma.clue.findFirst({ where: { id, campaignId } });
      if (!clue) {
        return reply.code(404).send({ message: "Not found" });
      }
      if (clue.visibility === "hidden") {
        return reply.code(409).send({ message: "Clue is already hidden" });
      }
      const activeSession = await findActiveSession(campaignId);
      if (!activeSession) {
        return reply.code(409).send({ message: "No active session — start a session to hide clues from players" });
      }
      const updated = await prisma.clue.update({
        where: { id },
        data: { visibility: "hidden", visibleTo: JSON.stringify([]) },
      });
      await appendSessionEvent(activeSession.id, campaignId, "CLUE_HIDDEN", {
        payload: { clueId: clue.id, clueTitle: clue.title, mysteryId: clue.mysteryId },
      });
      return serializeClue(updated);
    },
  );
}
