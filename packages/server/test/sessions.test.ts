import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

describe("session lifecycle", () => {
  let app: FastifyInstance;
  let campaignId: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
    const campaignRes = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { name: "Session Test Campaign" },
    });
    campaignId = campaignRes.json().id;
  });

  afterAll(async () => {
    await app.inject({ method: "DELETE", url: `/api/campaigns/${campaignId}` });
    await app.close();
    await prisma.$disconnect();
  });

  it("starts, updates, and ends a session, logging every step", async () => {
    const locationRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/locations`,
      payload: { name: "The Sunken Keep" },
    });
    const locationId = locationRes.json().id;

    const startRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions`,
      payload: { title: "Session 1" },
    });
    expect(startRes.statusCode).toBe(201);
    const session = startRes.json();
    expect(session.status).toBe("active");

    const duplicateStartRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions`,
      payload: { title: "Session 2" },
    });
    expect(duplicateStartRes.statusCode).toBe(409);

    const locationChangeRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${session.id}/location`,
      payload: { locationId },
    });
    expect(locationChangeRes.statusCode).toBe(200);
    expect(locationChangeRes.json().currentLocationId).toBe(locationId);

    const noteRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${session.id}/notes`,
      payload: { note: "The party found a hidden door." },
    });
    expect(noteRes.statusCode).toBe(201);

    const endRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${session.id}/end`,
    });
    expect(endRes.statusCode).toBe(200);
    expect(endRes.json().status).toBe("ended");

    const eventsRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/sessions/${session.id}/events`,
    });
    expect(eventsRes.statusCode).toBe(200);
    const eventTypes = eventsRes.json().events.map((event: { type: string }) => event.type);
    expect(eventTypes).toEqual(["SESSION_STARTED", "LOCATION_CHANGED", "GM_NOTE", "SESSION_ENDED"]);
  });

  it("logs the full location breadcrumb, not just the leaf name, when setting a nested location", async () => {
    const keepRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/locations`,
      payload: { name: "The Sunken Keep" },
    });
    const basementRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/locations`,
      payload: { name: "Basement", parentLocationId: keepRes.json().id },
    });
    const treasuryRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/locations`,
      payload: { name: "Treasury", parentLocationId: basementRes.json().id },
    });

    const startRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions`,
      payload: { title: "Breadcrumb Session" },
    });
    const session = startRes.json();

    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${session.id}/location`,
      payload: { locationId: treasuryRes.json().id },
    });

    const eventsRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/sessions/${session.id}/events`,
    });
    const locationChangedEvent = eventsRes
      .json()
      .events.find((event: { type: string }) => event.type === "LOCATION_CHANGED");
    expect(locationChangedEvent.payload.locationName).toBe("The Sunken Keep > Basement > Treasury");

    await app.inject({ method: "POST", url: `/api/campaigns/${campaignId}/sessions/${session.id}/end` });
  });

  it("defaults an untitled session's title to the current date and time", async () => {
    const startRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions`,
      payload: { title: "  " },
    });
    expect(startRes.statusCode).toBe(201);
    const session = startRes.json();
    expect(session.title).not.toBe("");
    expect(session.title).toContain(String(new Date().getFullYear()));

    await app.inject({ method: "POST", url: `/api/campaigns/${campaignId}/sessions/${session.id}/end` });
  });
});
