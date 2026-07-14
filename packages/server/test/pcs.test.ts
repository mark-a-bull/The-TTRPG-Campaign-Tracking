import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

describe("PC XP awards", () => {
  let app: FastifyInstance;
  let campaignId: string;
  let pcId: string;
  let endedSessionId: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const campaignRes = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { name: "XP Test Campaign" },
    });
    campaignId = campaignRes.json().id;

    const pcRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs`,
      payload: { name: "Rell Ashwood" },
    });
    pcId = pcRes.json().id;
  });

  afterAll(async () => {
    await app.inject({ method: "DELETE", url: `/api/campaigns/${campaignId}` });
    await app.close();
    await prisma.$disconnect();
  });

  it("awards XP outside a session without logging an event", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs/${pcId}/award-xp`,
      payload: { amount: 50 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().xp).toBe(50);
  });

  it("awards XP during an active session and logs XP_AWARDED", async () => {
    const sessionRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions`,
      payload: { title: "Session 1" },
    });
    const sessionId = sessionRes.json().id;

    const awardRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs/${pcId}/award-xp`,
      payload: { amount: 30, note: "Defeated the goblin ambush" },
    });
    expect(awardRes.statusCode).toBe(200);
    expect(awardRes.json().xp).toBe(80);

    const eventsRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/events`,
    });
    const events = eventsRes.json().events;
    const xpEvent = events.find((event: { type: string }) => event.type === "XP_AWARDED");
    expect(xpEvent).toBeDefined();
    expect(xpEvent.payload).toMatchObject({
      pcId,
      pcName: "Rell Ashwood",
      amount: 30,
      newXp: 80,
      note: "Defeated the goblin ambush",
    });

    await app.inject({ method: "POST", url: `/api/campaigns/${campaignId}/sessions/${sessionId}/end` });
    endedSessionId = sessionId;
  });

  it("logs into an explicit sessionId even though that session has already ended, and can change level", async () => {
    const awardRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs/${pcId}/award-xp`,
      payload: { amount: 20, level: 2, sessionId: endedSessionId },
    });
    expect(awardRes.statusCode).toBe(200);
    expect(awardRes.json().level).toBe(2);

    const eventsRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/sessions/${endedSessionId}/events`,
    });
    const events = eventsRes.json().events;
    const xpEvent = events.find((event: { type: string }) => event.type === "END_OF_SESSION_XP_AWARDED");
    expect(xpEvent).toBeDefined();
    expect(xpEvent.payload).toMatchObject({ pcId, pcName: "Rell Ashwood", amount: 20, newXp: 100 });

    const levelEvent = events.find((event: { type: string }) => event.type === "END_OF_SESSION_LEVEL_AWARDED");
    expect(levelEvent).toBeDefined();
    expect(levelEvent.payload).toMatchObject({ pcId, pcName: "Rell Ashwood", previousLevel: 1, newLevel: 2 });
  });

  it("404s for a sessionId that doesn't belong to the campaign", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs/${pcId}/award-xp`,
      payload: { amount: 10, sessionId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("clamps xp at 0 on a large negative correction", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs/${pcId}/award-xp`,
      payload: { amount: -1000 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().xp).toBe(0);
  });

  it("404s for an unknown PC", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs/00000000-0000-0000-0000-000000000000/award-xp`,
      payload: { amount: 10 },
    });
    expect(res.statusCode).toBe(404);
  });
});
