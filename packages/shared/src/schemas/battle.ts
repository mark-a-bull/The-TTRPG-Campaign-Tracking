import { z } from "zod";
import { actorTypeSchema } from "./session.js";
import { idSchema } from "./common.js";

export const battleStatusSchema = z.enum(["building", "active", "resolved"]);

export const battleSchema = z.object({
  id: idSchema,
  sessionId: idSchema,
  campaignId: idSchema,
  status: battleStatusSchema,
  currentTurnIndex: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const statusEffectInstanceSchema = z.object({
  id: idSchema,
  initiativeEntryId: idSchema,
  sourceEntryId: idSchema.nullable(),
  label: z.string(),
  note: z.string(),
  appliedAtTurn: z.number().int(),
  expired: z.boolean(),
  createdAt: z.string().datetime(),
});

export const initiativeEntrySchema = z.object({
  id: idSchema,
  battleEncounterId: idSchema,
  actorType: actorTypeSchema.nullable(),
  actorId: idSchema.nullable(),
  adHocName: z.string().nullable(),
  initiative: z.number().int(),
  currentHp: z.number().int().nullable(),
  maxHp: z.number().int().nullable(),
  order: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  statuses: z.array(statusEffectInstanceSchema),
});

export const battleDetailSchema = battleSchema.extend({
  entries: z.array(initiativeEntrySchema),
});

export const addCombatantSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("entity"),
    actorType: actorTypeSchema,
    actorId: idSchema,
    initiative: z.number().int().min(0).optional(),
    maxHp: z.number().int().min(0).optional(),
  }),
  z.object({
    kind: z.literal("adHoc"),
    adHocName: z.string().min(1).max(200),
    initiative: z.number().int().min(0).optional(),
    maxHp: z.number().int().min(0).optional(),
  }),
]);

export const battleActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("damage"), amount: z.number().int().min(1) }),
  z.object({ type: z.literal("heal"), amount: z.number().int().min(1) }),
  z.object({
    type: z.literal("status-apply"),
    label: z.string().min(1).max(200),
    note: z.string().max(2000).default(""),
    sourceEntryId: idSchema.optional(),
  }),
  z.object({ type: z.literal("status-expire"), statusId: idSchema }),
  z.object({ type: z.literal("ko") }),
]);

export type BattleStatus = z.infer<typeof battleStatusSchema>;
export type Battle = z.infer<typeof battleSchema>;
export type BattleDetail = z.infer<typeof battleDetailSchema>;
export type InitiativeEntry = z.infer<typeof initiativeEntrySchema>;
export type StatusEffectInstance = z.infer<typeof statusEffectInstanceSchema>;
export type AddCombatant = z.input<typeof addCombatantSchema>;
export type BattleAction = z.input<typeof battleActionSchema>;
