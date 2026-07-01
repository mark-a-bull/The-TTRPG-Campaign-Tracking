import type { FastifyInstance } from "fastify";
import { mysteryCreateSchema, mysterySchema, mysteryUpdateSchema } from "@ttrpg/shared";
import { prisma } from "../prisma.js";
import { registerNestedEntityRoutes } from "./nested-entity.js";

export function registerMysteryRoutes(app: FastifyInstance) {
  registerNestedEntityRoutes(app, {
    prefix: "mysteries",
    delegate: prisma.mystery,
    createSchema: mysteryCreateSchema,
    updateSchema: mysteryUpdateSchema,
    readSchema: mysterySchema,
  });
}
