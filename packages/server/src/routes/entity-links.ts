import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  entityLinkCreateSchema,
  entityLinkSchema,
  entityLinkUpdateSchema,
  entityTypes,
  type EntityType,
  type LinkVisibility,
} from "@ttrpg/shared";
import { errorResponseSchema } from "../error-response.js";
import { findEntityInCampaign } from "../entity-lookup.js";
import { prisma } from "../prisma.js";

const linkEntityTypeSchema = z.enum(entityTypes);

// Prisma types these columns as plain `string` (SQLite has no native enum);
// the cast narrows to the literal unions the Zod response schema expects.
// Runtime values are always one of the literals since they're only ever
// written through the typed create/update paths below.
function serializeLink<
  T extends { fromType: string; toType: string; visibility: string; createdAt: Date; updatedAt: Date },
>(link: T) {
  return {
    ...link,
    fromType: link.fromType as EntityType,
    toType: link.toType as EntityType,
    visibility: link.visibility as LinkVisibility,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  };
}

export function registerEntityLinkRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const campaignParams = z.object({ campaignId: z.string().uuid() });
  const itemParams = campaignParams.extend({ id: z.string().uuid() });
  const listQuery = z.object({
    entityType: linkEntityTypeSchema.optional(),
    entityId: z.string().uuid().optional(),
  });

  async function assertCampaignExists(campaignId: string) {
    return (await prisma.campaign.findUnique({ where: { id: campaignId } })) !== null;
  }

  typed.get(
    "/api/campaigns/:campaignId/links",
    {
      schema: {
        params: campaignParams,
        querystring: listQuery,
        response: { 200: z.array(entityLinkSchema), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId } = request.params;
      if (!(await assertCampaignExists(campaignId))) {
        return reply.code(404).send({ message: "Campaign not found" });
      }
      const { entityType, entityId } = request.query;
      const links = await prisma.entityLink.findMany({
        where: {
          campaignId,
          ...(entityType && entityId
            ? {
                OR: [
                  { fromType: entityType, fromId: entityId },
                  { toType: entityType, toId: entityId },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "asc" },
      });
      return links.map(serializeLink);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/links",
    {
      schema: {
        params: campaignParams,
        body: entityLinkCreateSchema,
        response: { 201: entityLinkSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId } = request.params;
      if (!(await assertCampaignExists(campaignId))) {
        return reply.code(404).send({ message: "Campaign not found" });
      }
      const body = request.body;
      const fromEntity = await findEntityInCampaign(body.fromType, body.fromId, campaignId);
      if (!fromEntity) {
        return reply.code(404).send({ message: `${body.fromType} not found in this campaign` });
      }
      const toEntity = await findEntityInCampaign(body.toType, body.toId, campaignId);
      if (!toEntity) {
        return reply.code(404).send({ message: `${body.toType} not found in this campaign` });
      }
      const link = await prisma.entityLink.create({ data: { ...body, campaignId } });
      return reply.code(201).send(serializeLink(link));
    },
  );

  typed.patch(
    "/api/campaigns/:campaignId/links/:id",
    {
      schema: {
        params: itemParams,
        body: entityLinkUpdateSchema,
        response: { 200: entityLinkSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const existing = await prisma.entityLink.findFirst({ where: { id, campaignId } });
      if (!existing) {
        return reply.code(404).send({ message: "Link not found" });
      }
      const link = await prisma.entityLink.update({ where: { id }, data: request.body });
      return serializeLink(link);
    },
  );

  typed.delete(
    "/api/campaigns/:campaignId/links/:id",
    {
      schema: {
        params: itemParams,
        response: { 204: z.null(), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const existing = await prisma.entityLink.findFirst({ where: { id, campaignId } });
      if (!existing) {
        return reply.code(404).send({ message: "Link not found" });
      }
      await prisma.entityLink.delete({ where: { id } });
      return reply.code(204).send(null);
    },
  );
}
