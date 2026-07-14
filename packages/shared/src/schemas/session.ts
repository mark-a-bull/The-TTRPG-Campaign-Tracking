import { z } from "zod";
import { idSchema } from "./common.js";

export const sessionStatusSchema = z.enum(["active", "ended"]);

export const actorTypeSchema = z.enum(["pc", "npc", "monster"]);

export const sessionEventTypeSchema = z.enum([
  "SESSION_STARTED",
  "SESSION_ENDED",
  "LOCATION_CHANGED",
  "GM_NOTE",
  "BATTLE_STARTED",
  "BATTLE_ENDED",
  "TURN_ADVANCED",
  "DAMAGE_APPLIED",
  "HEALING_APPLIED",
  "STATUS_APPLIED",
  "STATUS_EXPIRED",
  "KO",
  "CLUE_REVEALED",
  "CLUE_HIDDEN",
  "XP_AWARDED",
]);

export const sessionCreateSchema = z.object({
  title: z.string().max(200).default(""),
});

export const sessionSchema = z.object({
  id: idSchema,
  campaignId: idSchema,
  title: z.string(),
  status: sessionStatusSchema,
  currentLocationId: idSchema.nullable(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const setLocationSchema = z.object({
  locationId: idSchema,
});

export const addGmNoteSchema = z.object({
  note: z.string().min(1).max(2000),
});

export const sessionEventSchema = z.object({
  id: idSchema,
  sessionId: idSchema,
  campaignId: idSchema,
  type: sessionEventTypeSchema,
  actorType: actorTypeSchema.nullable(),
  actorId: idSchema.nullable(),
  targetType: actorTypeSchema.nullable(),
  targetId: idSchema.nullable(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});

export const paginatedSessionEventsSchema = z.object({
  events: z.array(sessionEventSchema),
  total: z.number(),
  hasMore: z.boolean(),
});

export type SessionStatus = z.infer<typeof sessionStatusSchema>;
export type ActorType = z.infer<typeof actorTypeSchema>;
export type SessionEventType = z.infer<typeof sessionEventTypeSchema>;
export type SessionCreate = z.input<typeof sessionCreateSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SetLocation = z.input<typeof setLocationSchema>;
export type AddGmNote = z.input<typeof addGmNoteSchema>;
export type SessionEvent = z.infer<typeof sessionEventSchema>;
export type PaginatedSessionEvents = z.infer<typeof paginatedSessionEventsSchema>;
