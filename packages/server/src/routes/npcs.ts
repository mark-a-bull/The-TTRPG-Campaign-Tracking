import type { FastifyInstance } from "fastify";
import { npcCreateSchema, npcSchema, npcUpdateSchema } from "@ttrpg/shared";
import { assertNotInActiveBattle } from "../battle-guards.js";
import { prisma } from "../prisma.js";
import { registerNestedEntityRoutes } from "./nested-entity.js";

export function registerNpcRoutes(app: FastifyInstance) {
  registerNestedEntityRoutes(app, {
    prefix: "npcs",
    delegate: prisma.npc,
    createSchema: npcCreateSchema,
    updateSchema: npcUpdateSchema,
    readSchema: npcSchema,
    beforeDelete: (id) => assertNotInActiveBattle("npc", id),
  });
}
