import { z } from "zod";
import { idSchema, nullableImageUrl, timestampFields } from "./common.js";

export const pcCreateSchema = z.object({
  name: z.string().min(1).max(200),
  portraitImageUrl: nullableImageUrl,
  roleOrClass: z.string().max(200).default(""),
  background: z.string().max(5000).default(""),
  notes: z.string().max(5000).default(""),
  inventory: z.string().max(5000).default(""),
  level: z.number().int().min(1).default(1),
  xp: z.number().int().min(0).default(0),
});

export const pcUpdateSchema = pcCreateSchema.partial();

export const pcSchema = pcCreateSchema.extend({
  ...timestampFields,
  campaignId: idSchema,
});

export const awardXpSchema = z.object({
  amount: z.number().int(),
  level: z.number().int().min(1).optional(),
  note: z.string().max(500).optional(),
  sessionId: idSchema.optional(),
});

export type PCCreate = z.input<typeof pcCreateSchema>;
export type PCUpdate = z.input<typeof pcUpdateSchema>;
export type PC = z.infer<typeof pcSchema>;
export type AwardXp = z.input<typeof awardXpSchema>;
