import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import JSZip from "jszip";
import { z } from "zod";
import {
  campaignExportSchema,
  campaignSchema,
  type ActorType,
  type BattleExport,
  type CampaignExport,
  type EntityType,
  type SessionExport,
} from "@ttrpg/shared";
import { errorResponseSchema } from "../error-response.js";
import { prisma } from "../prisma.js";
import { ASSETS_DIR } from "./assets.js";

// ---------- export ----------

async function buildCampaignExport(campaignId: string): Promise<CampaignExport | null> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return null;

  const [pcs, npcs, monsters, locations, mysteries, clues, sessions, entityLinks] = await Promise.all([
    prisma.pc.findMany({ where: { campaignId } }),
    prisma.npc.findMany({ where: { campaignId } }),
    prisma.monster.findMany({ where: { campaignId } }),
    prisma.location.findMany({ where: { campaignId } }),
    prisma.mystery.findMany({ where: { campaignId } }),
    prisma.clue.findMany({ where: { campaignId } }),
    prisma.session.findMany({
      where: { campaignId },
      orderBy: { startedAt: "asc" },
      include: {
        events: { orderBy: { createdAt: "asc" } },
        battles: {
          orderBy: { createdAt: "asc" },
          include: { entries: { orderBy: { order: "asc" }, include: { statuses: true } } },
        },
      },
    }),
    prisma.entityLink.findMany({ where: { campaignId } }),
  ]);

  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    campaign: {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      coverImageUrl: campaign.coverImageUrl,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    },
    pcs: pcs.map((pc) => ({
      ...pc,
      createdAt: pc.createdAt.toISOString(),
      updatedAt: pc.updatedAt.toISOString(),
    })),
    npcs: npcs.map((npc) => ({
      ...npc,
      createdAt: npc.createdAt.toISOString(),
      updatedAt: npc.updatedAt.toISOString(),
    })),
    monsters: monsters.map((monster) => ({
      ...monster,
      createdAt: monster.createdAt.toISOString(),
      updatedAt: monster.updatedAt.toISOString(),
    })),
    locations: locations.map((location) => ({
      ...location,
      createdAt: location.createdAt.toISOString(),
      updatedAt: location.updatedAt.toISOString(),
    })),
    mysteries: mysteries.map((mystery) => ({
      ...mystery,
      status: mystery.status as CampaignExport["mysteries"][number]["status"],
      createdAt: mystery.createdAt.toISOString(),
      updatedAt: mystery.updatedAt.toISOString(),
    })),
    clues: clues.map((clue) => ({
      ...clue,
      visibility: clue.visibility as CampaignExport["clues"][number]["visibility"],
      visibleTo: clue.visibleTo ? (JSON.parse(clue.visibleTo) as string[]) : [],
      createdAt: clue.createdAt.toISOString(),
      updatedAt: clue.updatedAt.toISOString(),
    })),
    sessions: sessions.map((session) => ({
      id: session.id,
      title: session.title,
      status: session.status as SessionExport["status"],
      currentLocationId: session.currentLocationId,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt ? session.endedAt.toISOString() : null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      events: session.events.map((event) => ({
        id: event.id,
        type: event.type as SessionExport["events"][number]["type"],
        actorType: event.actorType as ActorType | null,
        actorId: event.actorId,
        targetType: event.targetType as ActorType | null,
        targetId: event.targetId,
        payload: JSON.parse(event.payload) as Record<string, unknown>,
        createdAt: event.createdAt.toISOString(),
      })),
      battles: session.battles.map((battle) => ({
        id: battle.id,
        status: battle.status as BattleExport["status"],
        currentTurnIndex: battle.currentTurnIndex,
        createdAt: battle.createdAt.toISOString(),
        updatedAt: battle.updatedAt.toISOString(),
        entries: battle.entries.map((entry) => ({
          id: entry.id,
          battleEncounterId: entry.battleEncounterId,
          actorType: entry.actorType as ActorType | null,
          actorId: entry.actorId,
          adHocName: entry.adHocName,
          initiative: entry.initiative,
          currentHp: entry.currentHp,
          maxHp: entry.maxHp,
          order: entry.order,
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString(),
          statuses: entry.statuses.map((status) => ({
            id: status.id,
            initiativeEntryId: status.initiativeEntryId,
            sourceEntryId: status.sourceEntryId,
            label: status.label,
            note: status.note,
            appliedAtTurn: status.appliedAtTurn,
            expired: status.expired,
            createdAt: status.createdAt.toISOString(),
          })),
        })),
      })),
    })),
    entityLinks: entityLinks.map((link) => ({
      ...link,
      fromType: link.fromType as EntityType,
      toType: link.toType as EntityType,
      visibility: link.visibility as CampaignExport["entityLinks"][number]["visibility"],
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
    })),
  };
}

function collectAssetPaths(data: CampaignExport): string[] {
  const paths = new Set<string>();
  const add = (url: string | null | undefined) => {
    if (url && url.startsWith("/assets/")) paths.add(url);
  };
  add(data.campaign.coverImageUrl);
  for (const pc of data.pcs) add(pc.portraitImageUrl);
  for (const npc of data.npcs) add(npc.portraitImageUrl);
  for (const monster of data.monsters) add(monster.portraitImageUrl);
  for (const location of data.locations) add(location.imageUrl);
  return [...paths];
}

// ---------- import ----------

interface ImportContext {
  pcIdMap: Map<string, string>;
  npcIdMap: Map<string, string>;
  monsterIdMap: Map<string, string>;
  locationIdMap: Map<string, string>;
  mysteryIdMap: Map<string, string>;
  clueIdMap: Map<string, string>;
  entryIdMap: Map<string, string>;
}

function idMapFor(ctx: ImportContext, type: EntityType): Map<string, string> {
  switch (type) {
    case "pcs":
      return ctx.pcIdMap;
    case "npcs":
      return ctx.npcIdMap;
    case "monsters":
      return ctx.monsterIdMap;
    case "locations":
      return ctx.locationIdMap;
    case "mysteries":
      return ctx.mysteryIdMap;
    case "clues":
      return ctx.clueIdMap;
  }
}

function actorIdMapFor(ctx: ImportContext, actorType: ActorType): Map<string, string> {
  switch (actorType) {
    case "pc":
      return ctx.pcIdMap;
    case "npc":
      return ctx.npcIdMap;
    case "monster":
      return ctx.monsterIdMap;
  }
}

// Every record gets a freshly generated id on import (never the id it was
// exported with) so re-importing the same export twice can't collide with
// the first import's rows. Every cross-reference is rewritten through the id
// maps built up as each entity type is created, in FK dependency order.
// Known gap: raw ids embedded inside SessionEvent.payload (locationId,
// clueId, pcId, ...) are left as-is -- nothing in the app reads them, only
// the *Name/*Title fields alongside them, so remapping them would be dead
// work. See HistoryLog.tsx's describeEvent.
async function importCampaignExport(data: CampaignExport) {
  const ctx: ImportContext = {
    pcIdMap: new Map(),
    npcIdMap: new Map(),
    monsterIdMap: new Map(),
    locationIdMap: new Map(),
    mysteryIdMap: new Map(),
    clueIdMap: new Map(),
    entryIdMap: new Map(),
  };

  const newCampaignId = randomUUID();
  const operations: Prisma.PrismaPromise<unknown>[] = [];

  operations.push(
    prisma.campaign.create({
      data: {
        id: newCampaignId,
        name: data.campaign.name,
        description: data.campaign.description,
        coverImageUrl: data.campaign.coverImageUrl,
        createdAt: new Date(data.campaign.createdAt),
        updatedAt: new Date(data.campaign.updatedAt),
      },
    }),
  );

  for (const pc of data.pcs) {
    const newId = randomUUID();
    ctx.pcIdMap.set(pc.id, newId);
    operations.push(
      prisma.pc.create({
        data: { ...pc, id: newId, campaignId: newCampaignId, createdAt: new Date(pc.createdAt), updatedAt: new Date(pc.updatedAt) },
      }),
    );
  }
  for (const npc of data.npcs) {
    const newId = randomUUID();
    ctx.npcIdMap.set(npc.id, newId);
    operations.push(
      prisma.npc.create({
        data: { ...npc, id: newId, campaignId: newCampaignId, createdAt: new Date(npc.createdAt), updatedAt: new Date(npc.updatedAt) },
      }),
    );
  }
  for (const monster of data.monsters) {
    const newId = randomUUID();
    ctx.monsterIdMap.set(monster.id, newId);
    operations.push(
      prisma.monster.create({
        data: {
          ...monster,
          id: newId,
          campaignId: newCampaignId,
          createdAt: new Date(monster.createdAt),
          updatedAt: new Date(monster.updatedAt),
        },
      }),
    );
  }
  for (const location of data.locations) {
    const newId = randomUUID();
    ctx.locationIdMap.set(location.id, newId);
    operations.push(
      prisma.location.create({
        data: {
          ...location,
          id: newId,
          campaignId: newCampaignId,
          createdAt: new Date(location.createdAt),
          updatedAt: new Date(location.updatedAt),
        },
      }),
    );
  }
  for (const mystery of data.mysteries) {
    const newId = randomUUID();
    ctx.mysteryIdMap.set(mystery.id, newId);
    operations.push(
      prisma.mystery.create({
        data: {
          ...mystery,
          id: newId,
          campaignId: newCampaignId,
          createdAt: new Date(mystery.createdAt),
          updatedAt: new Date(mystery.updatedAt),
        },
      }),
    );
  }
  for (const clue of data.clues) {
    const newId = randomUUID();
    ctx.clueIdMap.set(clue.id, newId);
    operations.push(
      prisma.clue.create({
        data: {
          id: newId,
          campaignId: newCampaignId,
          mysteryId: clue.mysteryId ? (ctx.mysteryIdMap.get(clue.mysteryId) ?? null) : null,
          title: clue.title,
          content: clue.content,
          gmNotes: clue.gmNotes,
          visibility: clue.visibility,
          visibleTo: JSON.stringify(
            clue.visibleTo.map((pcId) => ctx.pcIdMap.get(pcId)).filter((id): id is string => Boolean(id)),
          ),
          createdAt: new Date(clue.createdAt),
          updatedAt: new Date(clue.updatedAt),
        },
      }),
    );
  }

  const sessionIdMap = new Map<string, string>();
  const battleIdMap = new Map<string, string>();

  // Pass 1: sessions, events, battles, entries -- populates entryIdMap fully
  // before pass 2 needs it for StatusEffectInstance.sourceEntryId, which can
  // point at any entry in the same battle regardless of creation order.
  for (const session of data.sessions) {
    const newSessionId = randomUUID();
    sessionIdMap.set(session.id, newSessionId);
    operations.push(
      prisma.session.create({
        data: {
          id: newSessionId,
          campaignId: newCampaignId,
          title: session.title,
          status: session.status,
          currentLocationId: session.currentLocationId ? (ctx.locationIdMap.get(session.currentLocationId) ?? null) : null,
          startedAt: new Date(session.startedAt),
          endedAt: session.endedAt ? new Date(session.endedAt) : null,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
        },
      }),
    );

    for (const event of session.events) {
      const actorMap = event.actorType ? actorIdMapFor(ctx, event.actorType) : undefined;
      const targetMap = event.targetType ? actorIdMapFor(ctx, event.targetType) : undefined;
      operations.push(
        prisma.sessionEvent.create({
          data: {
            id: randomUUID(),
            sessionId: newSessionId,
            campaignId: newCampaignId,
            type: event.type,
            actorType: event.actorType,
            actorId: event.actorId && actorMap ? (actorMap.get(event.actorId) ?? null) : null,
            targetType: event.targetType,
            targetId: event.targetId && targetMap ? (targetMap.get(event.targetId) ?? null) : null,
            payload: JSON.stringify(event.payload),
            createdAt: new Date(event.createdAt),
          },
        }),
      );
    }

    for (const battle of session.battles) {
      const newBattleId = randomUUID();
      battleIdMap.set(battle.id, newBattleId);
      operations.push(
        prisma.battleEncounter.create({
          data: {
            id: newBattleId,
            sessionId: newSessionId,
            campaignId: newCampaignId,
            status: battle.status,
            currentTurnIndex: battle.currentTurnIndex,
            createdAt: new Date(battle.createdAt),
            updatedAt: new Date(battle.updatedAt),
          },
        }),
      );

      for (const entry of battle.entries) {
        const newEntryId = randomUUID();
        ctx.entryIdMap.set(entry.id, newEntryId);
        const entryActorMap = entry.actorType ? actorIdMapFor(ctx, entry.actorType) : undefined;
        operations.push(
          prisma.initiativeEntry.create({
            data: {
              id: newEntryId,
              battleEncounterId: newBattleId,
              actorType: entry.actorType,
              actorId: entry.actorId && entryActorMap ? (entryActorMap.get(entry.actorId) ?? null) : null,
              adHocName: entry.adHocName,
              initiative: entry.initiative,
              currentHp: entry.currentHp,
              maxHp: entry.maxHp,
              order: entry.order,
              createdAt: new Date(entry.createdAt),
              updatedAt: new Date(entry.updatedAt),
            },
          }),
        );
      }
    }
  }

  // Pass 2: statuses, now that entryIdMap covers every entry across every battle.
  for (const session of data.sessions) {
    for (const battle of session.battles) {
      for (const entry of battle.entries) {
        const newEntryId = ctx.entryIdMap.get(entry.id);
        if (!newEntryId) continue;
        for (const status of entry.statuses) {
          operations.push(
            prisma.statusEffectInstance.create({
              data: {
                id: randomUUID(),
                initiativeEntryId: newEntryId,
                sourceEntryId: status.sourceEntryId ? (ctx.entryIdMap.get(status.sourceEntryId) ?? null) : null,
                label: status.label,
                note: status.note,
                appliedAtTurn: status.appliedAtTurn,
                expired: status.expired,
                createdAt: new Date(status.createdAt),
              },
            }),
          );
        }
      }
    }
  }

  for (const link of data.entityLinks) {
    const fromMap = idMapFor(ctx, link.fromType);
    const toMap = idMapFor(ctx, link.toType);
    operations.push(
      prisma.entityLink.create({
        data: {
          id: randomUUID(),
          campaignId: newCampaignId,
          fromType: link.fromType,
          fromId: fromMap.get(link.fromId) ?? link.fromId,
          toType: link.toType,
          toId: toMap.get(link.toId) ?? link.toId,
          label: link.label,
          reverseLabel: link.reverseLabel,
          directional: link.directional,
          visibility: link.visibility,
          notes: link.notes,
          createdAt: new Date(link.createdAt),
          updatedAt: new Date(link.updatedAt),
        },
      }),
    );
  }

  const results = await prisma.$transaction(operations);
  const campaign = results[0] as {
    id: string;
    name: string;
    description: string;
    coverImageUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  return {
    ...campaign,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

export function registerCampaignTransferRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // Plain (untyped) route, not `typed.get` -- this is the app's first binary
  // response, and fastify-type-provider-zod's response typing only covers
  // JSON bodies. 404s are still returned as ordinary JSON error objects.
  app.get("/api/campaigns/:id/export", async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ message: "Invalid campaign id" });
    }

    const data = await buildCampaignExport(params.data.id);
    if (!data) {
      return reply.code(404).send({ message: "Campaign not found" });
    }

    const zip = new JSZip();
    zip.file("campaign.json", JSON.stringify(data, null, 2));

    const assetsFolder = zip.folder("assets")!;
    for (const assetPath of collectAssetPaths(data)) {
      const filename = path.basename(assetPath);
      try {
        assetsFolder.file(filename, await readFile(path.join(ASSETS_DIR, filename)));
      } catch {
        // Referenced asset missing on disk -- skip it rather than failing
        // the whole export, same "degrade gracefully" tradeoff the app
        // already makes for dangling entity references.
      }
    }

    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const safeName = data.campaign.name.replace(/[^a-z0-9-_ ]/gi, "").trim() || "campaign";
    reply
      .header("Content-Type", "application/zip")
      .header("Content-Disposition", `attachment; filename="${safeName}.zip"`)
      .send(buffer);
  });

  typed.post(
    "/api/campaigns/import",
    { schema: { response: { 201: campaignSchema, 400: errorResponseSchema } } },
    async (request, reply) => {
      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ message: "No file uploaded" });
      }
      const buffer = await file.toBuffer();

      let zip: JSZip;
      try {
        zip = await JSZip.loadAsync(buffer);
      } catch {
        return reply.code(400).send({ message: "Not a valid zip file" });
      }

      const manifestFile = zip.file("campaign.json");
      if (!manifestFile) {
        return reply.code(400).send({ message: "Missing campaign.json in the uploaded file" });
      }

      let raw: unknown;
      try {
        raw = JSON.parse(await manifestFile.async("string"));
      } catch {
        return reply.code(400).send({ message: "campaign.json is not valid JSON" });
      }
      const parsed = campaignExportSchema.safeParse(raw);
      if (!parsed.success) {
        return reply.code(400).send({ message: "campaign.json does not match the expected export format" });
      }

      // Create the campaign and all its rows before writing any asset files
      // to disk. If the transaction fails, nothing has been written yet --
      // there's nothing to clean up. Writing files first would risk leaving
      // orphaned, unreferenced files behind on a failed import.
      const campaign = await importCampaignExport(parsed.data);

      await mkdir(ASSETS_DIR, { recursive: true });
      for (const [relPath, entry] of Object.entries(zip.files) as [string, JSZip.JSZipObject][]) {
        if (entry.dir || !relPath.startsWith("assets/")) continue;
        await writeFile(path.join(ASSETS_DIR, path.basename(relPath)), await entry.async("nodebuffer"));
      }

      return reply.code(201).send(campaign);
    },
  );
}
