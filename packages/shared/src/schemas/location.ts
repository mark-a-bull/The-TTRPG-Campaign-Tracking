import { z } from "zod";
import { idSchema, nullableImageUrl, timestampFields } from "./common.js";

export const locationCreateSchema = z.object({
  parentLocationId: idSchema.nullable().default(null),
  name: z.string().min(1).max(200),
  imageUrl: nullableImageUrl,
  description: z.string().max(5000).default(""),
  notes: z.string().max(5000).default(""),
});

export const locationUpdateSchema = locationCreateSchema.partial();

export const locationSchema = locationCreateSchema.extend({
  ...timestampFields,
  campaignId: idSchema,
});

export type LocationCreate = z.input<typeof locationCreateSchema>;
export type LocationUpdate = z.input<typeof locationUpdateSchema>;
export type Location = z.infer<typeof locationSchema>;
