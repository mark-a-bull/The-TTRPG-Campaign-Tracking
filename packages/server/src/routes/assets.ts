import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { errorResponseSchema } from "../error-response.js";

export const ASSETS_DIR = path.resolve(process.cwd(), "../../data/assets");

function extensionFor(filename: string): string {
  const ext = path.extname(filename);
  return ext || "";
}

export function registerAssetRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/api/assets",
    { schema: { response: { 201: z.object({ url: z.string() }), 400: errorResponseSchema } } },
    async (request, reply) => {
      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ message: "No file uploaded" });
      }
      await mkdir(ASSETS_DIR, { recursive: true });
      const filename = `${randomUUID()}${extensionFor(file.filename)}`;
      const destPath = path.join(ASSETS_DIR, filename);
      await pipeline(file.file, createWriteStream(destPath));
      return reply.code(201).send({ url: `/assets/${filename}` });
    },
  );
}
