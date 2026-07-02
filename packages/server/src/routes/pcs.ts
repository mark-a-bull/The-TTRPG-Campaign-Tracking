import type { FastifyInstance } from "fastify";
import { pcCreateSchema, pcSchema, pcUpdateSchema } from "@ttrpg/shared";
import { assertNotInActiveBattle } from "../battle-guards.js";
import { prisma } from "../prisma.js";
import { registerNestedEntityRoutes } from "./nested-entity.js";

export function registerPcRoutes(app: FastifyInstance) {
  registerNestedEntityRoutes(app, {
    prefix: "pcs",
    delegate: prisma.pc,
    createSchema: pcCreateSchema,
    updateSchema: pcUpdateSchema,
    readSchema: pcSchema,
    beforeDelete: (id) => assertNotInActiveBattle("pc", id),
  });
}
