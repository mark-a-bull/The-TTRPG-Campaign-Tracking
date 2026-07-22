import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

describe("items and inventories", () => {
  let app: FastifyInstance;
  let campaignId: string;
  let pcId: string;
  let locationId: string;
  let sessionId: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const campaignRes = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { name: "Items Test Campaign" },
    });
    campaignId = campaignRes.json().id;

    const pcRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs`,
      payload: { name: "Rell Ashwood" },
    });
    pcId = pcRes.json().id;

    const locationRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/locations`,
      payload: { name: "The Sunken Keep" },
    });
    locationId = locationRes.json().id;

    const sessionRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions`,
      payload: { title: "Session 1" },
    });
    sessionId = sessionRes.json().id;
  });

  afterAll(async () => {
    await app.inject({ method: "DELETE", url: `/api/campaigns/${campaignId}` });
    await app.close();
    await prisma.$disconnect();
  });

  it("creates, lists (filtered by owner), updates, and deletes an item", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/items`,
      payload: { ownerType: "pc", ownerId: pcId, name: "Arrows", quantity: 20 },
    });
    expect(createRes.statusCode).toBe(201);
    const item = createRes.json();
    expect(item.name).toBe("Arrows");
    expect(item.quantity).toBe(20);
    expect(item.hidden).toBe(false);

    const listRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/items?ownerType=pc&ownerId=${pcId}`,
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().some((i: { id: string }) => i.id === item.id)).toBe(true);

    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/campaigns/${campaignId}/items/${item.id}`,
      payload: { quantity: 15 },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().quantity).toBe(15);

    const deleteRes = await app.inject({ method: "DELETE", url: `/api/campaigns/${campaignId}/items/${item.id}` });
    expect(deleteRes.statusCode).toBe(204);

    const getRes = await app.inject({ method: "GET", url: `/api/campaigns/${campaignId}/items/${item.id}` });
    expect(getRes.statusCode).toBe(404);
  });

  it("404s creating an item for an owner not in this campaign", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/items`,
      payload: { ownerType: "pc", ownerId: "00000000-0000-0000-0000-000000000000", name: "Ghost Item" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects transferring, revealing, or hiding an item with no active session", async () => {
    // Uses a fresh campaign with no session, since the shared one already has an active session by this point.
    const campaignRes = await app.inject({ method: "POST", url: "/api/campaigns", payload: { name: "No Session" } });
    const noSessionCampaignId = campaignRes.json().id;
    const pcRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${noSessionCampaignId}/pcs`,
      payload: { name: "Solo" },
    });
    const soloPcId = pcRes.json().id;
    const itemRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${noSessionCampaignId}/items`,
      payload: { ownerType: "pc", ownerId: soloPcId, name: "Dagger" },
    });
    const itemId = itemRes.json().id;

    const transferRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${noSessionCampaignId}/items/${itemId}/transfer`,
      payload: { ownerType: "pc", ownerId: soloPcId },
    });
    expect(transferRes.statusCode).toBe(409);

    const revealRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${noSessionCampaignId}/items/${itemId}/reveal`,
    });
    expect(revealRes.statusCode).toBe(409);

    const hideRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${noSessionCampaignId}/items/${itemId}/hide`,
    });
    expect(hideRes.statusCode).toBe(409);

    await app.inject({ method: "DELETE", url: `/api/campaigns/${noSessionCampaignId}` });
  });

  it("transfers an item between owners (including to a Location) and logs ITEM_TRANSFERRED", async () => {
    const itemRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/items`,
      payload: { ownerType: "pc", ownerId: pcId, name: "Lantern" },
    });
    const itemId = itemRes.json().id;

    const transferRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/items/${itemId}/transfer`,
      payload: { ownerType: "location", ownerId: locationId },
    });
    expect(transferRes.statusCode).toBe(200);
    const transferred = transferRes.json();
    expect(transferred.ownerType).toBe("location");
    expect(transferred.ownerId).toBe(locationId);

    const eventsRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/events`,
    });
    const events = eventsRes.json().events;
    const transferEvent = events.find((event: { type: string }) => event.type === "ITEM_TRANSFERRED");
    expect(transferEvent).toBeDefined();
    expect(transferEvent.payload).toMatchObject({
      itemId,
      itemName: "Lantern",
      fromOwnerType: "pc",
      fromOwnerId: pcId,
      toOwnerType: "location",
      toOwnerId: locationId,
    });

    const pcItemsRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/items?ownerType=pc&ownerId=${pcId}`,
    });
    expect(pcItemsRes.json().some((i: { id: string }) => i.id === itemId)).toBe(false);

    const locationItemsRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/items?ownerType=location&ownerId=${locationId}`,
    });
    expect(locationItemsRes.json().some((i: { id: string }) => i.id === itemId)).toBe(true);
  });

  it("reveals and hides an item, rejecting a double reveal/hide, and logs events", async () => {
    const itemRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/items`,
      payload: { ownerType: "pc", ownerId: pcId, name: "Secret Note" },
    });
    const itemId = itemRes.json().id;

    const hideRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/items/${itemId}/hide`,
    });
    expect(hideRes.statusCode).toBe(200);
    expect(hideRes.json().hidden).toBe(true);

    const doubleHideRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/items/${itemId}/hide`,
    });
    expect(doubleHideRes.statusCode).toBe(409);

    const revealRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/items/${itemId}/reveal`,
    });
    expect(revealRes.statusCode).toBe(200);
    expect(revealRes.json().hidden).toBe(false);

    const doubleRevealRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/items/${itemId}/reveal`,
    });
    expect(doubleRevealRes.statusCode).toBe(409);

    const eventsRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/events`,
    });
    const types = eventsRes.json().events.map((event: { type: string }) => event.type);
    expect(types).toContain("ITEM_HIDDEN");
    expect(types).toContain("ITEM_REVEALED");
  });

  it("whole-inventory visibility defaults to visible with no row, and can be hidden/revealed", async () => {
    const statusRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/inventory-visibility?ownerType=location&ownerId=${locationId}`,
    });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json().hidden).toBe(false);

    const hideRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/inventory-visibility/hide`,
      payload: { ownerType: "location", ownerId: locationId },
    });
    expect(hideRes.statusCode).toBe(200);
    expect(hideRes.json().hidden).toBe(true);

    const afterHideStatusRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/inventory-visibility?ownerType=location&ownerId=${locationId}`,
    });
    expect(afterHideStatusRes.json().hidden).toBe(true);

    const revealRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/inventory-visibility/reveal`,
      payload: { ownerType: "location", ownerId: locationId },
    });
    expect(revealRes.statusCode).toBe(200);
    expect(revealRes.json().hidden).toBe(false);

    const eventsRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/events`,
    });
    const types = eventsRes.json().events.map((event: { type: string }) => event.type);
    expect(types).toContain("INVENTORY_HIDDEN");
    expect(types).toContain("INVENTORY_REVEALED");
  });

  it("leaves an item's ownerId dangling (not cascaded or blocked) when the owning PC is deleted", async () => {
    const ownerPcRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/pcs`,
      payload: { name: "Temp Owner" },
    });
    const ownerPcId = ownerPcRes.json().id;
    const itemRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/items`,
      payload: { ownerType: "pc", ownerId: ownerPcId, name: "Orphaned Item" },
    });
    const itemId = itemRes.json().id;

    await app.inject({ method: "DELETE", url: `/api/campaigns/${campaignId}/pcs/${ownerPcId}` });

    const getRes = await app.inject({ method: "GET", url: `/api/campaigns/${campaignId}/items/${itemId}` });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().ownerId).toBe(ownerPcId);
  });
});
