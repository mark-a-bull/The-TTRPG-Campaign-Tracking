import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  inventoryVisibilitySchema,
  itemCreateSchema,
  itemOwnerTypeSchema,
  itemSchema,
  setInventoryVisibilitySchema,
  transferItemSchema,
  type ItemOwnerType,
} from "@ttrpg/shared";
import { errorResponseSchema } from "../error-response.js";
import { prisma } from "../prisma.js";
import { appendSessionEvent } from "../session-events.js";

interface ItemRecord {
  id: string;
  campaignId: string;
  ownerType: string;
  ownerId: string;
  name: string;
  imageUrl: string | null;
  description: string;
  notes: string;
  quantity: number;
  hidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// `ownerType` is a plain `string` in Prisma (SQLite has no native enum); the
// cast narrows to the literal union the Zod response schema expects, same
// approach as serializeClue/serializeSession.
function serializeItem(item: ItemRecord) {
  return {
    ...item,
    ownerType: item.ownerType as ItemOwnerType,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

// A dedicated 4-case (pc|npc|monster|location) lookup, distinct from both
// entity-lookup.ts's findEntityInCampaign (7-type, plural-keyed EntityType --
// too broad, no "location"-shaped singular key) and battle-guards.ts's
// battle-actor helpers (3-type ActorType, no "location" at all).
async function findOwnerInCampaign(ownerType: ItemOwnerType, ownerId: string, campaignId: string) {
  switch (ownerType) {
    case "pc":
      return prisma.pc.findFirst({ where: { id: ownerId, campaignId } });
    case "npc":
      return prisma.npc.findFirst({ where: { id: ownerId, campaignId } });
    case "monster":
      return prisma.monster.findFirst({ where: { id: ownerId, campaignId } });
    case "location":
      return prisma.location.findFirst({ where: { id: ownerId, campaignId } });
  }
}

async function ownerName(ownerType: ItemOwnerType, ownerId: string): Promise<string> {
  switch (ownerType) {
    case "pc":
      return (await prisma.pc.findUnique({ where: { id: ownerId } }))?.name ?? "Unknown";
    case "npc":
      return (await prisma.npc.findUnique({ where: { id: ownerId } }))?.name ?? "Unknown";
    case "monster":
      return (await prisma.monster.findUnique({ where: { id: ownerId } }))?.name ?? "Unknown";
    case "location":
      return (await prisma.location.findUnique({ where: { id: ownerId } }))?.name ?? "Unknown";
  }
}

export function registerItemRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const campaignParams = z.object({ campaignId: z.string().uuid() });
  const itemParams = z.object({ campaignId: z.string().uuid(), id: z.string().uuid() });
  const listQuery = z.object({ ownerType: itemOwnerTypeSchema.optional(), ownerId: z.string().uuid().optional() });
  const ownerQuery = z.object({ ownerType: itemOwnerTypeSchema, ownerId: z.string().uuid() });

  async function assertCampaignExists(campaignId: string) {
    return (await prisma.campaign.findUnique({ where: { id: campaignId } })) !== null;
  }

  async function findActiveSession(campaignId: string) {
    return prisma.session.findFirst({ where: { campaignId, status: "active" } });
  }

  typed.get(
    "/api/campaigns/:campaignId/items",
    {
      schema: {
        params: campaignParams,
        querystring: listQuery,
        response: { 200: z.array(itemSchema), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId } = request.params;
      if (!(await assertCampaignExists(campaignId))) {
        return reply.code(404).send({ message: "Campaign not found" });
      }
      const { ownerType, ownerId } = request.query;
      const items = await prisma.item.findMany({
        where: { campaignId, ...(ownerType && ownerId ? { ownerType, ownerId } : {}) },
      });
      return items.map(serializeItem);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/items",
    {
      schema: {
        params: campaignParams,
        body: itemCreateSchema,
        response: { 201: itemSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId } = request.params;
      if (!(await assertCampaignExists(campaignId))) {
        return reply.code(404).send({ message: "Campaign not found" });
      }
      const owner = await findOwnerInCampaign(request.body.ownerType, request.body.ownerId, campaignId);
      if (!owner) {
        return reply.code(404).send({ message: "Owner not found in this campaign" });
      }
      const item = await prisma.item.create({ data: { ...request.body, campaignId } });
      return reply.code(201).send(serializeItem(item));
    },
  );

  typed.get(
    "/api/campaigns/:campaignId/items/:id",
    { schema: { params: itemParams, response: { 200: itemSchema, 404: errorResponseSchema } } },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const item = await prisma.item.findFirst({ where: { id, campaignId } });
      if (!item) {
        return reply.code(404).send({ message: "Not found" });
      }
      return serializeItem(item);
    },
  );

  // Excludes ownerType/ownerId/hidden -- moving or revealing/hiding an item
  // goes through the dedicated actions below, never a silent field edit.
  const itemPatchSchema = itemCreateSchema
    .omit({ ownerType: true, ownerId: true })
    .partial();

  typed.patch(
    "/api/campaigns/:campaignId/items/:id",
    {
      schema: {
        params: itemParams,
        body: itemPatchSchema,
        response: { 200: itemSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const existing = await prisma.item.findFirst({ where: { id, campaignId } });
      if (!existing) {
        return reply.code(404).send({ message: "Not found" });
      }
      const item = await prisma.item.update({ where: { id }, data: request.body });
      return serializeItem(item);
    },
  );

  typed.delete(
    "/api/campaigns/:campaignId/items/:id",
    { schema: { params: itemParams, response: { 204: z.null(), 404: errorResponseSchema } } },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const existing = await prisma.item.findFirst({ where: { id, campaignId } });
      if (!existing) {
        return reply.code(404).send({ message: "Not found" });
      }
      await prisma.item.delete({ where: { id } });
      return reply.code(204).send(null);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/items/:id/transfer",
    {
      schema: {
        params: itemParams,
        body: transferItemSchema,
        response: { 200: itemSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const item = await prisma.item.findFirst({ where: { id, campaignId } });
      if (!item) {
        return reply.code(404).send({ message: "Not found" });
      }
      const { ownerType: toOwnerType, ownerId: toOwnerId } = request.body;
      const newOwner = await findOwnerInCampaign(toOwnerType, toOwnerId, campaignId);
      if (!newOwner) {
        return reply.code(404).send({ message: "Owner not found in this campaign" });
      }
      const activeSession = await findActiveSession(campaignId);
      if (!activeSession) {
        return reply.code(409).send({ message: "No active session — start a session to transfer items" });
      }
      const [fromOwnerName, toOwnerName] = await Promise.all([
        ownerName(item.ownerType as ItemOwnerType, item.ownerId),
        ownerName(toOwnerType, toOwnerId),
      ]);
      const updated = await prisma.item.update({
        where: { id },
        data: { ownerType: toOwnerType, ownerId: toOwnerId },
      });
      await appendSessionEvent(activeSession.id, campaignId, "ITEM_TRANSFERRED", {
        payload: {
          itemId: item.id,
          itemName: item.name,
          fromOwnerType: item.ownerType,
          fromOwnerId: item.ownerId,
          fromOwnerName,
          toOwnerType,
          toOwnerId,
          toOwnerName,
        },
      });
      return serializeItem(updated);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/items/:id/reveal",
    {
      schema: { params: itemParams, response: { 200: itemSchema, 404: errorResponseSchema, 409: errorResponseSchema } },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const item = await prisma.item.findFirst({ where: { id, campaignId } });
      if (!item) {
        return reply.code(404).send({ message: "Not found" });
      }
      if (!item.hidden) {
        return reply.code(409).send({ message: "Item is already revealed" });
      }
      const activeSession = await findActiveSession(campaignId);
      if (!activeSession) {
        return reply.code(409).send({ message: "No active session — start a session to reveal items to players" });
      }
      const updated = await prisma.item.update({ where: { id }, data: { hidden: false } });
      await appendSessionEvent(activeSession.id, campaignId, "ITEM_REVEALED", {
        payload: { itemId: item.id, itemName: item.name, ownerType: item.ownerType, ownerId: item.ownerId },
      });
      return serializeItem(updated);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/items/:id/hide",
    {
      schema: { params: itemParams, response: { 200: itemSchema, 404: errorResponseSchema, 409: errorResponseSchema } },
    },
    async (request, reply) => {
      const { campaignId, id } = request.params;
      const item = await prisma.item.findFirst({ where: { id, campaignId } });
      if (!item) {
        return reply.code(404).send({ message: "Not found" });
      }
      if (item.hidden) {
        return reply.code(409).send({ message: "Item is already hidden" });
      }
      const activeSession = await findActiveSession(campaignId);
      if (!activeSession) {
        return reply.code(409).send({ message: "No active session — start a session to hide items from players" });
      }
      const updated = await prisma.item.update({ where: { id }, data: { hidden: true } });
      await appendSessionEvent(activeSession.id, campaignId, "ITEM_HIDDEN", {
        payload: { itemId: item.id, itemName: item.name, ownerType: item.ownerType, ownerId: item.ownerId },
      });
      return serializeItem(updated);
    },
  );

  typed.get(
    "/api/campaigns/:campaignId/inventory-visibility",
    {
      schema: {
        params: campaignParams,
        querystring: ownerQuery,
        response: { 200: inventoryVisibilitySchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId } = request.params;
      if (!(await assertCampaignExists(campaignId))) {
        return reply.code(404).send({ message: "Campaign not found" });
      }
      const { ownerType, ownerId } = request.query;
      const row = await prisma.inventoryVisibility.findUnique({
        where: { campaignId_ownerType_ownerId: { campaignId, ownerType, ownerId } },
      });
      return { ownerType, ownerId, hidden: row?.hidden ?? false };
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/inventory-visibility/reveal",
    {
      schema: {
        params: campaignParams,
        body: setInventoryVisibilitySchema,
        response: { 200: inventoryVisibilitySchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId } = request.params;
      const { ownerType, ownerId } = request.body;
      const owner = await findOwnerInCampaign(ownerType, ownerId, campaignId);
      if (!owner) {
        return reply.code(404).send({ message: "Owner not found in this campaign" });
      }
      const activeSession = await findActiveSession(campaignId);
      if (!activeSession) {
        return reply.code(409).send({ message: "No active session — start a session to reveal an inventory to players" });
      }
      await prisma.inventoryVisibility.upsert({
        where: { campaignId_ownerType_ownerId: { campaignId, ownerType, ownerId } },
        create: { campaignId, ownerType, ownerId, hidden: false },
        update: { hidden: false },
      });
      await appendSessionEvent(activeSession.id, campaignId, "INVENTORY_REVEALED", {
        payload: { ownerType, ownerId, ownerName: await ownerName(ownerType, ownerId) },
      });
      return { ownerType, ownerId, hidden: false };
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/inventory-visibility/hide",
    {
      schema: {
        params: campaignParams,
        body: setInventoryVisibilitySchema,
        response: { 200: inventoryVisibilitySchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId } = request.params;
      const { ownerType, ownerId } = request.body;
      const owner = await findOwnerInCampaign(ownerType, ownerId, campaignId);
      if (!owner) {
        return reply.code(404).send({ message: "Owner not found in this campaign" });
      }
      const activeSession = await findActiveSession(campaignId);
      if (!activeSession) {
        return reply.code(409).send({ message: "No active session — start a session to hide an inventory from players" });
      }
      await prisma.inventoryVisibility.upsert({
        where: { campaignId_ownerType_ownerId: { campaignId, ownerType, ownerId } },
        create: { campaignId, ownerType, ownerId, hidden: true },
        update: { hidden: true },
      });
      await appendSessionEvent(activeSession.id, campaignId, "INVENTORY_HIDDEN", {
        payload: { ownerType, ownerId, ownerName: await ownerName(ownerType, ownerId) },
      });
      return { ownerType, ownerId, hidden: true };
    },
  );
}
