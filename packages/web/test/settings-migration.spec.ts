import { test, expect } from "@playwright/test";

const defaultLightColors = {
  primary: "#6750a4",
  surface: "#fffbfe",
  onSurface: "#1c1b1f",
  background: "#fffbfe",
  onBackground: "#1c1b1f",
  surfaceVariant: "#e7e0ec",
  onSurfaceVariant: "#49454f",
};

test.describe("Settings migration from legacy localStorage", () => {
  test.beforeEach(async ({ request }) => {
    await request.put("/api/settings", { data: { darkMode: false, colorScheme: defaultLightColors } });
  });

  test("migrates a pre-existing localStorage value to the server once, and not again on a later load", async ({
    page,
    request,
  }) => {
    // First navigation boots the app, which (finding no legacy key) marks
    // itself migrated already -- undo that so we can seed a legacy value as
    // if this were a browser that had customized settings before this
    // feature shipped, then reload to boot fresh with it present.
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("ttrpg-settings-migrated");
      localStorage.setItem(
        "ttrpg-settings",
        JSON.stringify({ darkMode: true, colorScheme: { primary: "#00ff00" } }),
      );
    });

    const migrationPut = page.waitForResponse(
      (res) => res.url().includes("/api/settings") && res.request().method() === "PUT",
    );
    await page.reload();
    await migrationPut;

    const migrated = await (await request.get("/api/settings")).json();
    expect(migrated.darkMode).toBe(true);
    expect(migrated.colorScheme.primary).toBe("#00ff00");

    // Change server state directly (simulating another device), then reload
    // this same "browser" again. If the once-per-browser guard didn't work,
    // the stale legacy localStorage value would silently re-migrate and
    // stomp this change right back to darkMode: true.
    await request.put("/api/settings", { data: { darkMode: false } });
    await page.reload();
    await page.waitForTimeout(300);

    const afterSecondReload = await (await request.get("/api/settings")).json();
    expect(afterSecondReload.darkMode).toBe(false);
  });
});
