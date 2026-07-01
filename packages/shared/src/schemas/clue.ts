import { z } from "zod";
import { idSchema, timestampFields } from "./common.js";

export const clueVisibilitySchema = z.enum(["hidden", "revealed"]);

export const clueCreateSchema = z.object({
  mysteryId: idSchema.nullable().default(null),
  title: z.string().min(1).max(200),
  content: z.string().max(5000).default(""),
  gmNotes: z.string().max(5000).default(""),
  visibility: clueVisibilitySchema.default("hidden"),
});

export const clueUpdateSchema = clueCreateSchema.partial();

export const clueSchema = clueCreateSchema.extend({
  ...timestampFields,
  campaignId: idSchema,
});

export type ClueVisibility = z.infer<typeof clueVisibilitySchema>;
export type ClueCreate = z.input<typeof clueCreateSchema>;
export type ClueUpdate = z.input<typeof clueUpdateSchema>;
export type Clue = z.infer<typeof clueSchema>;
