import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { errorResponseSchema } from "../error-response.js";
import { prisma } from "../prisma.js";

interface TimestampedRecord {
  id: string;
  campaignId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CrudDelegate<TRecord extends TimestampedRecord> {
  findMany(args: { where: { campaignId: string } }): Promise<TRecord[]>;
  findFirst(args: { where: { id: string; campaignId: string } }): Promise<TRecord | null>;
  create(args: { data: Record<string, unknown> }): Promise<TRecord>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<TRecord>;
  delete(args: { where: { id: string } }): Promise<TRecord>;
}

export function serializeTimestamps<T extends TimestampedRecord>(record: T) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function registerNestedEntityRoutes<
  TRecord extends TimestampedRecord,
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
>(
  app: FastifyInstance,
  options: {
    prefix: string;
    delegate: CrudDelegate<TRecord>;
    createSchema: z.ZodType<TCreate>;
    updateSchema: z.ZodType<TUpdate>;
    readSchema: z.ZodType<unknown>;
    /** Optional pre-delete guard (e.g. "is this PC in an active battle?"). */
    beforeDelete?: (id: string, campaignId: string) => Promise<{ blocked: true; message: string } | { blocked: false }>;
    /** Optional pre-update guard (e.g. "would this create a location cycle?"). */
    beforeUpdate?: (
      id: string,
      campaignId: string,
      data: Record<string, unknown>,
    ) => Promise<{ blocked: true; message: string } | { blocked: false }>;
  },
) {
  const { prefix, delegate, createSchema, updateSchema, readSchema, beforeDelete, beforeUpdate } = options;
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const paramsSchema = z.object({ campaignId: z.string().uuid() });
  const itemParamsSchema = z.object({ campaignId: z.string().uuid(), id: z.string().uuid() });

  async function assertCampaignExists(campaignId: string) {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    return campaign !== null;
  }

  typed.get(
    `/api/campaigns/:campaignId/${prefix}`,
    {
      schema: {
        params: paramsSchema,
        response: { 200: z.array(readSchema), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId } = request.params;
      if (!(await assertCampaignExists(campaignId))) {
        return reply.code(404).send({ message: "Campaign not found" });
      }
      const records = await delegate.findMany({ where: { campaignId } });
      return records.map(serializeTimestamps);
    },
  );

  typed.post(
    `/api/campaigns/:campaignId/${prefix}`,
    {
      schema: {
        params: paramsSchema,
        body: createSchema,
        response: { 201: readSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId } = request.params;
      if (!(await assertCampaignExists(campaignId))) {
        return reply.code(404).send({ message: "Campaign not found" });
      }
      const record = await delegate.create({
        data: { ...(request.body as Record<string, unknown>), campaignId },
      });
      return reply.code(201).send(serializeTimestamps(record));
    },
  );

  typed.get(
    `/api/campaigns/:campaignId/${prefix}/:id`,
    {
      schema: {
        params: itemParamsSchema,
        response: { 200: readSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const record = await delegate.findFirst({ where: { id, campaignId } });
      if (!record) {
        return reply.code(404).send({ message: "Not found" });
      }
      return serializeTimestamps(record);
    },
  );

  typed.patch(
    `/api/campaigns/:campaignId/${prefix}/:id`,
    {
      schema: {
        params: itemParamsSchema,
        body: updateSchema,
        response: { 200: readSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const existing = await delegate.findFirst({ where: { id, campaignId } });
      if (!existing) {
        return reply.code(404).send({ message: "Not found" });
      }
      if (beforeUpdate) {
        const check = await beforeUpdate(id, campaignId, request.body as Record<string, unknown>);
        if (check.blocked) {
          return reply.code(409).send({ message: check.message });
        }
      }
      const record = await delegate.update({
        where: { id },
        data: request.body as Record<string, unknown>,
      });
      return serializeTimestamps(record);
    },
  );

  typed.delete(
    `/api/campaigns/:campaignId/${prefix}/:id`,
    {
      schema: {
        params: itemParamsSchema,
        response: { 204: z.null(), 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const existing = await delegate.findFirst({ where: { id, campaignId } });
      if (!existing) {
        return reply.code(404).send({ message: "Not found" });
      }
      if (beforeDelete) {
        const check = await beforeDelete(id, campaignId);
        if (check.blocked) {
          return reply.code(409).send({ message: check.message });
        }
      }
      await delegate.delete({ where: { id } });
      return reply.code(204).send(null);
    },
  );
}
