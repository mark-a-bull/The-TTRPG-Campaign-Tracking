import type { FastifyInstance } from "fastify";
import { locationCreateSchema, locationSchema, locationUpdateSchema } from "@ttrpg/shared";
import { prisma } from "../prisma.js";
import { registerNestedEntityRoutes } from "./nested-entity.js";

/** Rejects setting a location's parent to itself or to one of its own
 * descendants -- walks up the ancestor chain from the proposed new parent;
 * if `id` is ever encountered, the change would create a cycle. This single
 * walk also catches the direct self-parent case (the walk's first step is
 * the proposed parent itself). */
async function beforeUpdate(id: string, campaignId: string, data: Record<string, unknown>) {
  if (data.parentLocationId === undefined || data.parentLocationId === null) {
    return { blocked: false as const };
  }
  let currentId: string | null = data.parentLocationId as string;
  while (currentId) {
    if (currentId === id) {
      return { blocked: true as const, message: "Would create a location cycle" };
    }
    const current: { parentLocationId: string | null } | null = await prisma.location.findFirst({
      where: { id: currentId, campaignId },
      select: { parentLocationId: true },
    });
    currentId = current?.parentLocationId ?? null;
  }
  return { blocked: false as const };
}

export function registerLocationRoutes(app: FastifyInstance) {
  registerNestedEntityRoutes(app, {
    prefix: "locations",
    delegate: prisma.location,
    createSchema: locationCreateSchema,
    updateSchema: locationUpdateSchema,
    readSchema: locationSchema,
    beforeUpdate,
  });
}
