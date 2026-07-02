import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

describe("battle flow", () => {
  let app: FastifyInstance;
  let campaignId: string;
  let sessionId: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
    const campaignRes = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { name: "Battle Test Campaign" },
    });
    campaignId = campaignRes.json().id;

    const sessionRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions`,
      payload: { title: "Battle Session" },
    });
    sessionId = sessionRes.json().id;
  });

  afterAll(async () => {
    await app.inject({ method: "DELETE", url: `/api/campaigns/${campaignId}` });
    await app.close();
    await prisma.$disconnect();
  });

  it("runs a full battle from building through resolve, logging every action", async () => {
    const pcRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs`,
      payload: { name: "Kira Stormwind" },
    });
    const pcId = pcRes.json().id;

    const battleRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles`,
    });
    expect(battleRes.statusCode).toBe(201);
    const battleId = battleRes.json().id;

    const pcEntryRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries`,
      payload: { kind: "entity", actorType: "pc", actorId: pcId, initiative: 15, maxHp: 20 },
    });
    expect(pcEntryRes.statusCode).toBe(201);
    const pcEntry = pcEntryRes.json().entries.find((entry: { actorId: string }) => entry.actorId === pcId);
    expect(pcEntry.currentHp).toBe(20);

    const duplicatePcEntryRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries`,
      payload: { kind: "entity", actorType: "pc", actorId: pcId },
    });
    expect(duplicatePcEntryRes.statusCode).toBe(409);

    const monsterEntryRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries`,
      payload: { kind: "adHoc", adHocName: "Goblin Scout" },
    });
    expect(monsterEntryRes.statusCode).toBe(201);
    const goblinEntry = monsterEntryRes
      .json()
      .entries.find((entry: { adHocName: string | null }) => entry.adHocName === "Goblin Scout");

    const rollRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/roll-npc-initiative`,
    });
    expect(rollRes.statusCode).toBe(200);
    const rolledGoblin = rollRes.json().entries.find((entry: { id: string }) => entry.id === goblinEntry.id);
    expect(rolledGoblin.initiative).toBeGreaterThanOrEqual(1);
    expect(rolledGoblin.initiative).toBeLessThanOrEqual(20);

    const startRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/start`,
    });
    expect(startRes.statusCode).toBe(200);
    expect(startRes.json().status).toBe("active");

    const damageRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries/${pcEntry.id}/actions`,
      payload: { type: "damage", amount: 6 },
    });
    expect(damageRes.statusCode).toBe(200);
    const damagedEntry = damageRes.json().entries.find((entry: { id: string }) => entry.id === pcEntry.id);
    expect(damagedEntry.currentHp).toBe(14);

    const statusRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries/${pcEntry.id}/actions`,
      payload: { type: "status-apply", label: "Poisoned", note: "" },
    });
    expect(statusRes.statusCode).toBe(200);
    const statusedEntry = statusRes.json().entries.find((entry: { id: string }) => entry.id === pcEntry.id);
    expect(statusedEntry.statuses).toHaveLength(1);
    expect(statusedEntry.statuses[0].label).toBe("Poisoned");

    const bogusSourceRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries/${pcEntry.id}/actions`,
      payload: { type: "status-apply", label: "Blessed", note: "", sourceEntryId: randomUUID() },
    });
    expect(bogusSourceRes.statusCode).toBe(404);

    const advanceRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/advance-turn`,
    });
    expect(advanceRes.statusCode).toBe(200);

    const resolveRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/resolve`,
    });
    expect(resolveRes.statusCode).toBe(200);
    expect(resolveRes.json().status).toBe("resolved");

    const eventsRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/events`,
    });
    const eventTypes = eventsRes.json().map((event: { type: string }) => event.type);
    expect(eventTypes).toEqual([
      "SESSION_STARTED",
      "BATTLE_STARTED",
      "DAMAGE_APPLIED",
      "STATUS_APPLIED",
      "TURN_ADVANCED",
      "BATTLE_ENDED",
    ]);
  });
});
