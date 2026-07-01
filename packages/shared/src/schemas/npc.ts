import { z } from "zod";
import { idSchema, nullableImageUrl, timestampFields } from "./common.js";

export const npcCreateSchema = z.object({
  name: z.string().min(1).max(200),
  portraitImageUrl: nullableImageUrl,
  role: z.string().max(200).default(""),
  description: z.string().max(5000).default(""),
  notes: z.string().max(5000).default(""),
});

export const npcUpdateSchema = npcCreateSchema.partial();

export const npcSchema = npcCreateSchema.extend({
  ...timestampFields,
  campaignId: idSchema,
});

export type NPCCreate = z.input<typeof npcCreateSchema>;
export type NPCUpdate = z.input<typeof npcUpdateSchema>;
export type NPC = z.infer<typeof npcSchema>;
