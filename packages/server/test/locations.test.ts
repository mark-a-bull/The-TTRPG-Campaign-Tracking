import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

describe("location hierarchy", () => {
  let app: FastifyInstance;
  let campaignId: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const campaignRes = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { name: "Sub-locations Test Campaign" },
    });
    campaignId = campaignRes.json().id;
  });

  afterAll(async () => {
    await app.inject({ method: "DELETE", url: `/api/campaigns/${campaignId}` });
    await app.close();
    await prisma.$disconnect();
  });

  async function createLocation(name: string, parentLocationId: string | null = null) {
    const res = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/locations`,
      payload: { name, parentLocationId },
    });
    expect(res.statusCode).toBe(201);
    return res.json();
  }

  it("creates a location nested under a parent", async () => {
    const parent = await createLocation("The Sunken Keep");
    const child = await createLocation("Basement", parent.id);
    expect(child.parentLocationId).toBe(parent.id);
  });

  it("rejects setting a location's parent to one of its own descendants", async () => {
    const grandparent = await createLocation("Tower");
    const parent = await createLocation("Middle Floor", grandparent.id);
    const child = await createLocation("Top Floor", parent.id);

    // Direct self-parent
    const selfRes = await app.inject({
      method: "PATCH",
      url: `/api/campaigns/${campaignId}/locations/${grandparent.id}`,
      payload: { parentLocationId: grandparent.id },
    });
    expect(selfRes.statusCode).toBe(409);

    // Transitive cycle: grandparent -> child (its own grandchild)
    const cycleRes = await app.inject({
      method: "PATCH",
      url: `/api/campaigns/${campaignId}/locations/${grandparent.id}`,
      payload: { parentLocationId: child.id },
    });
    expect(cycleRes.statusCode).toBe(409);
  });

  it("orphans children instead of cascading or blocking when a parent location is deleted", async () => {
    const parent = await createLocation("Watchtower");
    const child = await createLocation("Signal Room", parent.id);

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/campaigns/${campaignId}/locations/${parent.id}`,
    });
    expect(deleteRes.statusCode).toBe(204);

    const childRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaignId}/locations/${child.id}`,
    });
    expect(childRes.statusCode).toBe(200);
    expect(childRes.json().parentLocationId).toBeNull();
  });
});
