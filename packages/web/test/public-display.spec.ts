import { test, expect, type APIRequestContext } from "@playwright/test";

async function createCampaign(request: APIRequestContext) {
  const res = await request.post("/api/campaigns", { data: { name: `Public Display Test ${Date.now()}` } });
  return (await res.json()) as { id: string };
}

async function createLocation(request: APIRequestContext, campaignId: string, name: string) {
  const res = await request.post(`/api/campaigns/${campaignId}/locations`, { data: { name } });
  return (await res.json()) as { id: string };
}

async function startSession(request: APIRequestContext, campaignId: string) {
  const res = await request.post(`/api/campaigns/${campaignId}/sessions`, { data: { title: "Test Session" } });
  return (await res.json()) as { id: string };
}

async function setLocation(request: APIRequestContext, campaignId: string, sessionId: string, locationId: string) {
  await request.post(`/api/campaigns/${campaignId}/sessions/${sessionId}/location`, { data: { locationId } });
}

test.describe("Public Display", () => {
  const createdCampaignIds: string[] = [];

  test.afterEach(async ({ request }) => {
    while (createdCampaignIds.length > 0) {
      const id = createdCampaignIds.pop();
      await request.delete(`/api/campaigns/${id}`);
    }
  });

  test("shows a clean not-found state promptly for an unknown campaign, without hanging on retries", async ({
    page,
  }) => {
    // Regression test: the query previously used TanStack Query's default
    // retry behavior (3 attempts with backoff, up to ~7s), which raced
    // against the 5s poll interval and kept restarting the retry cycle
    // before the 404 error ever settled -- "Campaign not found" never
    // rendered. retry: false means it must appear almost immediately.
    await page.goto("/display/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("Campaign not found")).toBeVisible({ timeout: 3000 });
  });

  test("keeps polling and picking up changes while the tab is backgrounded", async ({ page, request }) => {
    // Regression test: refetchIntervalInBackground defaults to false in
    // TanStack Query, which pauses polling whenever the document isn't
    // visible/focused -- exactly the state this screen normally runs in on
    // a second monitor/TV. Fake a backgrounded document via
    // visibilityState + a visibilitychange event (what TanStack Query's
    // focus manager actually listens for) and confirm a server-side change
    // still shows up within one poll interval.
    const campaign = await createCampaign(request);
    createdCampaignIds.push(campaign.id);
    const locationA = await createLocation(request, campaign.id, "Starting Room");
    const locationB = await createLocation(request, campaign.id, "Secret Vault");
    const session = await startSession(request, campaign.id);
    await setLocation(request, campaign.id, session.id, locationA.id);

    await page.goto(`/display/${campaign.id}`);
    await expect(page.getByText("Starting Room")).toBeVisible();

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await setLocation(request, campaign.id, session.id, locationB.id);

    await expect(page.getByText("Secret Vault")).toBeVisible({ timeout: 8000 });
  });
});
