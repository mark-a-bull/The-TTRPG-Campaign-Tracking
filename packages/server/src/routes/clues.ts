import type { FastifyInstance } from "fastify";
import { clueCreateSchema, clueSchema, clueUpdateSchema } from "@ttrpg/shared";
import { prisma } from "../prisma.js";
import { registerNestedEntityRoutes } from "./nested-entity.js";

export function registerClueRoutes(app: FastifyInstance) {
  registerNestedEntityRoutes(app, {
    prefix: "clues",
    delegate: prisma.clue,
    createSchema: clueCreateSchema,
    updateSchema: clueUpdateSchema,
    readSchema: clueSchema,
  });
}
