import { z } from "zod";
import { idSchema, nullableImageUrl, timestampFields } from "./common.js";

export const pcCreateSchema = z.object({
  name: z.string().min(1).max(200),
  portraitImageUrl: nullableImageUrl,
  roleOrClass: z.string().max(200).default(""),
  background: z.string().max(5000).default(""),
  notes: z.string().max(5000).default(""),
  inventory: z.string().max(5000).default(""),
});

export const pcUpdateSchema = pcCreateSchema.partial();

export const pcSchema = pcCreateSchema.extend({
  ...timestampFields,
  campaignId: idSchema,
});

export type PCCreate = z.input<typeof pcCreateSchema>;
export type PCUpdate = z.input<typeof pcUpdateSchema>;
export type PC = z.infer<typeof pcSchema>;
