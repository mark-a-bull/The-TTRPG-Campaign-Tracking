import type { ActorType, SessionEventType } from "@ttrpg/shared";
import { prisma } from "./prisma.js";

interface AppendSessionEventArgs {
  actorType?: ActorType | null;
  actorId?: string | null;
  targetType?: ActorType | null;
  targetId?: string | null;
  payload?: Record<string, unknown>;
}

export function appendSessionEvent(
  sessionId: string,
  campaignId: string,
  type: SessionEventType,
  args: AppendSessionEventArgs = {},
) {
  return prisma.sessionEvent.create({
    data: {
      sessionId,
      campaignId,
      type,
      actorType: args.actorType ?? null,
      actorId: args.actorId ?? null,
      targetType: args.targetType ?? null,
      targetId: args.targetId ?? null,
      payload: JSON.stringify(args.payload ?? {}),
    },
  });
}

interface SessionEventRecord {
  id: string;
  sessionId: string;
  campaignId: string;
  type: string;
  actorType: string | null;
  actorId: string | null;
  targetType: string | null;
  targetId: string | null;
  payload: string;
  createdAt: Date;
}

// Prisma types `type`/`actorType`/`targetType` as plain `string` (SQLite has no
// native enum); these casts narrow to the literal unions the Zod response
// schema expects. Runtime values are always one of the literals since they're
// only ever written via appendSessionEvent's typed `type` parameter.
export function serializeSessionEvent(event: SessionEventRecord) {
  return {
    ...event,
    type: event.type as SessionEventType,
    actorType: event.actorType as ActorType | null,
    targetType: event.targetType as ActorType | null,
    payload: JSON.parse(event.payload) as Record<string, unknown>,
    createdAt: event.createdAt.toISOString(),
  };
}
