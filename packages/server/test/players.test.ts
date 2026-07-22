import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

describe("player CRUD", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("creates, lists, updates, and deletes a player", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/players",
      payload: { name: "Jon", phone: "555-1234", email: "jon@example.com" },
    });
    expect(createRes.statusCode).toBe(201);
    const player = createRes.json();
    expect(player.name).toBe("Jon");
    expect(player.phone).toBe("555-1234");
    expect(player.email).toBe("jon@example.com");

    const listRes = await app.inject({ method: "GET", url: "/api/players" });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().some((p: { id: string }) => p.id === player.id)).toBe(true);

    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/players/${player.id}`,
      payload: { name: "Jonathan" },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().name).toBe("Jonathan");

    const deleteRes = await app.inject({ method: "DELETE", url: `/api/players/${player.id}` });
    expect(deleteRes.statusCode).toBe(204);

    const getRes = await app.inject({ method: "GET", url: `/api/players/${player.id}` });
    expect(getRes.statusCode).toBe(404);
  });

  it("404s for an unknown player", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/players/00000000-0000-0000-0000-000000000000",
    });
    expect(res.statusCode).toBe(404);
  });

  it("creates a PC referencing a player, and leaves playerId dangling (not cascaded or blocked) when the player is deleted", async () => {
    const playerRes = await app.inject({
      method: "POST",
      url: "/api/players",
      payload: { name: "Cindy" },
    });
    const player = playerRes.json();

    const campaignRes = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { name: "Player Link Test Campaign" },
    });
    const campaign = campaignRes.json();

    const pcRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaign.id}/pcs`,
      payload: { name: "Steel", playerId: player.id },
    });
    expect(pcRes.statusCode).toBe(201);
    expect(pcRes.json().playerId).toBe(player.id);
    const pcId = pcRes.json().id;

    await app.inject({ method: "DELETE", url: `/api/players/${player.id}` });

    const getPcRes = await app.inject({
      method: "GET",
      url: `/api/campaigns/${campaign.id}/pcs/${pcId}`,
    });
    expect(getPcRes.statusCode).toBe(200);
    expect(getPcRes.json().playerId).toBe(player.id);

    await app.inject({ method: "DELETE", url: `/api/campaigns/${campaign.id}` });
  });
});
