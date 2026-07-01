import type { FastifyInstance } from "fastify";
import { monsterCreateSchema, monsterSchema, monsterUpdateSchema } from "@ttrpg/shared";
import { prisma } from "../prisma.js";
import { registerNestedEntityRoutes } from "./nested-entity.js";

export function registerMonsterRoutes(app: FastifyInstance) {
  registerNestedEntityRoutes(app, {
    prefix: "monsters",
    delegate: prisma.monster,
    createSchema: monsterCreateSchema,
    updateSchema: monsterUpdateSchema,
    readSchema: monsterSchema,
  });
}
