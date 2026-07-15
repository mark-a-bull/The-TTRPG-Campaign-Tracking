import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

describe("public display", () => {
  let app: FastifyInstance;
  let campaignId: string;
  let pcId: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const campaignRes = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { name: "Display Test Campaign" },
    });
    campaignId = campaignRes.json().id;

    const pcRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs`,
      payload: { name: "Kira Stormwind" },
    });
    pcId = pcRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs`,
      payload: { name: "Rell Ashwood" },
    });
  });

  afterAll(async () => {
    await app.inject({ method: "DELETE", url: `/api/campaigns/${campaignId}` });
    await app.close();
    await prisma.$disconnect();
  });

  it("404s for an unknown campaign", async () => {
    const res = await app.inject({ method: "GET", url: `/api/campaigns/${randomUUID()}/public-display` });
    expect(res.statusCode).toBe(404);
  });

  it("shows the party roster but no session with no active session", async () => {
    const res = await app.inject({ method: "GET", url: `/api/campaigns/${campaignId}/public-display` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.campaignName).toBe("Display Test Campaign");
    expect(body.partyMembers).toHaveLength(2);
    expect(body.session).toBeNull();
  });

  it("shows the current location, party-wide clues only, and battle turn order with no HP once a session is active", async () => {
    const locationRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/locations`,
      payload: { name: "The Sunken Keep" },
    });
    const locationId = locationRes.json().id;

    const partyClueRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/clues`,
      payload: { title: "A bloodied signet ring" },
    });
    const partyClueId = partyClueRes.json().id;

    const privateClueRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/clues`,
      payload: { title: "A secret letter" },
    });
    const privateClueId = privateClueRes.json().id;

    const sessionRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions`,
      payload: { title: "Display Session" },
    });
    const sessionId = sessionRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/location`,
      payload: { locationId },
    });

    await app.inject({ method: "POST", url: `/api/campaigns/${campaignId}/clues/${partyClueId}/reveal` });
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/clues/${privateClueId}/reveal`,
      payload: { visibleTo: [pcId] },
    });

    const battleRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles`,
    });
    const battleId = battleRes.json().id;

    const entryRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries`,
      payload: { kind: "entity", actorType: "pc", actorId: pcId, initiative: 15, maxHp: 20 },
    });
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries`,
      payload: { kind: "adHoc", adHocName: "Goblin Scout", initiative: 5 },
    });
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/start`,
    });
    const pcEntryId = entryRes.json().entries.find((entry: { actorId: string }) => entry.actorId === pcId).id;
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries/${pcEntryId}/actions`,
      payload: { type: "damage", amount: 5 },
    });

    const res = await app.inject({ method: "GET", url: `/api/campaigns/${campaignId}/public-display` });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.session.title).toBe("Display Session");
    expect(body.session.currentLocation).toEqual({ name: "The Sunken Keep", imageUrl: null });

    expect(body.session.revealedClues).toEqual([{ id: partyClueId, title: "A bloodied signet ring", content: "" }]);

    expect(body.session.battle.status).toBe("active");
    expect(body.session.battle.entries).toHaveLength(2);
    const raw = JSON.stringify(body.session.battle.entries);
    expect(raw).not.toMatch(/currentHp|maxHp/);
    const kira = body.session.battle.entries.find((entry: { label: string }) => entry.label === "Kira Stormwind");
    expect(kira).toBeDefined();
    expect(kira.isCurrent).toBe(true);
  });
});
