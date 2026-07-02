import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  addCombatantSchema,
  battleActionSchema,
  battleDetailSchema,
  battleSchema,
  type ActorType,
  type BattleStatus,
} from "@ttrpg/shared";
import { errorResponseSchema } from "../error-response.js";
import { prisma } from "../prisma.js";
import { appendSessionEvent } from "../session-events.js";

// A switch (rather than dynamically indexing a { pc, npc, monster } record of
// delegates) because TS can't call through a union of Prisma delegate types
// with differing generic signatures.
function findActorInCampaign(actorType: ActorType, actorId: string, campaignId: string) {
  switch (actorType) {
    case "pc":
      return prisma.pc.findFirst({ where: { id: actorId, campaignId } });
    case "npc":
      return prisma.npc.findFirst({ where: { id: actorId, campaignId } });
    case "monster":
      return prisma.monster.findFirst({ where: { id: actorId, campaignId } });
  }
}

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

async function entryDisplayName(
  entry: { actorType: string | null; actorId: string | null; adHocName: string | null },
  campaignId: string,
): Promise<string> {
  if (entry.adHocName) {
    return entry.adHocName;
  }
  if (entry.actorType && entry.actorId) {
    const actor = await findActorInCampaign(entry.actorType as ActorType, entry.actorId, campaignId);
    if (actor) {
      return actor.name;
    }
  }
  return "Unknown combatant";
}

// Prisma types these columns as plain `string` (SQLite has no native enum);
// casts narrow to the literal unions the Zod response schemas expect. Runtime
// values are always one of the literals since they're only ever written that way.
function serializeBattle<
  T extends { status: string; createdAt: Date; updatedAt: Date },
>(battle: T) {
  return {
    ...battle,
    status: battle.status as BattleStatus,
    createdAt: battle.createdAt.toISOString(),
    updatedAt: battle.updatedAt.toISOString(),
  };
}

interface StatusEffectRecord {
  id: string;
  initiativeEntryId: string;
  sourceEntryId: string | null;
  label: string;
  note: string;
  appliedAtTurn: number;
  expired: boolean;
  createdAt: Date;
}

function serializeStatusEffect(status: StatusEffectRecord) {
  return { ...status, createdAt: status.createdAt.toISOString() };
}

interface InitiativeEntryRecord {
  id: string;
  battleEncounterId: string;
  actorType: string | null;
  actorId: string | null;
  adHocName: string | null;
  initiative: number;
  currentHp: number | null;
  maxHp: number | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  statuses: StatusEffectRecord[];
}

function serializeInitiativeEntry(entry: InitiativeEntryRecord) {
  return {
    ...entry,
    actorType: entry.actorType as ActorType | null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    statuses: entry.statuses.map(serializeStatusEffect),
  };
}

async function loadBattleDetail(battleId: string) {
  const battle = await prisma.battleEncounter.findUniqueOrThrow({ where: { id: battleId } });
  const entries = await prisma.initiativeEntry.findMany({
    where: { battleEncounterId: battleId },
    orderBy: { order: "asc" },
    include: { statuses: true },
  });
  return { ...serializeBattle(battle), entries: entries.map(serializeInitiativeEntry) };
}

function entryActorRef(entry: { actorType: string | null; actorId: string | null }) {
  return {
    actorType: entry.actorType as ActorType | null,
    actorId: entry.actorId,
  };
}

export function registerBattleRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const sessionParams = z.object({ campaignId: z.string().uuid(), sessionId: z.string().uuid() });
  const battleParams = sessionParams.extend({ battleId: z.string().uuid() });
  const entryParams = battleParams.extend({ entryId: z.string().uuid() });

  async function assertSession(campaignId: string, sessionId: string) {
    return prisma.session.findFirst({ where: { id: sessionId, campaignId } });
  }

  async function assertBattle(sessionId: string, battleId: string) {
    return prisma.battleEncounter.findFirst({ where: { id: battleId, sessionId } });
  }

  typed.get(
    "/api/campaigns/:campaignId/sessions/:sessionId/battles",
    { schema: { params: sessionParams, response: { 200: z.array(battleSchema), 404: errorResponseSchema } } },
    async (request, reply) => {
      const { campaignId, sessionId } = request.params;
      if (!(await assertSession(campaignId, sessionId))) {
        return reply.code(404).send({ message: "Session not found" });
      }
      const battles = await prisma.battleEncounter.findMany({
        where: { sessionId },
        orderBy: { createdAt: "desc" },
      });
      return battles.map(serializeBattle);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/sessions/:sessionId/battles",
    { schema: { params: sessionParams, response: { 201: battleSchema, 404: errorResponseSchema } } },
    async (request, reply) => {
      const { campaignId, sessionId } = request.params;
      if (!(await assertSession(campaignId, sessionId))) {
        return reply.code(404).send({ message: "Session not found" });
      }
      const battle = await prisma.battleEncounter.create({ data: { sessionId, campaignId } });
      return reply.code(201).send(serializeBattle(battle));
    },
  );

  typed.get(
    "/api/campaigns/:campaignId/sessions/:sessionId/battles/:battleId",
    { schema: { params: battleParams, response: { 200: battleDetailSchema, 404: errorResponseSchema } } },
    async (request, reply) => {
      const { sessionId, battleId } = request.params;
      if (!(await assertBattle(sessionId, battleId))) {
        return reply.code(404).send({ message: "Battle not found" });
      }
      return loadBattleDetail(battleId);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/sessions/:sessionId/battles/:battleId/entries",
    {
      schema: {
        params: battleParams,
        body: addCombatantSchema,
        response: { 201: battleDetailSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { campaignId, sessionId, battleId } = request.params;
      const battle = await assertBattle(sessionId, battleId);
      if (!battle) {
        return reply.code(404).send({ message: "Battle not found" });
      }
      if (battle.status !== "building") {
        return reply.code(409).send({ message: "Combatants can only be added while building" });
      }

      const body = request.body;
      if (body.kind === "entity") {
        const actor = await findActorInCampaign(body.actorType, body.actorId, campaignId);
        if (!actor) {
          return reply.code(404).send({ message: `${body.actorType} not found in this campaign` });
        }
      }

      const entryCount = await prisma.initiativeEntry.count({ where: { battleEncounterId: battleId } });
      await prisma.initiativeEntry.create({
        data: {
          battleEncounterId: battleId,
          actorType: body.kind === "entity" ? body.actorType : null,
          actorId: body.kind === "entity" ? body.actorId : null,
          adHocName: body.kind === "adHoc" ? body.adHocName : null,
          initiative: body.initiative ?? 0,
          maxHp: body.maxHp ?? null,
          currentHp: body.maxHp ?? null,
          order: entryCount,
        },
      });
      return reply.code(201).send(await loadBattleDetail(battleId));
    },
  );

  typed.delete(
    "/api/campaigns/:campaignId/sessions/:sessionId/battles/:battleId/entries/:entryId",
    {
      schema: {
        params: entryParams,
        response: { 200: battleDetailSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { sessionId, battleId, entryId } = request.params;
      const battle = await assertBattle(sessionId, battleId);
      if (!battle) {
        return reply.code(404).send({ message: "Battle not found" });
      }
      if (battle.status !== "building") {
        return reply.code(409).send({ message: "Combatants can only be removed while building" });
      }
      const entry = await prisma.initiativeEntry.findFirst({ where: { id: entryId, battleEncounterId: battleId } });
      if (!entry) {
        return reply.code(404).send({ message: "Entry not found" });
      }
      await prisma.initiativeEntry.delete({ where: { id: entryId } });
      return loadBattleDetail(battleId);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/sessions/:sessionId/battles/:battleId/roll-npc-initiative",
    {
      schema: {
        params: battleParams,
        response: { 200: battleDetailSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { sessionId, battleId } = request.params;
      const battle = await assertBattle(sessionId, battleId);
      if (!battle) {
        return reply.code(404).send({ message: "Battle not found" });
      }
      if (battle.status !== "building") {
        return reply.code(409).send({ message: "Initiative can only be auto-rolled while building" });
      }
      const entries = await prisma.initiativeEntry.findMany({ where: { battleEncounterId: battleId } });
      await Promise.all(
        entries
          .filter((entry) => entry.actorType === "npc" || entry.actorType === "monster" || entry.adHocName)
          .map((entry) => prisma.initiativeEntry.update({ where: { id: entry.id }, data: { initiative: rollD20() } })),
      );
      return loadBattleDetail(battleId);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/sessions/:sessionId/battles/:battleId/start",
    {
      schema: {
        params: battleParams,
        response: { 200: battleDetailSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { sessionId, battleId } = request.params;
      const battle = await assertBattle(sessionId, battleId);
      if (!battle) {
        return reply.code(404).send({ message: "Battle not found" });
      }
      if (battle.status !== "building") {
        return reply.code(409).send({ message: "Battle has already started" });
      }
      const entries = await prisma.initiativeEntry.findMany({
        where: { battleEncounterId: battleId },
        orderBy: { initiative: "desc" },
      });
      if (entries.length === 0) {
        return reply.code(409).send({ message: "Add at least one combatant before starting" });
      }
      await Promise.all(
        entries.map((entry, index) =>
          prisma.initiativeEntry.update({ where: { id: entry.id }, data: { order: index } }),
        ),
      );
      await prisma.battleEncounter.update({
        where: { id: battleId },
        data: { status: "active", currentTurnIndex: 0 },
      });
      await appendSessionEvent(sessionId, battle.campaignId, "BATTLE_STARTED", {
        payload: { battleId, combatantCount: entries.length },
      });
      return loadBattleDetail(battleId);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/sessions/:sessionId/battles/:battleId/advance-turn",
    {
      schema: {
        params: battleParams,
        response: { 200: battleDetailSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { sessionId, battleId } = request.params;
      const battle = await assertBattle(sessionId, battleId);
      if (!battle) {
        return reply.code(404).send({ message: "Battle not found" });
      }
      if (battle.status !== "active") {
        return reply.code(409).send({ message: "Battle is not active" });
      }
      const entries = await prisma.initiativeEntry.findMany({
        where: { battleEncounterId: battleId },
        orderBy: { order: "asc" },
      });
      const nextIndex = (battle.currentTurnIndex + 1) % entries.length;
      await prisma.battleEncounter.update({ where: { id: battleId }, data: { currentTurnIndex: nextIndex } });
      const nextEntry = entries[nextIndex];
      await appendSessionEvent(sessionId, battle.campaignId, "TURN_ADVANCED", {
        ...entryActorRef(nextEntry),
        payload: { turnIndex: nextIndex, targetName: await entryDisplayName(nextEntry, battle.campaignId) },
      });
      return loadBattleDetail(battleId);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/sessions/:sessionId/battles/:battleId/entries/:entryId/actions",
    {
      schema: {
        params: entryParams,
        body: battleActionSchema,
        response: { 200: battleDetailSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { sessionId, battleId, entryId } = request.params;
      const battle = await assertBattle(sessionId, battleId);
      if (!battle) {
        return reply.code(404).send({ message: "Battle not found" });
      }
      if (battle.status !== "active") {
        return reply.code(409).send({ message: "Battle is not active" });
      }
      const entry = await prisma.initiativeEntry.findFirst({ where: { id: entryId, battleEncounterId: battleId } });
      if (!entry) {
        return reply.code(404).send({ message: "Entry not found" });
      }

      const action = request.body;
      const target = entryActorRef(entry);
      const targetName = await entryDisplayName(entry, battle.campaignId);

      if (action.type === "damage") {
        if (entry.currentHp !== null) {
          await prisma.initiativeEntry.update({
            where: { id: entryId },
            data: { currentHp: Math.max(0, entry.currentHp - action.amount) },
          });
        }
        await appendSessionEvent(sessionId, battle.campaignId, "DAMAGE_APPLIED", {
          ...target,
          payload: { amount: action.amount, targetName },
        });
      } else if (action.type === "heal") {
        if (entry.currentHp !== null) {
          const healed = entry.currentHp + action.amount;
          await prisma.initiativeEntry.update({
            where: { id: entryId },
            data: { currentHp: entry.maxHp !== null ? Math.min(entry.maxHp, healed) : healed },
          });
        }
        await appendSessionEvent(sessionId, battle.campaignId, "HEALING_APPLIED", {
          ...target,
          payload: { amount: action.amount, targetName },
        });
      } else if (action.type === "status-apply") {
        if (action.sourceEntryId) {
          const sourceEntry = await prisma.initiativeEntry.findFirst({
            where: { id: action.sourceEntryId, battleEncounterId: battleId },
          });
          if (!sourceEntry) {
            return reply.code(404).send({ message: "Source entry not found in this battle" });
          }
        }
        await prisma.statusEffectInstance.create({
          data: {
            initiativeEntryId: entryId,
            sourceEntryId: action.sourceEntryId ?? null,
            label: action.label,
            note: action.note,
            appliedAtTurn: battle.currentTurnIndex,
          },
        });
        await appendSessionEvent(sessionId, battle.campaignId, "STATUS_APPLIED", {
          ...target,
          payload: { label: action.label, note: action.note, targetName },
        });
      } else if (action.type === "status-expire") {
        const status = await prisma.statusEffectInstance.findFirst({
          where: { id: action.statusId, initiativeEntryId: entryId },
        });
        if (!status) {
          return reply.code(404).send({ message: "Status effect not found" });
        }
        await prisma.statusEffectInstance.update({ where: { id: status.id }, data: { expired: true } });
        await appendSessionEvent(sessionId, battle.campaignId, "STATUS_EXPIRED", {
          ...target,
          payload: { label: status.label, targetName },
        });
      } else {
        await appendSessionEvent(sessionId, battle.campaignId, "KO", {
          ...target,
          payload: { targetName },
        });
      }

      return loadBattleDetail(battleId);
    },
  );

  typed.post(
    "/api/campaigns/:campaignId/sessions/:sessionId/battles/:battleId/resolve",
    {
      schema: {
        params: battleParams,
        response: { 200: battleDetailSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { sessionId, battleId } = request.params;
      const battle = await assertBattle(sessionId, battleId);
      if (!battle) {
        return reply.code(404).send({ message: "Battle not found" });
      }
      if (battle.status !== "active") {
        return reply.code(409).send({ message: "Battle is not active" });
      }
      await prisma.battleEncounter.update({ where: { id: battleId }, data: { status: "resolved" } });
      await appendSessionEvent(sessionId, battle.campaignId, "BATTLE_ENDED", { payload: { battleId } });
      return loadBattleDetail(battleId);
    },
  );
}
