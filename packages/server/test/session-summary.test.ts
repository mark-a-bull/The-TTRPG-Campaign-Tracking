import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

describe("session summary", () => {
  let app: FastifyInstance;
  let campaignId: string;
  let sessionId: string;
  let pcId: string;
  let locationAId: string;
  let locationBId: string;
  let clueId: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const campaignRes = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { name: "Summary Test Campaign" },
    });
    campaignId = campaignRes.json().id;

    const pcRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs`,
      payload: { name: "Kira Stormwind" },
    });
    pcId = pcRes.json().id;

    const locationARes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/locations`,
      payload: { name: "The Sunken Keep" },
    });
    locationAId = locationARes.json().id;

    const locationBRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/locations`,
      payload: { name: "The Drowned Chapel" },
    });
    locationBId = locationBRes.json().id;

    const clueRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/clues`,
      payload: { title: "A bloodied signet ring" },
    });
    clueId = clueRes.json().id;

    const sessionRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions`,
      payload: { title: "Summary Session" },
    });
    sessionId = sessionRes.json().id;
  });

  afterAll(async () => {
    await app.inject({ method: "DELETE", url: `/api/campaigns/${campaignId}` });
    await app.close();
    await prisma.$disconnect();
  });

  it("404s for an unknown session", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/sessions/00000000-0000-0000-0000-000000000000/summary`,
    });
    expect(res.statusCode).toBe(404);
  });

  it("aggregates the full event log into a structured recap", async () => {
    // Set the same location twice in a row to confirm de-duplication.
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/location`,
      payload: { locationId: locationAId },
    });
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/location`,
      payload: { locationId: locationAId },
    });
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/location`,
      payload: { locationId: locationBId },
    });

    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/notes`,
      payload: { note: "Found a hidden door." },
    });

    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/clues/${clueId}/reveal`,
    });
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/clues/${clueId}/hide`,
    });

    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs/${pcId}/award-xp`,
      payload: { amount: 50, note: "Solved the riddle", level: 2 },
    });

    const battleRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles`,
    });
    const battleId = battleRes.json().id;

    const entryRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries`,
      payload: { kind: "entity", actorType: "pc", actorId: pcId, initiative: 10, maxHp: 10 },
    });
    const entryId = entryRes.json().entries.find((entry: { actorId: string }) => entry.actorId === pcId).id;

    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/start`,
    });

    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries/${entryId}/actions`,
      payload: { type: "damage", amount: 4 },
    });
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries/${entryId}/actions`,
      payload: { type: "heal", amount: 2 },
    });
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries/${entryId}/actions`,
      payload: { type: "damage", amount: 8 },
    });
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries/${entryId}/actions`,
      payload: { type: "ko" },
    });

    const summaryRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/summary`,
    });
    expect(summaryRes.statusCode).toBe(200);
    const summary = summaryRes.json();

    expect(summary.locationsVisited).toEqual(["The Sunken Keep", "The Drowned Chapel"]);
    expect(summary.gmNotes).toEqual(["Found a hidden door."]);
    expect(summary.cluesRevealed).toEqual(["A bloodied signet ring"]);
    expect(summary.cluesHidden).toEqual(["A bloodied signet ring"]);
    expect(summary.battlesFought).toBe(1);
    expect(summary.totalDamage).toBe(12);
    expect(summary.totalHealing).toBe(2);
    expect(summary.knockouts).toEqual(["Kira Stormwind"]);
    expect(summary.xpAwards).toEqual([{ pcName: "Kira Stormwind", amount: 50 }]);
    expect(summary.totalXpAwarded).toBe(50);
    expect(summary.levelChanges).toEqual([{ pcName: "Kira Stormwind", newLevel: 2 }]);
  });

  it("aggregates end-of-session bulk awards (explicit sessionId) alongside mid-session ones", async () => {
    await app.inject({ method: "POST", url: `/api/campaigns/${campaignId}/sessions/${sessionId}/end` });

    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs/${pcId}/award-xp`,
      payload: { amount: 25, level: 3, sessionId },
    });

    const summaryRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/summary`,
    });
    const summary = summaryRes.json();

    expect(summary.xpAwards).toEqual([
      { pcName: "Kira Stormwind", amount: 50 },
      { pcName: "Kira Stormwind", amount: 25 },
    ]);
    expect(summary.totalXpAwarded).toBe(75);
    expect(summary.levelChanges).toEqual([
      { pcName: "Kira Stormwind", newLevel: 2 },
      { pcName: "Kira Stormwind", newLevel: 3 },
    ]);

    const eventsRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/events`,
    });
    const eventTypes = eventsRes.json().events.map((event: { type: string }) => event.type);
    expect(eventTypes).toContain("END_OF_SESSION_XP_AWARDED");
    expect(eventTypes).toContain("END_OF_SESSION_LEVEL_AWARDED");
  });
});
