import type { FastifyInstance } from "fastify";
import { locationCreateSchema, locationSchema, locationUpdateSchema } from "@ttrpg/shared";
import { prisma } from "../prisma.js";
import { registerNestedEntityRoutes } from "./nested-entity.js";

export function registerLocationRoutes(app: FastifyInstance) {
  registerNestedEntityRoutes(app, {
    prefix: "locations",
    delegate: prisma.location,
    createSchema: locationCreateSchema,
    updateSchema: locationUpdateSchema,
    readSchema: locationSchema,
  });
}
