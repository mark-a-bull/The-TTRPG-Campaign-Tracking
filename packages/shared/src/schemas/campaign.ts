import { z } from "zod";
import { nullableImageUrl, timestampFields } from "./common.js";

export const campaignCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).default(""),
  coverImageUrl: nullableImageUrl,
});

export const campaignUpdateSchema = campaignCreateSchema.partial();

export const campaignSchema = campaignCreateSchema.extend(timestampFields);

// z.input (not z.infer/z.output) so fields with `.default()` are optional in
// the TS type, matching what a caller may omit before Zod fills the default.
export type CampaignCreate = z.input<typeof campaignCreateSchema>;
export type CampaignUpdate = z.input<typeof campaignUpdateSchema>;
export type Campaign = z.infer<typeof campaignSchema>;
