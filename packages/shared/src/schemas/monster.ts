import { z } from "zod";
import { idSchema, nullableImageUrl, timestampFields } from "./common.js";

export const monsterCreateSchema = z.object({
  name: z.string().min(1).max(200),
  portraitImageUrl: nullableImageUrl,
  description: z.string().max(5000).default(""),
  behaviors: z.string().max(5000).default(""),
  notes: z.string().max(5000).default(""),
});

export const monsterUpdateSchema = monsterCreateSchema.partial();

export const monsterSchema = monsterCreateSchema.extend({
  ...timestampFields,
  campaignId: idSchema,
});

export type MonsterCreate = z.input<typeof monsterCreateSchema>;
export type MonsterUpdate = z.input<typeof monsterUpdateSchema>;
export type Monster = z.infer<typeof monsterSchema>;
