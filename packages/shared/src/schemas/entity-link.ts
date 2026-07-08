import { z } from "zod";
import { entityTypes } from "../entities.js";
import { idSchema } from "./common.js";

export const linkVisibilitySchema = z.enum(["hidden", "revealed"]);
const linkEntityTypeSchema = z.enum(entityTypes);

export const entityLinkCreateSchema = z
  .object({
    fromType: linkEntityTypeSchema,
    fromId: idSchema,
    toType: linkEntityTypeSchema,
    toId: idSchema,
    label: z.string().min(1).max(200),
    reverseLabel: z.string().max(200).nullable().default(null),
    directional: z.boolean().default(false),
    visibility: linkVisibilitySchema.default("revealed"),
    notes: z.string().max(2000).default(""),
  })
  .refine((data) => !(data.fromType === data.toType && data.fromId === data.toId), {
    message: "An entity can't be linked to itself",
    path: ["toId"],
  });

export const entityLinkUpdateSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  reverseLabel: z.string().max(200).nullable().optional(),
  directional: z.boolean().optional(),
  visibility: linkVisibilitySchema.optional(),
  notes: z.string().max(2000).optional(),
});

export const entityLinkSchema = z.object({
  id: idSchema,
  campaignId: idSchema,
  fromType: linkEntityTypeSchema,
  fromId: idSchema,
  toType: linkEntityTypeSchema,
  toId: idSchema,
  label: z.string(),
  reverseLabel: z.string().nullable(),
  directional: z.boolean(),
  visibility: linkVisibilitySchema,
  notes: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type LinkVisibility = z.infer<typeof linkVisibilitySchema>;
export type EntityLinkCreate = z.input<typeof entityLinkCreateSchema>;
export type EntityLinkUpdate = z.input<typeof entityLinkUpdateSchema>;
export type EntityLink = z.infer<typeof entityLinkSchema>;
