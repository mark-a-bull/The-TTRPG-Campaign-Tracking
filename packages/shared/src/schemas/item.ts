import { z } from "zod";
import { idSchema, nullableImageUrl, timestampFields } from "./common.js";

// A separate, narrower union from ActorType (pc|npc|monster, used for battle
// actors/session actor fields) since an Item's owner can also be a Location,
// which would be semantically wrong to add to the combat-scoped ActorType.
export const itemOwnerTypeSchema = z.enum(["pc", "npc", "monster", "location"]);

export const itemCreateSchema = z.object({
  ownerType: itemOwnerTypeSchema,
  ownerId: idSchema,
  name: z.string().min(1).max(200),
  imageUrl: nullableImageUrl,
  description: z.string().max(5000).default(""),
  notes: z.string().max(5000).default(""),
  quantity: z.number().int().min(1).default(1),
});

export const itemUpdateSchema = itemCreateSchema.partial();

export const itemSchema = itemCreateSchema.extend({
  ...timestampFields,
  campaignId: idSchema,
  hidden: z.boolean(),
});

export const transferItemSchema = z.object({
  ownerType: itemOwnerTypeSchema,
  ownerId: idSchema,
});

export type ItemOwnerType = z.infer<typeof itemOwnerTypeSchema>;
export type ItemCreate = z.input<typeof itemCreateSchema>;
export type ItemUpdate = z.input<typeof itemUpdateSchema>;
export type Item = z.infer<typeof itemSchema>;
export type TransferItem = z.input<typeof transferItemSchema>;
