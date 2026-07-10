import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

describe("clue reveal mechanism", () => {
  let app: FastifyInstance;
  let campaignId: string;
  let pcId: string;
  let clueId: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const campaignRes = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { name: "Clue Test Campaign" },
    });
    campaignId = campaignRes.json().id;

    const pcRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs`,
      payload: { name: "Rell Ashwood" },
    });
    pcId = pcRes.json().id;

    const clueRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/clues`,
      payload: { title: "A bloodied signet ring" },
    });
    clueId = clueRes.json().id;
  });

  afterAll(async () => {
    await app.inject({ method: "DELETE", url: `/api/campaigns/${campaignId}` });
    await app.close();
    await prisma.$disconnect();
  });

  it("rejects revealing a clue with no active session", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/clues/${clueId}/reveal`,
    });
    expect(res.statusCode).toBe(409);
  });

  it("reveals a clue during an active session, scoped to a PC, and logs the event", async () => {
    const sessionRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions`,
      payload: { title: "Session 1" },
    });
    const sessionId = sessionRes.json().id;

    const revealRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/clues/${clueId}/reveal`,
      payload: { visibleTo: [pcId] },
    });
    expect(revealRes.statusCode).toBe(200);
    const revealed = revealRes.json();
    expect(revealed.visibility).toBe("revealed");
    expect(revealed.visibleTo).toEqual([pcId]);

    const eventsRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/events`,
    });
    const events = eventsRes.json().events;
    const revealEvent = events.find((event: { type: string }) => event.type === "CLUE_REVEALED");
    expect(revealEvent).toBeDefined();
    expect(revealEvent.payload).toMatchObject({ clueId, clueTitle: "A bloodied signet ring", visibleTo: [pcId] });

    const doubleRevealRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/clues/${clueId}/reveal`,
    });
    expect(doubleRevealRes.statusCode).toBe(409);

    const hideRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/clues/${clueId}/hide`,
    });
    expect(hideRes.statusCode).toBe(200);
    const hidden = hideRes.json();
    expect(hidden.visibility).toBe("hidden");
    expect(hidden.visibleTo).toEqual([]);

    const doubleHideRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/clues/${clueId}/hide`,
    });
    expect(doubleHideRes.statusCode).toBe(409);

    const finalEventsRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/events`,
    });
    const finalTypes = finalEventsRes.json().events.map((event: { type: string }) => event.type);
    expect(finalTypes).toEqual(["SESSION_STARTED", "CLUE_REVEALED", "CLUE_HIDDEN"]);
  });
});
