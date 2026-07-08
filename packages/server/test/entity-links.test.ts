import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

describe("entity links", () => {
  let app: FastifyInstance;
  let campaignId: string;
  let pcId: string;
  let locationId: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const campaignRes = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { name: "Links Test Campaign" },
    });
    campaignId = campaignRes.json().id;

    const pcRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs`,
      payload: { name: "Kira Stormwind" },
    });
    pcId = pcRes.json().id;

    const locationRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/locations`,
      payload: { name: "Millbrook" },
    });
    locationId = locationRes.json().id;
  });

  afterAll(async () => {
    await app.inject({ method: "DELETE", url: `/api/campaigns/${campaignId}` });
    await app.close();
    await prisma.$disconnect();
  });

  it("rejects a self-link", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/links`,
      payload: { fromType: "pcs", fromId: pcId, toType: "pcs", toId: pcId, label: "self" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a link to a nonexistent entity", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/links`,
      payload: { fromType: "pcs", fromId: pcId, toType: "locations", toId: randomUUID(), label: "home town" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("creates a directional link, lists it from both sides, updates, and deletes it", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/links`,
      payload: {
        fromType: "pcs",
        fromId: pcId,
        toType: "locations",
        toId: locationId,
        label: "home town",
        reverseLabel: "hometown of",
        directional: true,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const link = createRes.json();
    expect(link.visibility).toBe("revealed");

    const fromSideRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/links?entityType=pcs&entityId=${pcId}`,
    });
    expect(fromSideRes.statusCode).toBe(200);
    expect(fromSideRes.json()).toHaveLength(1);
    expect(fromSideRes.json()[0].id).toBe(link.id);

    const toSideRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/links?entityType=locations&entityId=${locationId}`,
    });
    expect(toSideRes.statusCode).toBe(200);
    expect(toSideRes.json()).toHaveLength(1);
    expect(toSideRes.json()[0].id).toBe(link.id);

    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/campaigns/${campaignId}/links/${link.id}`,
      payload: { visibility: "hidden", notes: "secretly homesick" },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().visibility).toBe("hidden");
    expect(updateRes.json().notes).toBe("secretly homesick");

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/campaigns/${campaignId}/links/${link.id}`,
    });
    expect(deleteRes.statusCode).toBe(204);

    const afterDeleteRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/links?entityType=pcs&entityId=${pcId}`,
    });
    expect(afterDeleteRes.json()).toHaveLength(0);
  });

  it("creates a mutual (non-directional) link between two NPCs", async () => {
    const npc1Res = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/npcs`,
      payload: { name: "Joss" },
    });
    const npc2Res = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/npcs`,
      payload: { name: "Reyes" },
    });

    const createRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/links`,
      payload: {
        fromType: "npcs",
        fromId: npc1Res.json().id,
        toType: "npcs",
        toId: npc2Res.json().id,
        label: "rivals",
      },
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.json().directional).toBe(false);
    expect(createRes.json().reverseLabel).toBeNull();
  });
});
