import { z } from "zod";

export const idSchema = z.string().uuid();

export const timestampFields = {
  id: idSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};

export const nullableImageUrl = z.string().url().nullable().default(null);
