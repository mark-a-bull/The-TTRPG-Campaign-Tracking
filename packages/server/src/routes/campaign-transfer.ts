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
  type ItemOwnerType,
  type SessionExport,
} from "@ttrpg/shared";
import { errorResponseSchema } from "../error-response.js";
import { prisma } from "../prisma.js";
import { serializeSessionEvent } from "../session-events.js";
import { ASSETS_DIR } from "./assets.js";
import { serializeClue } from "./clues.js";
import { serializeLink } from "./entity-links.js";
import { serializeTimestamps } from "./nested-entity.js";
import { serializeSession } from "./sessions.js";

// ---------- export ----------

/** Strips `campaignId` from a serialize helper's output -- the export schema
 * omits it (a fresh campaignId is assigned on import instead). */
function withoutCampaignId<T extends { campaignId: unknown }>({
  campaignId: _campaignId,
  ...rest
}: T): Omit<T, "campaignId"> {
  return rest;
}

/** Same, but for SessionEvent's shape, which also carries `sessionId`. */
function withoutSessionAndCampaignId<T extends { sessionId: unknown; campaignId: unknown }>({
  sessionId: _sessionId,
  campaignId: _campaignId,
  ...rest
}: T): Omit<T, "sessionId" | "campaignId"> {
  return rest;
}

async function buildCampaignExport(campaignId: string): Promise<CampaignExport | null> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return null;

  const [
    pcs,
    npcs,
    monsters,
    locations,
    mysteries,
    clues,
    organizations,
    items,
    inventoryVisibilities,
    sessions,
    entityLinks,
  ] = await Promise.all([
      prisma.pc.findMany({ where: { campaignId } }),
      prisma.npc.findMany({ where: { campaignId } }),
      prisma.monster.findMany({ where: { campaignId } }),
      prisma.location.findMany({ where: { campaignId } }),
      prisma.mystery.findMany({ where: { campaignId } }),
      prisma.clue.findMany({ where: { campaignId } }),
      prisma.organization.findMany({ where: { campaignId } }),
      prisma.item.findMany({ where: { campaignId } }),
      prisma.inventoryVisibility.findMany({ where: { campaignId } }),
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
    pcs: pcs.map((pc) => withoutCampaignId(serializeTimestamps(pc))),
    npcs: npcs.map((npc) => withoutCampaignId(serializeTimestamps(npc))),
    monsters: monsters.map((monster) => withoutCampaignId(serializeTimestamps(monster))),
    locations: locations.map((location) => withoutCampaignId(serializeTimestamps(location))),
    mysteries: mysteries.map((mystery) => ({
      ...withoutCampaignId(serializeTimestamps(mystery)),
      status: mystery.status as CampaignExport["mysteries"][number]["status"],
    })),
    clues: clues.map((clue) => withoutCampaignId(serializeClue(clue))),
    organizations: organizations.map((organization) => withoutCampaignId(serializeTimestamps(organization))),
    items: items.map((item) => ({
      ...withoutCampaignId(serializeTimestamps(item)),
      ownerType: item.ownerType as CampaignExport["items"][number]["ownerType"],
    })),
    inventoryVisibilities: inventoryVisibilities.map((row) => ({
      ownerType: row.ownerType as CampaignExport["inventoryVisibilities"][number]["ownerType"],
      ownerId: row.ownerId,
      hidden: row.hidden,
    })),
    sessions: sessions.map((session) => {
      const serialized = serializeSession(session);
      return {
        id: serialized.id,
        title: serialized.title,
        status: serialized.status as SessionExport["status"],
        currentLocationId: serialized.currentLocationId,
        startedAt: serialized.startedAt,
        endedAt: serialized.endedAt,
        createdAt: serialized.createdAt,
        updatedAt: serialized.updatedAt,
        events: session.events.map((event) => withoutSessionAndCampaignId(serializeSessionEvent(event))),
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
      };
    }),
    entityLinks: entityLinks.map((link) => withoutCampaignId(serializeLink(link))),
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
  for (const organization of data.organizations) add(organization.imageUrl);
  for (const item of data.items) add(item.imageUrl);
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
  organizationIdMap: Map<string, string>;
  itemIdMap: Map<string, string>;
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
    case "organizations":
      return ctx.organizationIdMap;
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

// A 4-case (pc|npc|monster|location) variant of actorIdMapFor -- Item's
// ownerType can also be "location", which ActorType (3-value, battle-actor
// scoped) doesn't cover, so this can't reuse actorIdMapFor as-is.
function ownerIdMapFor(ctx: ImportContext, ownerType: ItemOwnerType): Map<string, string> {
  switch (ownerType) {
    case "pc":
      return ctx.pcIdMap;
    case "npc":
      return ctx.npcIdMap;
    case "monster":
      return ctx.monsterIdMap;
    case "location":
      return ctx.locationIdMap;
  }
}

/**
 * Assigns a fresh id to each item (recorded into `idMap`, keyed by the old
 * id) and rewrites its campaignId, ready for a `createMany`. Only valid for
 * entity types that don't need any other cross-reference resolved against
 * sibling rows created in the same import -- pcs/npcs/monsters/locations/
 * mysteries qualify; clues (mysteryId/visibleTo), sessions, and everything
 * under them don't, and are built by hand below instead.
 */
function remapFlatEntities<T extends { id: string; createdAt: string; updatedAt: string }>(
  items: T[],
  idMap: Map<string, string>,
  newCampaignId: string,
): (Omit<T, "id" | "createdAt" | "updatedAt"> & {
  id: string;
  campaignId: string;
  createdAt: Date;
  updatedAt: Date;
})[] {
  return items.map((item) => {
    const newId = randomUUID();
    idMap.set(item.id, newId);
    const { id: _id, createdAt, updatedAt, ...rest } = item;
    return { ...rest, id: newId, campaignId: newCampaignId, createdAt: new Date(createdAt), updatedAt: new Date(updatedAt) };
  });
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
    organizationIdMap: new Map(),
    itemIdMap: new Map(),
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

  // Flat entity types: no per-row remapping needed beyond the new
  // campaignId, so each type is one createMany instead of N individual
  // creates.
  operations.push(prisma.pc.createMany({ data: remapFlatEntities(data.pcs, ctx.pcIdMap, newCampaignId) }));
  operations.push(prisma.npc.createMany({ data: remapFlatEntities(data.npcs, ctx.npcIdMap, newCampaignId) }));
  operations.push(
    prisma.monster.createMany({ data: remapFlatEntities(data.monsters, ctx.monsterIdMap, newCampaignId) }),
  );
  // Locations reference their own parent, so this can't be a single flat
  // createMany like the others: remapFlatEntities only rewrites the row's
  // own id, and the stale exported parentLocationId would point at a
  // foreign/nonexistent id post-import. First pass creates every location
  // with parentLocationId forced null (still populating ctx.locationIdMap
  // as a side effect); second pass resolves each original parentLocationId
  // through that now-complete map and sets it via an individual update --
  // can't be folded into the createMany since none of the new ids exist
  // until that operation actually runs.
  const locationRows = remapFlatEntities(data.locations, ctx.locationIdMap, newCampaignId).map((row) => ({
    ...row,
    parentLocationId: null,
  }));
  operations.push(prisma.location.createMany({ data: locationRows }));
  for (const location of data.locations) {
    if (!location.parentLocationId) continue;
    const newParentId = ctx.locationIdMap.get(location.parentLocationId);
    if (!newParentId) continue; // defensive: parent wasn't part of this export
    operations.push(
      prisma.location.update({
        where: { id: ctx.locationIdMap.get(location.id)! },
        data: { parentLocationId: newParentId },
      }),
    );
  }

  operations.push(
    prisma.mystery.createMany({ data: remapFlatEntities(data.mysteries, ctx.mysteryIdMap, newCampaignId) }),
  );
  operations.push(
    prisma.organization.createMany({
      data: remapFlatEntities(data.organizations, ctx.organizationIdMap, newCampaignId),
    }),
  );

  // Items reference a polymorphic owner (pc/npc/monster/location) that must
  // resolve against sibling rows created in the same import, same as Clue's
  // mysteryId -- can't be a flat createMany. Runs after the pcs/npcs/
  // monsters/locations operations above so ownerIdMapFor's maps are already
  // populated (those remapFlatEntities calls run synchronously above, not
  // when the transaction executes).
  for (const item of data.items) {
    const newId = randomUUID();
    ctx.itemIdMap.set(item.id, newId);
    const newOwnerId = ownerIdMapFor(ctx, item.ownerType).get(item.ownerId);
    if (!newOwnerId) continue; // defensive: owner wasn't part of this export
    operations.push(
      prisma.item.create({
        data: {
          id: newId,
          campaignId: newCampaignId,
          ownerType: item.ownerType,
          ownerId: newOwnerId,
          name: item.name,
          imageUrl: item.imageUrl,
          description: item.description,
          notes: item.notes,
          quantity: item.quantity,
          hidden: item.hidden,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
      }),
    );
  }

  for (const visibility of data.inventoryVisibilities) {
    const newOwnerId = ownerIdMapFor(ctx, visibility.ownerType).get(visibility.ownerId);
    if (!newOwnerId) continue; // defensive: owner wasn't part of this export
    operations.push(
      prisma.inventoryVisibility.create({
        data: {
          id: randomUUID(),
          campaignId: newCampaignId,
          ownerType: visibility.ownerType,
          ownerId: newOwnerId,
          hidden: visibility.hidden,
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

    const built = await buildCampaignExport(params.data.id);
    if (!built) {
      return reply.code(404).send({ message: "Campaign not found" });
    }

    // Validate the assembled export against the same schema import enforces,
    // rather than trusting the `as` casts sprinkled through
    // buildCampaignExport. Catches a stale/invalid DB value (e.g. an enum
    // string from a prior schema version) here, with a clear 500, instead of
    // producing a zip that fails to import later with no useful detail.
    const validated = campaignExportSchema.safeParse(built);
    if (!validated.success) {
      request.log.error({ err: validated.error }, "Campaign export data failed schema validation");
      return reply.code(500).send({ message: "Failed to export campaign: exported data was malformed" });
    }
    const data = validated.data;

    const zip = new JSZip();
    zip.file("campaign.json", JSON.stringify(data, null, 2));

    const assetsFolder = zip.folder("assets")!;
    await Promise.all(
      collectAssetPaths(data).map(async (assetPath) => {
        const filename = path.basename(assetPath);
        try {
          assetsFolder.file(filename, await readFile(path.join(ASSETS_DIR, filename)));
        } catch (err) {
          // A missing file (ENOENT) is expected and skipped, same
          // "degrade gracefully" tradeoff the app already makes for
          // dangling entity references. Anything else (permissions,
          // transient I/O error) is logged rather than silently dropped,
          // so a real problem doesn't look identical to "file deleted".
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
            request.log.warn({ err, filename }, "Failed to read asset file for campaign export");
          }
        }
      }),
    );

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
      // Overridden per-request rather than raising the app-wide multipart
      // limit (app.ts) -- a campaign zip can bundle many images, but that
      // shouldn't also loosen the unrelated single-asset-upload route's cap.
      const file = await request.file({ limits: { fileSize: 50 * 1024 * 1024 } });
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
      const assetEntries = Object.entries(zip.files).filter(
        ([relPath, entry]) => !entry.dir && relPath.startsWith("assets/"),
      ) as [string, JSZip.JSZipObject][];
      await Promise.all(
        assetEntries.map(async ([relPath, entry]) => {
          await writeFile(path.join(ASSETS_DIR, path.basename(relPath)), await entry.async("nodebuffer"));
        }),
      );

      return reply.code(201).send(campaign);
    },
  );
}
