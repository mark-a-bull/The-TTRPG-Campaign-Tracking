import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { playerCreateSchema, playerSchema, playerUpdateSchema } from "@ttrpg/shared";
import { errorResponseSchema } from "../error-response.js";
import { prisma } from "../prisma.js";

function serializeTimestamps<T extends { createdAt: Date; updatedAt: Date }>(record: T) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function registerPlayerRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const idParams = z.object({ id: z.string().uuid() });

  typed.get(
    "/api/players",
    { schema: { response: { 200: z.array(playerSchema) } } },
    async () => {
      const players = await prisma.player.findMany({ orderBy: { name: "asc" } });
      return players.map(serializeTimestamps);
    },
  );

  typed.post(
    "/api/players",
    { schema: { body: playerCreateSchema, response: { 201: playerSchema } } },
    async (request, reply) => {
      const player = await prisma.player.create({ data: request.body });
      return reply.code(201).send(serializeTimestamps(player));
    },
  );

  typed.get(
    "/api/players/:id",
    { schema: { params: idParams, response: { 200: playerSchema, 404: errorResponseSchema } } },
    async (request, reply) => {
      const player = await prisma.player.findUnique({ where: { id: request.params.id } });
      if (!player) {
        return reply.code(404).send({ message: "Player not found" });
      }
      return serializeTimestamps(player);
    },
  );

  typed.patch(
    "/api/players/:id",
    {
      schema: {
        params: idParams,
        body: playerUpdateSchema,
        response: { 200: playerSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const existing = await prisma.player.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.code(404).send({ message: "Player not found" });
      }
      const player = await prisma.player.update({
        where: { id: request.params.id },
        data: request.body,
      });
      return serializeTimestamps(player);
    },
  );

  typed.delete(
    "/api/players/:id",
    { schema: { params: idParams, response: { 204: z.null(), 404: errorResponseSchema } } },
    async (request, reply) => {
      const existing = await prisma.player.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.code(404).send({ message: "Player not found" });
      }
      await prisma.player.delete({ where: { id: request.params.id } });
      return reply.code(204).send(null);
    },
  );
}
