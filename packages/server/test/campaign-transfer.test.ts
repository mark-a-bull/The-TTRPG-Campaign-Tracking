import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import JSZip from "jszip";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

function buildMultipartBody(boundary: string, filename: string, contentType: string, content: Buffer) {
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([head, content, tail]);
}

describe("campaign export/import", () => {
  let app: FastifyInstance;
  let campaignId: string;
  let pcId: string;
  let locationId: string;
  let childLocationId: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const campaignRes = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { name: "Transfer Test Campaign" },
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
      payload: { name: "The Sunken Keep" },
    });
    locationId = locationRes.json().id;

    const childLocationRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/locations`,
      payload: { name: "Basement", parentLocationId: locationId },
    });
    childLocationId = childLocationRes.json().id;

    const mysteryRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/mysteries`,
      payload: { name: "The Missing Heir" },
    });
    const mysteryId = mysteryRes.json().id;

    const clueRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/clues`,
      payload: { title: "A bloodied signet ring", mysteryId },
    });
    const clueId = clueRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/npcs`,
      payload: { name: "Old Tam" },
    });
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/monsters`,
      payload: { name: "Goblin Scout" },
    });

    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/links`,
      payload: { fromType: "pcs", fromId: pcId, toType: "locations", toId: locationId, label: "home town" },
    });

    const sessionRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions`,
      payload: { title: "Transfer Session" },
    });
    const sessionId = sessionRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/location`,
      payload: { locationId },
    });
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/notes`,
      payload: { note: "Found a hidden door." },
    });
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/clues/${clueId}/reveal`,
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
      payload: { kind: "entity", actorType: "pc", actorId: pcId, initiative: 10, maxHp: 10 },
    });
    const entryId = entryRes.json().entries.find((entry: { actorId: string }) => entry.actorId === pcId).id;
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/start`,
    });
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries/${entryId}/actions`,
      payload: { type: "damage", amount: 3 },
    });
    await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaignId}/sessions/${sessionId}/battles/${battleId}/entries/${entryId}/actions`,
      payload: { type: "status-apply", label: "Poisoned", note: "" },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("404s exporting an unknown campaign", async () => {
    const res = await app.inject({ method: "GET", url: `/api/campaigns/${randomUUID()}/export` });
    expect(res.statusCode).toBe(404);
  });

  it("400s importing a non-zip file", async () => {
    const boundary = "----test-boundary-bad";
    const body = buildMultipartBody(boundary, "not-a-zip.txt", "text/plain", Buffer.from("hello"));
    const res = await app.inject({
      method: "POST",
      url: "/api/campaigns/import",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
  });

  it("exports a full campaign to a zip and imports it back as a new campaign, remapping every id", async () => {
    const exportRes = await app.inject({ method: "GET", url: `/api/campaigns/${campaignId}/export` });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.headers["content-type"]).toBe("application/zip");

    const zip = await JSZip.loadAsync(exportRes.rawPayload);
    const manifest = JSON.parse(await zip.file("campaign.json")!.async("string"));
    expect(manifest.campaign.name).toBe("Transfer Test Campaign");
    expect(manifest.pcs).toHaveLength(1);
    expect(manifest.npcs).toHaveLength(1);
    expect(manifest.monsters).toHaveLength(1);
    expect(manifest.locations).toHaveLength(2);
    expect(manifest.mysteries).toHaveLength(1);
    expect(manifest.clues).toHaveLength(1);
    expect(manifest.entityLinks).toHaveLength(1);
    expect(manifest.sessions).toHaveLength(1);
    expect(manifest.sessions[0].events.length).toBeGreaterThan(0);
    expect(manifest.sessions[0].battles).toHaveLength(1);
    expect(manifest.sessions[0].battles[0].entries).toHaveLength(1);
    expect(manifest.sessions[0].battles[0].entries[0].statuses).toHaveLength(1);
    expect(manifest.clues[0].visibleTo).toEqual([pcId]);

    async function importAndVerify() {
      const boundary = `----test-boundary-${randomUUID()}`;
      const body = buildMultipartBody(boundary, "campaign.zip", "application/zip", exportRes.rawPayload);
      const importRes = await app.inject({
        method: "POST",
        url: "/api/campaigns/import",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload: body,
      });
      expect(importRes.statusCode).toBe(201);
      const newCampaign = importRes.json();
      expect(newCampaign.id).not.toBe(campaignId);
      expect(newCampaign.name).toBe("Transfer Test Campaign");

      const [newPcs, newLocations, newLinks, newClues, newSessions] = await Promise.all([
        app.inject({ method: "GET", url: `/api/campaigns/${newCampaign.id}/pcs` }).then((r) => r.json()),
        app.inject({ method: "GET", url: `/api/campaigns/${newCampaign.id}/locations` }).then((r) => r.json()),
        app.inject({ method: "GET", url: `/api/campaigns/${newCampaign.id}/links` }).then((r) => r.json()),
        app.inject({ method: "GET", url: `/api/campaigns/${newCampaign.id}/clues` }).then((r) => r.json()),
        app.inject({ method: "GET", url: `/api/campaigns/${newCampaign.id}/sessions` }).then((r) => r.json()),
      ]);

      expect(newPcs).toHaveLength(1);
      expect(newPcs[0].id).not.toBe(pcId);
      expect(newPcs[0].name).toBe("Kira Stormwind");

      expect(newLocations).toHaveLength(2);
      const newParentLocation = newLocations.find((location: { name: string }) => location.name === "The Sunken Keep");
      const newChildLocation = newLocations.find((location: { name: string }) => location.name === "Basement");
      expect(newParentLocation.id).not.toBe(locationId);
      expect(newChildLocation.id).not.toBe(childLocationId);
      // The child's parentLocationId must resolve to the parent's *new* id,
      // not the stale original id from the export -- this is the two-pass
      // import fix (createMany with null, then a second-pass update).
      expect(newChildLocation.parentLocationId).toBe(newParentLocation.id);
      expect(newParentLocation.parentLocationId).toBeNull();

      // The entity link must point at the *new* pc/location ids, not the originals.
      expect(newLinks).toHaveLength(1);
      expect(newLinks[0].fromId).toBe(newPcs[0].id);
      expect(newLinks[0].toId).toBe(newParentLocation.id);

      // Clue.visibleTo must resolve to the new PC id.
      expect(newClues[0].visibleTo).toEqual([newPcs[0].id]);

      // Session.currentLocationId must resolve to the new location id.
      expect(newSessions).toHaveLength(1);
      expect(newSessions[0].currentLocationId).toBe(newParentLocation.id);

      const eventsRes = await app.inject({
        method: "GET",
        url: `/api/campaigns/${newCampaign.id}/sessions/${newSessions[0].id}/events`,
      });
      const events = eventsRes.json().events;
      expect(events.length).toBe(manifest.sessions[0].events.length);

      return newCampaign.id;
    }

    const firstImportId = await importAndVerify();
    // Re-importing the identical zip must succeed as a second, independent
    // campaign rather than colliding on any reused id.
    const secondImportId = await importAndVerify();
    expect(secondImportId).not.toBe(firstImportId);

    await app.inject({ method: "DELETE", url: `/api/campaigns/${campaignId}` });
    await app.inject({ method: "DELETE", url: `/api/campaigns/${firstImportId}` });
    await app.inject({ method: "DELETE", url: `/api/campaigns/${secondImportId}` });
  });
});
