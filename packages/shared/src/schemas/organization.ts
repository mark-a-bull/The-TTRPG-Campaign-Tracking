import { z } from "zod";
import { idSchema, nullableImageUrl, timestampFields } from "./common.js";

export const organizationCreateSchema = z.object({
  name: z.string().min(1).max(200),
  imageUrl: nullableImageUrl,
  description: z.string().max(5000).default(""),
  notes: z.string().max(5000).default(""),
});

export const organizationUpdateSchema = organizationCreateSchema.partial();

export const organizationSchema = organizationCreateSchema.extend({
  ...timestampFields,
  campaignId: idSchema,
});

export type OrganizationCreate = z.input<typeof organizationCreateSchema>;
export type OrganizationUpdate = z.input<typeof organizationUpdateSchema>;
export type Organization = z.infer<typeof organizationSchema>;
