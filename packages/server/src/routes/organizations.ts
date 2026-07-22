import type { FastifyInstance } from "fastify";
import { organizationCreateSchema, organizationSchema, organizationUpdateSchema } from "@ttrpg/shared";
import { prisma } from "../prisma.js";
import { registerNestedEntityRoutes } from "./nested-entity.js";

export function registerOrganizationRoutes(app: FastifyInstance) {
  registerNestedEntityRoutes(app, {
    prefix: "organizations",
    delegate: prisma.organization,
    createSchema: organizationCreateSchema,
    updateSchema: organizationUpdateSchema,
    readSchema: organizationSchema,
  });
}
