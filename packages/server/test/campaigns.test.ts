import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

describe("campaign CRUD", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("creates, lists, updates, and deletes a campaign", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { name: "Test Campaign", description: "desc" },
    });
    expect(createRes.statusCode).toBe(201);
    const campaign = createRes.json();
    expect(campaign.name).toBe("Test Campaign");

    const listRes = await app.inject({ method: "GET", url: "/api/campaigns" });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().some((c: { id: string }) => c.id === campaign.id)).toBe(true);

    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/campaigns/${campaign.id}`,
      payload: { name: "Renamed Campaign" },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().name).toBe("Renamed Campaign");

    const deleteRes = await app.inject({ method: "DELETE", url: `/api/campaigns/${campaign.id}` });
    expect(deleteRes.statusCode).toBe(204);

    const getRes = await app.inject({ method: "GET", url: `/api/campaigns/${campaign.id}` });
    expect(getRes.statusCode).toBe(404);
  });

  it("404s for nested entity routes under an unknown campaign", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/campaigns/00000000-0000-0000-0000-000000000000/pcs",
    });
    expect(res.statusCode).toBe(404);
  });

  it("creates and deletes a PC nested under a campaign", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { name: "PC Test Campaign" },
    });
    const campaign = createRes.json();

    const pcRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaign.id}/pcs`,
      payload: { name: "Kira", roleOrClass: "Ranger" },
    });
    expect(pcRes.statusCode).toBe(201);
    expect(pcRes.json().name).toBe("Kira");
    expect(pcRes.json().campaignId).toBe(campaign.id);

    await app.inject({ method: "DELETE", url: `/api/campaigns/${campaign.id}` });
  });
});
