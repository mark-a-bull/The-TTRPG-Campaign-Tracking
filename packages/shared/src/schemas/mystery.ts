import { z } from "zod";
import { idSchema, timestampFields } from "./common.js";

export const mysteryStatusSchema = z.enum(["active", "resolved", "abandoned"]);

export const mysteryCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).default(""),
  status: mysteryStatusSchema.default("active"),
  notes: z.string().max(5000).default(""),
});

export const mysteryUpdateSchema = mysteryCreateSchema.partial();

export const mysterySchema = mysteryCreateSchema.extend({
  ...timestampFields,
  campaignId: idSchema,
});

export type MysteryStatus = z.infer<typeof mysteryStatusSchema>;
export type MysteryCreate = z.input<typeof mysteryCreateSchema>;
export type MysteryUpdate = z.input<typeof mysteryUpdateSchema>;
export type Mystery = z.infer<typeof mysterySchema>;
