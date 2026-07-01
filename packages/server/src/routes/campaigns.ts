import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { campaignCreateSchema, campaignSchema, campaignUpdateSchema } from "@ttrpg/shared";
import { errorResponseSchema } from "../error-response.js";
import { prisma } from "../prisma.js";

function serializeTimestamps<T extends { createdAt: Date; updatedAt: Date }>(record: T) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function registerCampaignRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const idParams = z.object({ id: z.string().uuid() });

  typed.get(
    "/api/campaigns",
    { schema: { response: { 200: z.array(campaignSchema) } } },
    async () => {
      const campaigns = await prisma.campaign.findMany({ orderBy: { updatedAt: "desc" } });
      return campaigns.map(serializeTimestamps);
    },
  );

  typed.post(
    "/api/campaigns",
    { schema: { body: campaignCreateSchema, response: { 201: campaignSchema } } },
    async (request, reply) => {
      const campaign = await prisma.campaign.create({ data: request.body });
      return reply.code(201).send(serializeTimestamps(campaign));
    },
  );

  typed.get(
    "/api/campaigns/:id",
    { schema: { params: idParams, response: { 200: campaignSchema, 404: errorResponseSchema } } },
    async (request, reply) => {
      const campaign = await prisma.campaign.findUnique({ where: { id: request.params.id } });
      if (!campaign) {
        return reply.code(404).send({ message: "Campaign not found" });
      }
      return serializeTimestamps(campaign);
    },
  );

  typed.patch(
    "/api/campaigns/:id",
    {
      schema: {
        params: idParams,
        body: campaignUpdateSchema,
        response: { 200: campaignSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const existing = await prisma.campaign.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.code(404).send({ message: "Campaign not found" });
      }
      const campaign = await prisma.campaign.update({
        where: { id: request.params.id },
        data: request.body,
      });
      return serializeTimestamps(campaign);
    },
  );

  typed.delete(
    "/api/campaigns/:id",
    { schema: { params: idParams, response: { 204: z.null(), 404: errorResponseSchema } } },
    async (request, reply) => {
      const existing = await prisma.campaign.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.code(404).send({ message: "Campaign not found" });
      }
      await prisma.campaign.delete({ where: { id: request.params.id } });
      return reply.code(204).send(null);
    },
  );
}
