import { z } from "zod";
import { idSchema, timestampFields } from "./common.js";

export const clueVisibilitySchema = z.enum(["hidden", "revealed"]);

export const clueCreateSchema = z.object({
  mysteryId: idSchema.nullable().default(null),
  title: z.string().min(1).max(200),
  content: z.string().max(5000).default(""),
  gmNotes: z.string().max(5000).default(""),
  visibility: clueVisibilitySchema.default("hidden"),
  /** Empty array means "not scoped" — once revealed, visible to the whole party. */
  visibleTo: z.array(idSchema).default([]),
});

export const clueUpdateSchema = clueCreateSchema.partial();

export const clueSchema = clueCreateSchema.extend({
  ...timestampFields,
  campaignId: idSchema,
  // Redeclared without `.default()`: zod-to-json-schema drops array-typed
  // fields with a non-primitive default from the generated response schema,
  // which fast-json-stringify then silently omits from the serialized output.
  // Read responses always supply this field explicitly, so no default is needed.
  visibleTo: z.array(idSchema),
});

export const revealClueSchema = z.object({
  visibleTo: z.array(idSchema).optional(),
});

export type ClueVisibility = z.infer<typeof clueVisibilitySchema>;
export type ClueCreate = z.input<typeof clueCreateSchema>;
export type ClueUpdate = z.input<typeof clueUpdateSchema>;
export type Clue = z.infer<typeof clueSchema>;
export type RevealClue = z.input<typeof revealClueSchema>;
