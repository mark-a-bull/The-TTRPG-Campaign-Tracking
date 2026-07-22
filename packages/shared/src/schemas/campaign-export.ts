import { z } from "zod";
import { battleDetailSchema } from "./battle.js";
import { campaignSchema } from "./campaign.js";
import { clueSchema } from "./clue.js";
import { entityLinkSchema } from "./entity-link.js";
import { locationSchema } from "./location.js";
import { monsterSchema } from "./monster.js";
import { mysterySchema } from "./mystery.js";
import { npcSchema } from "./npc.js";
import { organizationSchema } from "./organization.js";
import { pcSchema } from "./pc.js";
import { sessionEventSchema, sessionSchema } from "./session.js";

export const sessionEventExportSchema = sessionEventSchema.omit({ sessionId: true, campaignId: true });

export const battleExportSchema = battleDetailSchema.omit({ sessionId: true, campaignId: true });

export const sessionExportSchema = sessionSchema.omit({ campaignId: true }).extend({
  events: z.array(sessionEventExportSchema),
  battles: z.array(battleExportSchema),
});

export const campaignExportSchema = z.object({
  formatVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  campaign: campaignSchema,
  pcs: z.array(pcSchema.omit({ campaignId: true })),
  npcs: z.array(npcSchema.omit({ campaignId: true })),
  monsters: z.array(monsterSchema.omit({ campaignId: true })),
  locations: z.array(locationSchema.omit({ campaignId: true })),
  mysteries: z.array(mysterySchema.omit({ campaignId: true })),
  clues: z.array(clueSchema.omit({ campaignId: true })),
  organizations: z.array(organizationSchema.omit({ campaignId: true })),
  sessions: z.array(sessionExportSchema),
  entityLinks: z.array(entityLinkSchema.omit({ campaignId: true })),
});

export type SessionEventExport = z.infer<typeof sessionEventExportSchema>;
export type BattleExport = z.infer<typeof battleExportSchema>;
export type SessionExport = z.infer<typeof sessionExportSchema>;
export type CampaignExport = z.infer<typeof campaignExportSchema>;
