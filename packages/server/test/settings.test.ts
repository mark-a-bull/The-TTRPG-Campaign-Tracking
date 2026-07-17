import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

// Settings is a global singleton row, unlike every other model in this app
// (which is scoped to a campaign created fresh per test file). If another
// test file starts touching settings, these tests could race against it
// since they share the same test.db -- none do today.
describe("settings", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("creates and returns default settings on first GET", async () => {
    const res = await app.inject({ method: "GET", url: "/api/settings" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.darkMode).toBe("boolean");
    expect(body.colorScheme).toMatchObject({
      primary: expect.any(String),
      surface: expect.any(String),
      onSurface: expect.any(String),
      background: expect.any(String),
      onBackground: expect.any(String),
      surfaceVariant: expect.any(String),
      onSurfaceVariant: expect.any(String),
    });
  });

  it("updates darkMode and a subset of colorScheme, and persists across a second GET", async () => {
    const putRes = await app.inject({
      method: "PUT",
      url: "/api/settings",
      payload: { darkMode: true, colorScheme: { primary: "#123456" } },
    });
    expect(putRes.statusCode).toBe(200);
    expect(putRes.json().darkMode).toBe(true);
    expect(putRes.json().colorScheme.primary).toBe("#123456");

    const getRes = await app.inject({ method: "GET", url: "/api/settings" });
    expect(getRes.json().darkMode).toBe(true);
    expect(getRes.json().colorScheme.primary).toBe("#123456");
  });

  it("a darkMode-only PUT doesn't clobber existing color values", async () => {
    await app.inject({
      method: "PUT",
      url: "/api/settings",
      payload: { colorScheme: { primary: "#abcdef", surface: "#111111" } },
    });

    const putRes = await app.inject({ method: "PUT", url: "/api/settings", payload: { darkMode: false } });
    expect(putRes.statusCode).toBe(200);
    const body = putRes.json();
    expect(body.darkMode).toBe(false);
    expect(body.colorScheme.primary).toBe("#abcdef");
    expect(body.colorScheme.surface).toBe("#111111");
  });
});
